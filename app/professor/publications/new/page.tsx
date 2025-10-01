// app/professor/publications/new/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const LEVELS = ['NATIONAL', 'INTERNATIONAL'] as const;
const ROLES  = ['LEAD', 'COAUTHOR', 'CORRESPONDING'] as const;
const PERSON_TYPES = ['INSTRUCTOR', 'STUDENT', 'EXTERNAL'] as const;

type Author = {
  full_name: string;
  email: string;
  person_type: (typeof PERSON_TYPES)[number];
  role: (typeof ROLES)[number];
};

type Suggest = { person_id?: number; full_name: string; email?: string | null };
type Category = { category_id: number; category_name: string };

type Venue = {
  venue_id: number;
  type: string;           // ใช้แสดงเป็น “ประเภทผลงาน”
};

export default function ProfessorCreatePublicationPage() {
  const router = useRouter();

  // ฟอร์มหลัก
  const [pubName, setPubName] = useState('');
  const [level, setLevel]     = useState<(typeof LEVELS)[number]>('INTERNATIONAL');
  const [year, setYear]       = useState<string>(String(new Date().getFullYear()));
  const [venueName, setVenueName] = useState(''); // ชื่อวารสาร/งานประชุม (อิสระ)
  const [linkUrl, setLinkUrl] = useState('');
  const [abstractText, setAbstractText] = useState(''); // ✅ abstract ช่องเดียว
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  // ประเภทผลงาน (มาจากตาราง venue)
  const [venues, setVenues] = useState<Venue[]>([]);
  const [venueId, setVenueId] = useState<number | ''>(''); // ส่ง venue_id ตอนบันทึก
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [venuesError, setVenuesError] = useState<string | null>(null);

  // --- categories (เลือกจากฐานข้อมูลเท่านั้น)
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [catQuery, setCatQuery] = useState('');
  const [catOpen, setCatOpen] = useState(false);

  // ผู้เขียน
  const [authors, setAuthors] = useState<Author[]>([
    { full_name: '', email: '', person_type: 'INSTRUCTOR', role: 'LEAD' },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---------- โหลดหมวดหมู่ & รายการประเภท (venues) ----------
  useEffect(() => {
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
      try {
        // endpoint นี้ควรรีเทิร์น { ok: true, data: [{ venue_id, type }, ...] }
        const res = await fetch('/api/professor/venues', { cache: 'no-store' });
        const json = await res.json();
        setVenues(Array.isArray(json?.data) ? json.data : []);
        if (!json?.data?.length) setVenuesError('ไม่พบรายการประเภทผลงาน');
      } catch (e: any) {
        setVenues([]);
        setVenuesError(e?.message || 'โหลดประเภทผลงานไม่สำเร็จ');
      } finally {
        setVenuesLoading(false);
      }
    })();
  }, []);

  const filteredCats = useMemo(() => {
    const q = catQuery.trim().toLowerCase();
    const chosen = new Set(selectedCats);
    return allCategories
      .filter(c => !chosen.has(c.category_name))
      .filter(c => !q || c.category_name.toLowerCase().includes(q))
      .slice(0, 50); // limit แสดงผล
  }, [allCategories, selectedCats, catQuery]);

  function addCategory(name: string) {
    if (!selectedCats.includes(name)) {
      setSelectedCats(prev => [...prev, name]);
    }
    setCatQuery('');
    setCatOpen(false);
  }
  function removeCategory(name: string) {
    setSelectedCats(prev => prev.filter(n => n !== name));
  }

  // ---------- autocomplete authors ----------
  const [suggestions, setSuggestions] = useState<Record<number, Suggest[]>>({});
  const debounceTimers = useRef<Record<number, any>>({});

  // helper: ดึงอีเมลจากอ็อบเจ็กต์ที่อาจมีหลายฟิลด์
  function extractEmail(x: any): string | null {
    const direct =
      x?.email ??
      x?.person_email ??
      x?.work_email ??
      x?.contact_email ??
      x?.primary_email ??
      null;

    if (typeof direct === 'string' && direct.trim()) return direct.trim();

    // เผื่อ backend ส่งเป็น array
    const arr = x?.emails || x?.email_list || x?.contacts;
    if (Array.isArray(arr) && arr.length) {
      const first = arr.find((e: any) => typeof e === 'string' && e.includes('@'))
                 ?? arr.find((e: any) => typeof e?.email === 'string' && e.email.includes('@'))?.email
                 ?? arr[0];
      if (typeof first === 'string') return first.trim();
      if (typeof first?.email === 'string') return first.email.trim();
    }
    return null;
    }

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
        const arr: Suggest[] = Array.isArray(json?.data)
          ? json.data.map((x: any) => ({
              person_id: x.person_id,
              full_name: String(x.full_name ?? ''),
              email: extractEmail(x),
            }))
          : [];
        setSuggestions((prev) => ({ ...prev, [idx]: arr }));
      } catch {
        setSuggestions((prev) => ({ ...prev, [idx]: [] }));
      }
    }, 250);
  }

  async function pickSuggestion(idx: number, s: Suggest) {
    // ใส่ชื่อก่อน
    updateAuthor(idx, { full_name: s.full_name });

    // ถ้ามีอีเมลมาใน suggest ใส่ให้เลย
    if (s.email && s.email.trim()) {
      updateAuthor(idx, { email: s.email.trim() });
    } else if (s.person_id != null) {
      // ไม่มีอีเมลมากับรายการ -> ดึงรายละเอียดรายบุคคลเพื่อหาอีเมล
      try {
        const res = await fetch(`/api/professor/people/${s.person_id}`, { cache: 'no-store' });
        const json = await res.json();
        const email = extractEmail(json?.data ?? json);
        if (email) {
          updateAuthor(idx, { email });
        }
      } catch {
        // เงียบได้: ไม่มีอีเมลก็ปล่อยให้ผู้ใช้พิมพ์เอง
      }
    }

    // ปิด dropdown แถวนี้
    setSuggestions((prev) => ({ ...prev, [idx]: [] }));
  }

  // ---------- author ops ----------
  function addAuthor() {
    setAuthors((a) => [...a, { full_name: '', email: '', person_type: 'EXTERNAL', role: 'COAUTHOR' }]);
  }
  function removeAuthor(idx: number) {
    setAuthors((a) => a.filter((_, i) => i !== idx));
    setSuggestions((prev) => {
      const { [idx]: _drop, ...rest } = prev;
      return rest;
    });
  }
  function updateAuthor(idx: number, patch: Partial<Author>) {
    setAuthors((a) => a.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  }

  // ---------- PDF ----------
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  function onPickPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setPdfFile(f);
  }
  function clearPdf() {
    setPdfFile(null);
    if (pdfInputRef.current) pdfInputRef.current.value = '';
  }
  function prettySize(f: File) {
    const mb = f.size / (1024 * 1024);
    if (mb < 0.1) return `${(f.size / 1024).toFixed(0)} KB`;
    return `${mb.toFixed(2)} MB`;
  }

  // ---------- submit ----------
  async function submit(status: 'draft' | 'under_review') {
    setError(null);
    if (!pubName.trim()) {
      setError('กรุณากรอกชื่อผลงาน');
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();

      // ชื่อผลงาน + เมตา
      fd.append('pub_name', pubName || '');
      fd.append('level', level);
      fd.append('year', year || '');
      fd.append('link_url', linkUrl || '');
      fd.append('status', status);
      fd.append('abstract', abstractText || ''); // ✅ ส่ง abstract ไป DB

      // ประเภทผลงาน: ส่ง venue_id (จากตาราง venue)
      if (venueId !== '') {
        fd.append('venue_id', String(venueId));
      }

      // ชื่อ venue อิสระ (optional เก็บที่ publication.venue_name)
      fd.append('venue_name', venueName || '');

      // PDF
      if (pdfFile) {
        fd.append('pdf', pdfFile);
        fd.append('has_pdf', 'true');
      } else {
        fd.append('has_pdf', 'false');
      }

      // categories -> comma string
      fd.append('categories', selectedCats.join(','));

      // authors -> JSON
      fd.append(
        'authors_json',
        JSON.stringify(
          authors
            .map((a, i) => ({
              full_name: a.full_name.trim(),
              email: a.email.trim() || null,
              person_type: a.person_type,
              role: a.role,
              author_order: i + 1,
            }))
            .filter((a) => a.full_name.length > 0)
        )
      );

      const res = await fetch('/api/professor/publications', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.message || 'ไม่สามารถบันทึกได้');

      router.push(`/professor/publications/${json.pub_id}`);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = useMemo(() => submitting, [submitting]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="text-base font-semibold mb-4">สร้างบันทึกผลงานตีพิมพ์</h2>

          <section className="space-y-4">
            {/* ชื่อผลงาน */}
            <div>
              <div className="text-xs text-gray-500 mb-1">ชื่อผลงาน</div>
              <input
                value={pubName}
                onChange={(e) => setPubName(e.target.value)}
                className="w-full border rounded-xl px-3 py-2"
                placeholder="ใส่ชื่อผลงาน..."
              />
            </div>

            {/* ประเภทผลงาน (จากตาราง venue) + ระดับ + ปี */}
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 sm:col-span-4">
                <div className="text-xs text-gray-500 mb-1">ประเภทผลงาน</div>
                <select
                  value={venueId}
                  onChange={(e) => setVenueId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full border rounded-xl px-3 py-2"
                  disabled={venuesLoading}
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
                {venuesError && (
                  <div className="mt-1 text-xs text-rose-600">{venuesError}</div>
                )}
              </div>

              <div className="col-span-12 sm:col-span-4">
                <div className="text-xs text-gray-500 mb-1">ระดับ</div>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value as any)}
                  className="w-full border rounded-xl px-3 py-2"
                >
                  {LEVELS.map((lv) => (
                    <option key={lv} value={lv}>{lv}</option>
                  ))}
                </select>
              </div>

              <div className="col-span-12 sm:col-span-4">
                <div className="text-xs text-gray-500 mb-1">ปี</div>
                <input
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2"
                  placeholder="2025"
                />
              </div>
            </div>

            {/* ชื่อแหล่งตีพิมพ์ + ลิงก์/DOI */}
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 sm:col-span-6">
                <div className="text-xs text-gray-500 mb-1">แหล่งตีพิมพ์ (เช่น ชื่อวารสาร/งานประชุม)</div>
                <input
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2"
                  placeholder="เช่น IEEE Access / ICAI 2025 / Springer"
                />
              </div>
              <div className="col-span-12 sm:col-span-6">
                <div className="text-xs text-gray-500 mb-1">ลิงก์ / DOI</div>
                <input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2"
                  placeholder="https://doi.org/..."
                />
              </div>

              {/* อัปโหลด PDF */}
              <div className="col-span-12">
                <div className="text-xs text-gray-500 mb-1">อัปโหลดไฟล์ PDF</div>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    ref={pdfInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={onPickPdf}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => pdfInputRef.current?.click()}
                    className="px-3 py-2 rounded-lg border bg-gray-50 text-sm hover:bg-gray-100"
                  >
                    เลือกไฟล์ PDF
                  </button>

                  {pdfFile && (
                    <div className="flex items-center gap-2 text-sm bg-zinc-50 border rounded-lg px-2 py-1">
                      <span className="truncate max-w-[320px]" title={pdfFile.name}>
                        {pdfFile.name} <span className="text-xs text-zinc-500">({prettySize(pdfFile)})</span>
                      </span>
                      <button
                        type="button"
                        onClick={clearPdf}
                        className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 text-xs"
                      >
                        ลบไฟล์
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* บทคัดย่อ */}
            <div>
              <div className="text-xs text-gray-500 mb-1">บทคัดย่อ (Abstract)</div>
              <textarea
                value={abstractText}
                onChange={(e) => setAbstractText(e.target.value)}
                rows={6}
                className="w-full border rounded-xl px-3 py-2"
                placeholder="สรุปแนวคิด วิธีการ และผลลัพธ์สำคัญของงาน..."
              />
            </div>

            {/* categories (เลือกจากฐานข้อมูลเท่านั้น) */}
            <div>
              <div className="text-xs text-gray-500 mb-1">หมวดหมู่</div>

              {/* chips ของรายการที่เลือก */}
              {selectedCats.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {selectedCats.map((name) => (
                    <span key={name} className="inline-flex items-center gap-1 text-xs bg-zinc-50 border rounded-full px-2 py-1">
                      {name}
                      <button
                        type="button"
                        onClick={() => removeCategory(name)}
                        className="text-rose-600 hover:text-rose-700"
                        aria-label={`remove ${name}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* search + list */}
              <div className="relative">
                <input
                  value={catQuery}
                  onChange={(e) => { setCatQuery(e.target.value); setCatOpen(true); }}
                  onFocus={() => setCatOpen(true)}
                  onBlur={() => setTimeout(() => setCatOpen(false), 150)}
                  placeholder="พิมพ์เพื่อค้นหาหมวดหมู่ที่มีอยู่..."
                  className="w-full border rounded-xl px-3 py-2"
                />
                {catOpen && (
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
                        className="w-full border rounded-lg px-2 h-9"
                        placeholder="Assoc. Prof. Somchai"
                      />
                      {(suggestions[idx]?.length ?? 0) > 0 && (
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
                      className="col-span-3 border rounded-lg px-2 h-9"
                      placeholder="name@example.com"
                    />

                    <div className="col-span-2">
                      <select
                        value={a.person_type}
                        onChange={(e) => updateAuthor(idx, { person_type: e.target.value as any })}
                        className="border rounded-lg px-2 h-9 text-xs w-full min-w-[132px] max-w-[160px]"
                      >
                        {PERSON_TYPES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-1">
                      <select
                        value={a.role}
                        onChange={(e) => updateAuthor(idx, { role: e.target.value as any })}
                        className="border rounded-lg px-2 h-9 text-xs w-full min-w-[96px] max-w-[120px]"
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>

                    <div className="col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeAuthor(idx)}
                        className="px-2 py-1 rounded-lg bg-rose-100 text-rose-700 text-xs"
                      >
                        ลบ
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-2">
                <button type="button" onClick={addAuthor} className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm">
                  + เพิ่มผู้เขียน
                </button>
              </div>
            </div>

            {/* actions */}
            <div className="pt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={disabled}
                onClick={() => submit('draft')}
                className="px-4 py-2 rounded-lg bg-slate-800 text-white disabled:opacity-60"
              >
                บันทึกฉบับร่าง
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => submit('under_review')}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-60"
              >
                ส่งตรวจ
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => router.push('/professor/dashboard')}
                className="px-4 py-2 rounded-lg border"
              >
                ยกเลิก
              </button>
            </div>

            {error && (
              <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
