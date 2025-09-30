// app/professor/publications/[id]/edit/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

const LEVELS = ['NATIONAL', 'INTERNATIONAL'] as const;
const ROLES  = ['LEAD', 'COAUTHOR', 'CORRESPONDING'] as const;
const PERSON_TYPES = ['INSTRUCTOR', 'STUDENT', 'EXTERNAL'] as const;

type Author = {
  full_name: string;
  email: string;
  person_type: (typeof PERSON_TYPES)[number];
  role: (typeof ROLES)[number];
  author_order?: number | null;
};

type Suggest = { person_id?: number; full_name: string; email?: string | null };
type Category = { category_id: number; category_name: string };
type Venue = { venue_id: number; type: string };

type Detail = {
  ok: true;
  pub_id: number;
  pub_name?: string | null;
  venue_id?: number | null;
  venue_name: string | null;
  level: string | null;
  year: number | null;
  status: string | null;
  has_pdf: boolean;
  link_url: string | null;
  file_path: string | null;
  abstract?: string | null;
  authors: Array<{
    full_name: string;
    email?: string | null;
    person_type?: string | null;
    role?: string | null;
    author_order?: number | null;
  }>;
  categories: string[];
  history?: Array<{
    edited_at: string;
    field_name: string;
    old_value: string | null;
    new_value: string | null;
    user_name: string | null;
  }>;
};

type ReviewComment = {
  id: number | string;
  created_at: string;
  author_name?: string | null;
  author_role?: string | null;
  text: string;
  status_tag?: string | null;
};

const STATUS_BADGE_STYLE: Record<string, string> = {
  draft: 'bg-zinc-100 text-zinc-700',
  under_review: 'bg-amber-100 text-amber-700',
  needs_revision: 'bg-indigo-100 text-indigo-700',
  published: 'bg-emerald-100 text-emerald-700',
  archived: 'bg-zinc-100 text-zinc-500',
};

export default function EditPublicationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  // control states
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // fields
  const [pubName, setPubName]     = useState<string>('');
  const [venueName, setVenueName] = useState<string>('');
  const [level, setLevel]         = useState<string>('INTERNATIONAL');
  const [year, setYear]           = useState<string>(String(new Date().getFullYear()));
  const [status, setStatus]       = useState<string>('draft'); // read-only display
  const [linkUrl, setLinkUrl]     = useState<string>('');
  const [abstractText, setAbstractText] = useState<string>('');

  // venues
  const [venues, setVenues] = useState<Venue[]>([]);
  const [venueId, setVenueId] = useState<number | ''>('');
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [venuesError, setVenuesError] = useState<string | null>(null);

  // PDF
  const [hasPdf, setHasPdf]           = useState<boolean>(false);
  const [filePath, setFilePath]       = useState<string | null>(null);
  const [selectedPdf, setSelectedPdf] = useState<File | null>(null);
  const [removePdf, setRemovePdf]     = useState<boolean>(false);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);

  // categories
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [selectedCats, setSelectedCats]   = useState<string[]>([]);
  const [catQuery, setCatQuery]           = useState('');
  const [catOpen, setCatOpen]             = useState(false);

  // authors
  const [authors, setAuthors] = useState<Author[]>([]);

  // history
  const [history, setHistory] = useState<Detail['history']>([]);

  // autocomplete
  const [suggestions, setSuggestions] = useState<Record<number, Suggest[]>>({});
  const debounceTimers = useRef<Record<number, any>>({});

  function onAuthorNameChange(idx: number, name: string) {
    updateAuthor(idx, { full_name: name });

    if (debounceTimers.current[idx]) clearTimeout(debounceTimers.current[idx]);
    debounceTimers.current[idx] = setTimeout(async () => {
      const q = name.trim();
      if (!q) {
        setSuggestions((prev) => ({ ...prev, [idx]: [] }));
        return;
      }
      try {
        const res = await fetch(`/api/professor/people?q=${encodeURIComponent(q)}`, { cache: 'no-store' });
        const json = await res.json();
        const list: Suggest[] = Array.isArray(json?.data)
          ? (json.data as any[]).map((x) => ({
              full_name: String(x.full_name || ''),
              email: x.email ?? null,
              person_id: x.person_id,
            })).filter((x) => x.full_name)
          : [];
        setSuggestions((prev) => ({ ...prev, [idx]: list }));
      } catch {
        setSuggestions((prev) => ({ ...prev, [idx]: [] }));
      }
    }, 250);
  }

  function pickSuggestion(idx: number, s: Suggest) {
    updateAuthor(idx, { full_name: s.full_name, ...(s.email ? { email: s.email } : {}) });
    setSuggestions((prev) => ({ ...prev, [idx]: [] }));
  }

  function addAuthor() {
    setAuthors((a) => [
      ...a,
      { full_name: '', email: '', person_type: 'EXTERNAL', role: 'COAUTHOR', author_order: a.length + 1 },
    ]);
  }
  function removeAuthor(idx: number) {
    setAuthors((a) =>
      a.filter((_, i) => i !== idx).map((x, i) => ({ ...x, author_order: i + 1 }))
    );
    setSuggestions((prev) => {
      const { [idx]: _drop, ...rest } = prev;
      return rest;
    });
  }
  function updateAuthor(idx: number, patch: Partial<Author>) {
    setAuthors((a) => a.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  }

  // categories helpers
  const filteredCats = useMemo(() => {
    const q = catQuery.trim().toLowerCase();
    const chosen = new Set(selectedCats);
    return allCategories
      .filter(c => !chosen.has(c.category_name))
      .filter(c => !q || c.category_name.toLowerCase().includes(q))
      .slice(0, 50);
  }, [allCategories, selectedCats, catQuery]);

  function addCategory(name: string) {
    if (!selectedCats.includes(name)) setSelectedCats(prev => [...prev, name]);
    setCatQuery('');
    setCatOpen(false);
  }
  function removeCategory(name: string) {
    setSelectedCats(prev => prev.filter(n => n !== name));
  }

  // load detail + categories + venues
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/professor/publications/${id}`, { cache: 'no-store' });
        const json: Detail | { message: string } = await res.json();
        if (!res.ok || !(json as any).ok) throw new Error((json as any).message || 'load failed');

        const d = json as Detail;
        if (cancelled) return;

        setPubName(d.pub_name ?? '');
        setVenueName(d.venue_name ?? '');
        setLevel((d.level as any) || 'INTERNATIONAL');
        setYear(d.year != null ? String(d.year) : '');
        setStatus(d.status ?? 'draft'); // read-only display
        setLinkUrl(d.link_url ?? '');
        setHasPdf(!!d.has_pdf);
        setFilePath(d.file_path ?? null);
        setSelectedPdf(null);
        setRemovePdf(false);
        setAbstractText(d.abstract ?? '');

        setVenueId(
          typeof d.venue_id === 'number' && Number.isFinite(d.venue_id) ? d.venue_id : ''
        );

        setAuthors(
          (d.authors || []).map((a, i) => ({
            full_name: a.full_name || '',
            email: (a.email || '') ?? '',
            person_type: ((a.person_type || 'EXTERNAL').toUpperCase() as Author['person_type']),
            role: ((a.role || (i === 0 ? 'LEAD' : 'COAUTHOR')).toUpperCase() as Author['role']),
            author_order: a.author_order ?? i + 1,
          }))
        );

        setSelectedCats((d.categories || []).slice());
        setHistory(d.history || []);
      } catch (e: any) {
        setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    (async () => {
      try {
        const res = await fetch('/api/professor/publications/categories?status=ACTIVE', { cache: 'no-store' });
        const json = await res.json();
        setAllCategories(Array.isArray(json?.data) ? json.data : []);
      } catch {
        setAllCategories([]);
      }
    })();

    (async () => {
      setVenuesLoading(true);
      setVenuesError(null);
      try {
        const res = await fetch('/api/professor/venues', { cache: 'no-store' });
        const json = await res.json();
        const vs: Venue[] = Array.isArray(json?.data) ? json.data : [];
        setVenues(vs);
        if (!vs.length) setVenuesError('ไม่พบรายการประเภทผลงาน');
      } catch (e: any) {
        setVenues([]);
        setVenuesError(e?.message || 'โหลดประเภทผลงานไม่สำเร็จ');
      } finally {
        setVenuesLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [id]);

  // ---------- save helpers ----------
  async function saveBase(statusOverride?: string) {
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();

      // main
      fd.append('pub_name', pubName || '');
      fd.append('title_th', pubName || '');
      fd.append('_extra_title_th', pubName || '');

      if (venueId !== '') fd.append('venue_id', String(venueId));

      fd.append('venue_name', venueName || '');
      fd.append('level', level || '');
      fd.append('year', year || '');

      // status only when overriding (submit for review)
      if (statusOverride) {
        fd.append('status', statusOverride);
      }

      fd.append('link_url', linkUrl || '');
      fd.append('abstract', abstractText || '');

      // PDF
      if (removePdf) fd.append('remove_pdf', 'true');
      if (selectedPdf) fd.append('pdf', selectedPdf);

      // authors_json
      fd.append(
        'authors_json',
        JSON.stringify(
          authors
            .map((a, i) => ({
              full_name: a.full_name.trim(),
              email: a.email.trim() || null,
              person_type: a.person_type,
              role: a.role,
              author_order: a.author_order ?? i + 1,
            }))
            .filter((a) => a.full_name.length > 0)
        )
      );

      // categories
      fd.append('categories', selectedCats.join(','));

      const res = await fetch(`/api/professor/publications/${id}`, { method: 'PATCH', body: fd });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.message || 'save failed');

      if ('file_path' in json) setFilePath(json.file_path);
      if ('has_pdf' in json) setHasPdf(!!json.has_pdf);
      setSelectedPdf(null);
      setRemovePdf(false);
      if (json.history) setHistory(json.history);

      return true;
    } catch (e: any) {
      setError(e?.message || String(e));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    const ok = await saveBase();
    if (ok) {
      alert('บันทึกแล้ว');
      router.back();
    }
  }

  async function saveAndSubmit() {
    const ok = await saveBase('under_review');
    if (ok) {
      alert('บันทึกและส่งตรวจแล้ว');
      router.back();
    }
  }

  // delete
  async function onDelete() {
    if ((status || '').toLowerCase() === 'published') {
      alert('ไม่สามารถลบผลงานที่เผยแพร่แล้ว');
      return;
    }

    if (deleting) return;
    if (!confirm('ต้องการลบผลงานนี้หรือไม่? การลบจะไม่สามารถย้อนกลับได้')) return;

    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/professor/publications/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.message || 'ลบไม่สำเร็จ');

      router.push('/professor/dashboard');
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setDeleting(false);
    }
  }

  const disabled = useMemo(() => loading || saving || deleting, [loading, saving, deleting]);

  // 🔒 read-only for published
  const isReadOnly = (status || '').toLowerCase() === 'published';

  // PDF filename
  const fileName = useMemo(() => {
    if (selectedPdf?.name) return selectedPdf.name;
    if (filePath) return filePath.split('/').pop() || 'file.pdf';
    return '';
  }, [selectedPdf, filePath]);

  // ====== review panel ======
  const [panelOpen, setPanelOpen] = useState(false);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const loadedOnceRef = useRef(false);

  async function loadComments() {
    setCommentsLoading(true);
    setCommentsError(null);
    try {
      const res = await fetch(`/api/professor/publications/${id}/comments`, { cache: 'no-store' });
      const json = await res.json();
      const list: ReviewComment[] = Array.isArray(json?.data) ? json.data : [];
      setComments(list);
    } catch (e: any) {
      setComments([]);
      setCommentsError(e?.message || 'โหลดคอมเมนต์ไม่สำเร็จ');
    } finally {
      setCommentsLoading(false);
    }
  }

  useEffect(() => {
    if (panelOpen && !loadedOnceRef.current) {
      loadedOnceRef.current = true;
      loadComments();
    }
  }, [panelOpen]);

  const canOpenComments = (status || '').toLowerCase() === 'needs_revision';
  const statusOnlyComments = useMemo(
    () => comments.filter(c => !!c.status_tag),
    [comments]
  );

  if (loading) return <div className="p-6">กำลังโหลด...</div>;
  if (error) {
    return (
      <div className="p-6">
        <div className="text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
          {error}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* หัวเรื่อง + action */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">แก้ไขผลงานตีพิมพ์</h1>
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/professor/dashboard')}
              className="px-3 py-2 rounded-lg border bg-white"
              disabled={disabled}
            >
              ย้อนกลับ
            </button>

            {!isReadOnly && (
              <button
                onClick={saveAndSubmit}
                disabled={disabled || isReadOnly}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white disabled:opacity-50"
                title="บันทึกข้อมูลและส่งให้เจ้าหน้าที่ตรวจ"
              >
                {saving ? 'กำลังบันทึก...' : 'บันทึกและส่งตรวจ'}
              </button>
            )}

            {!isReadOnly && (
              <button
                onClick={save}
                disabled={disabled || isReadOnly}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50"
              >
                {saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
              </button>
            )}

            {/* ซ่อนปุ่มลบเมื่อเผยแพร่แล้ว */}
            {!isReadOnly && (
              <button
                onClick={onDelete}
                disabled={disabled}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white disabled:opacity-50"
                title="ลบผลงานนี้"
              >
                {deleting ? 'กำลังลบ...' : 'ลบผลงาน'}
              </button>
            )}
          </div>
        </div>

        {/* 🔔 คำเตือนเมื่อเผยแพร่แล้ว */}
        {isReadOnly && (
          <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            * ไม่สามารถแก้ไข/ลบเมื่อเผยแพร่แล้ว
          </div>
        )}

        {/* ฟอร์มหลัก */}
        <div className="bg-white rounded-xl shadow p-5 space-y-4">
          {/* ชื่อผลงาน */}
          <div>
            <div className="text-xs text-gray-500 mb-1">ชื่อผลงาน</div>
            <input
              value={pubName}
              onChange={(e) => setPubName(e.target.value)}
              disabled={isReadOnly}
              className="w-full border rounded-xl px-3 py-2 disabled:bg-zinc-50"
              placeholder="เช่น Large-Scale Image Segmentation with..."
            />
          </div>

          {/* บทคัดย่อ */}
          <div>
            <div className="text-xs text-gray-500 mb-1">บทคัดย่อ (Abstract)</div>
            <textarea
              value={abstractText}
              onChange={(e) => setAbstractText(e.target.value)}
              disabled={isReadOnly}
              rows={6}
              className="w-full border rounded-xl px-3 py-2 disabled:bg-zinc-50"
              placeholder="สรุปแนวคิด วิธีการ ผลลัพธ์สำคัญของงานนี้..."
            />
            <div className="text-[11px] text-gray-400 mt-1">
              รองรับตัวอักษรทั่วไป ความยาวตามที่ต้องการ
            </div>
          </div>

          {/* ประเภทผลงาน + แหล่งตีพิมพ์ */}
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-12 md:col-span-4">
              <div className="text-xs text-gray-500 mb-1">ประเภทผลงาน</div>
              <select
                value={venueId}
                onChange={(e) => setVenueId(e.target.value ? Number(e.target.value) : '')}
                className="w-full border rounded-xl px-3 py-2 disabled:bg-zinc-50"
                disabled={venuesLoading || isReadOnly}
              >
                {venuesLoading && <option value="">กำลังโหลด...</option>}
                {!venuesLoading && venues.length === 0 && <option value="">— ไม่มีข้อมูลประเภท —</option>}
                {!venuesLoading && venues.length > 0 && (
                  <>
                    <option value="">— เลือกประเภท —</option>
                    {venues.map((v) => (
                      <option key={v.venue_id} value={v.venue_id}>
                        {v.type || `VENUE #${v.venue_id}`}
                      </option>
                    ))}
                  </>
                )}
              </select>
              {venuesError && <div className="mt-1 text-xs text-rose-600">{venuesError}</div>}
            </div>

            <div className="col-span-12 md:col-span-8">
              <div className="text-xs text-gray-500 mb-1">แหล่งตีพิมพ์ (Venue)</div>
              <input
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                disabled={isReadOnly}
                className="w-full border rounded-xl px-3 py-2 disabled:bg-zinc-50"
                placeholder="เช่น IEEE Access / ICAI / Springer"
              />
            </div>
          </div>

          {/* meta row */}
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-6 md:col-span-4">
              <div className="text-xs text-gray-500 mb-1">ระดับ</div>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                disabled={isReadOnly}
                className="w-full border rounded-xl px-3 py-2 disabled:bg-zinc-50"
              >
                {LEVELS.map((lv) => (
                  <option key={lv} value={lv}>{lv}</option>
                ))}
              </select>
            </div>

            <div className="col-span-6 md:col-span-4">
              <div className="text-xs text-gray-500 mb-1">ปี</div>
              <input
                value={year}
                onChange={(e) => setYear(e.target.value)}
                disabled={isReadOnly}
                className="w-full border rounded-xl px-3 py-2 disabled:bg-zinc-50"
                placeholder="2025"
              />
            </div>

            <div className="col-span-12 md:col-span-4">
              <div className="text-xs text-gray-500 mb-1">สถานะปัจจุบัน</div>
              <div
                className={[
                  'inline-flex items-center text-xs px-3 py-1.5 rounded-full',
                  STATUS_BADGE_STYLE[(status || '').toLowerCase()] || 'bg-zinc-100 text-zinc-700',
                ].join(' ')}
                title="สถานะนี้แก้ไขได้โดยการส่งตรวจ/ผู้ตรวจปรับ หรือผ่านประวัติสถานะ"
              >
                {status || 'draft'}
              </div>
            </div>
          </div>

          {/* link + PDF */}
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-12 md:col-span-8">
              <div className="text-xs text-gray-500 mb-1">ลิงก์ / DOI</div>
              <input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                disabled={isReadOnly}
                className="w-full border rounded-xl px-3 py-2 disabled:bg-zinc-50"
                placeholder="https://doi.org/..."
              />
            </div>

            <div className="col-span-12 md:col-span-4">
              <div className="text-xs text-gray-500 mb-1">ไฟล์ PDF</div>

              <div className="flex items-center gap-2 mb-2">
                {fileName ? (
                  <span className="text-sm truncate max-w-[60%]" title={fileName}>{fileName}</span>
                ) : (
                  <span className="text-sm text-gray-500">ไม่มีไฟล์</span>
                )}

                {filePath && !selectedPdf && !isReadOnly && (
                  <button
                    type="button"
                    onClick={() => { setRemovePdf(true); setFilePath(null); setHasPdf(false); }}
                    className="px-2 py-1 rounded-lg bg-rose-100 text-rose-700 text-xs"
                  >
                    ลบไฟล์เดิม
                  </button>
                )}

                {selectedPdf && !isReadOnly && (
                  <button
                    type="button"
                    onClick={() => setSelectedPdf(null)}
                    className="px-2 py-1 rounded-lg bg-rose-100 text-rose-700 text-xs"
                  >
                    ลบไฟล์ที่เลือก
                  </button>
                )}
              </div>

              <input
                ref={pdfInputRef}
                key={selectedPdf ? selectedPdf.name : 'empty'}
                type="file"
                accept="application/pdf"
                disabled={isReadOnly}
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setSelectedPdf(f);
                  if (f) setRemovePdf(false);
                }}
                className="block w-full text-sm file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border file:bg-gray-50 disabled:bg-zinc-50"
              />
            </div>
          </div>

          {/* categories */}
          <div>
            <div className="text-xs text-gray-500 mb-1">หมวดหมู่</div>

            {selectedCats.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedCats.map((name) => (
                  <span key={name} className="inline-flex items-center gap-1 text-xs bg-zinc-50 border rounded-full px-2 py-1">
                    {name}
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => removeCategory(name)}
                        className="text-rose-600 hover:text-rose-700"
                        aria-label={`remove ${name}`}
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}

            <div className="relative">
              <input
                value={catQuery}
                onChange={(e) => { setCatQuery(e.target.value); setCatOpen(true); }}
                onFocus={() => setCatOpen(true)}
                onBlur={() => setTimeout(() => setCatOpen(false), 150)}
                disabled={isReadOnly}
                placeholder="พิมพ์เพื่อค้นหาหมวดหมู่ที่มีอยู่..."
                className="w-full border rounded-xl px-3 py-2 disabled:bg-zinc-50"
              />
              {catOpen && !isReadOnly && (
                <div className="absolute left-0 top-full mt-1 w-full max-h-56 overflow-auto bg-white border rounded-md shadow-lg z-50">
                  {filteredCats.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-zinc-500">ไม่พบหมวดหมู่</div>
                  ) : (
                    filteredCats.map((c) => (
                      <button
                        key={c.category_id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => addCategory(c.category_name)}
                        className="w-full text-left px-3 py-2 hover:bg-zinc-50 text-sm"
                      >
                        {c.category_name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Authors */}
          <div>
            <div className="text-xs text-gray-500 mb-2">ผู้เขียน / ผู้ร่วมเขียน</div>
            <div className="border rounded-xl overflow-visible">
              <div className="grid grid-cols-12 gap-3 text-xs bg-gray-50 px-3 py-2 text-gray-600">
                <div className="col-span-5">ชื่อ-นามสกุล</div>
                <div className="col-span-3">อีเมล</div>
                <div className="col-span-2 text-center">ประเภทบุคคล</div>
                <div className="col-span-1 text-center">บทบาท</div>
                <div className="col-span-1 text-center"> </div>
              </div>

              {authors.map((a, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-3 px-3 py-2 border-t items-center">
                  <div className="col-span-5 relative">
                    <input
                      value={a.full_name}
                      onChange={(e) => onAuthorNameChange(idx, e.target.value)}
                      onBlur={() => setTimeout(() => setSuggestions((p) => ({ ...p, [idx]: [] })), 150)}
                      disabled={isReadOnly}
                      className="w-full border rounded-lg px-2 h-9 disabled:bg-zinc-50"
                      placeholder="Assoc. Prof. Somchai"
                    />
                    {(suggestions[idx]?.length ?? 0) > 0 && !isReadOnly && (
                      <div className="absolute left-0 top-full mt-1 w-full max-h-56 overflow-auto bg-white border rounded-md shadow-lg z-50">
                        {suggestions[idx].map((s, i) => (
                          <button
                            key={i}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => pickSuggestion(idx, s)}
                            className="w-full text-left px-3 py-2 hover:bg-zinc-50 text-sm"
                          >
                            <div className="truncate">{s.full_name}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <input
                    value={a.email}
                    onChange={(e) => updateAuthor(idx, { email: e.target.value })}
                    disabled={isReadOnly}
                    className="col-span-3 border rounded-lg px-2 h-9 disabled:bg-zinc-50"
                    placeholder="name@example.com"
                  />

                  <div className="col-span-2">
                    <select
                      value={a.person_type}
                      onChange={(e) => updateAuthor(idx, { person_type: e.target.value as Author['person_type'] })}
                      disabled={isReadOnly}
                      className="border rounded-lg px-2 h-9 text-xs w-full min-w-[132px] max-w-[160px] disabled:bg-zinc-50"
                    >
                      {PERSON_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-1">
                    <select
                      value={a.role}
                      onChange={(e) => updateAuthor(idx, { role: e.target.value as Author['role'] })}
                      disabled={isReadOnly}
                      className="border rounded-lg px-2 h-9 text-xs w-full min-w-[96px] max-w-[120px] disabled:bg-zinc-50"
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>

                  <div className="col-span-1 flex justify-end">
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => removeAuthor(idx)}
                        className="px-2 py-1 rounded-lg bg-rose-100 text-rose-700 text-xs"
                      >
                        ลบ
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {!isReadOnly && (
              <div className="mt-2">
                <button onClick={addAuthor} className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm">
                  + เพิ่มผู้เขียน
                </button>
              </div>
            )}
          </div>
        </div>

        {/* History */}
        <div className="bg-white rounded-xl shadow p-5">
          <div className="text-sm font-medium mb-3">ประวัติการแก้ไข (ทั้งหมด)</div>
          {(!history || history.length === 0) ? (
            <div className="text-sm text-gray-500">—</div>
          ) : (
            <div className="space-y-2 text-sm">
              {history.map((h, i) => (
                <div key={i} className="flex items-center justify-between border-b pb-2">
                  <div>
                    <div className="text-gray-800">
                      <span className="font-medium">{h.field_name}</span>{' '}
                      <span className="text-gray-500 line-through">{h.old_value ?? '—'}</span>
                      {' '}→ <span className="text-blue-700">{h.new_value ?? '—'}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(h.edited_at).toLocaleString()} • {h.user_name || '—'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ปุ่มเปิดแผงคอมเมนต์ (เฉพาะ needs_revision) */}
      {canOpenComments && (
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          className="fixed top-1/3 right-0 z-40 translate-x-1/2 rounded-l-2xl shadow-xl border-2 bg-white p-3"
          title={panelOpen ? 'ปิดแผงคอมเมนต์' : 'เปิดแผงคอมเมนต์'}
          aria-label={panelOpen ? 'ปิดแผงคอมเมนต์' : 'เปิดแผงคอมเมนต์'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`h-7 w-7 transition-transform ${!panelOpen ? 'rotate-180' : ''}`}>
            <path d="M9.29 6.71a1 1 0 0 1 1.42-1.42l6 6a1 1 0 0 1 0 1.42l-6 6a1 1 0 1 1-1.42-1.42L13.59 12 9.29 7.71z" />
          </svg>
        </button>
      )}

      {/* Overlay */}
      <div
        onClick={() => setPanelOpen(false)}
        className={`fixed inset-0 z-40 bg-black/20 transition-opacity ${panelOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      />

      {/* แผงคอมเมนต์ */}
      <aside
        className={`fixed top-0 right-0 h-full w-[360px] max-w-[90vw] z-50 bg-white border-l shadow-xl transition-transform duration-300 ${panelOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="font-medium">ติดตามสถานะ และ comments</div>
          <button onClick={() => setPanelOpen(false)} className="rounded-md border px-2 py-1 text-sm" aria-label="close comments">ปิด</button>
        </div>

        <div className="p-3 space-y-3 overflow-y-auto h-[calc(100%-56px)]">
          {commentsLoading ? (
            <div className="text-sm text-gray-500">กำลังโหลดคอมเมนต์...</div>
          ) : commentsError ? (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{commentsError}</div>
          ) : (comments.filter(c => !!c.status_tag)).length === 0 ? (
            <div className="text-sm text-gray-500">ยังไม่มีคอมเมนต์</div>
          ) : (
            (comments.filter(c => !!c.status_tag)).map((c) => {
              const role = (c.author_role || '').toUpperCase();
              const showText = !!(c.text && c.text.trim() && role === 'STAFF');
              return (
                <div key={c.id} className="rounded-xl border bg-white shadow-sm p-3">
                  <div className="text-xs text-gray-500">
                    {c.author_name || 'เจ้าหน้าที่'} {c.author_role ? `• ${c.author_role}` : ''}
                  </div>
                  {showText ? <div className="mt-1 text-sm">{c.text}</div> : null}
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                    <span>{new Date(c.created_at).toLocaleString()}</span>
                    {c.status_tag && (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5">{c.status_tag}</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </>
  );
}
