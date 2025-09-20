'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// enums ใน DB (publication.status น่าจะเป็นตัวพิมพ์เล็ก)
const LEVELS = ['NATIONAL', 'INTERNATIONAL'] as const;
const TYPES  = ['JOURNAL', 'CONFERENCE', 'BOOK'] as const;

type Author = {
  full_name: string;
  role: 'LEAD' | 'COAUTHOR' | 'CORRESPONDING';
  email?: string;
  affiliation?: string;
};

export default function ProfessorCreatePublicationPage() {
  const router = useRouter();

  // ฟอร์มหลัก
  const [titleTh, setTitleTh] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [type, setType]       = useState<(typeof TYPES)[number]>('JOURNAL'); // ใช้แค่ใน UI
  const [level, setLevel]     = useState<(typeof LEVELS)[number]>('INTERNATIONAL');
  const [year, setYear]       = useState<string>('2025');
  const [venueName, setVenueName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [hasPdf, setHasPdf]   = useState(false);
  const [abstractTh, setAbstractTh] = useState('');
  const [abstractEn, setAbstractEn] = useState('');
  const [categories, setCategories] = useState<string>(''); // รับเป็นคอมม่าคั่น
  const [authors, setAuthors] = useState<Author[]>([
    { full_name: '', role: 'LEAD', email: '', affiliation: '' },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addAuthor() {
    setAuthors((a) => [...a, { full_name: '', role: 'COAUTHOR', email: '', affiliation: '' }]);
  }
  function removeAuthor(idx: number) {
    setAuthors((a) => a.filter((_, i) => i !== idx));
  }
  function updateAuthor(idx: number, patch: Partial<Author>) {
    setAuthors((a) => a.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  }

  async function submit(status: 'draft' | 'under_review') {
    setError(null);
    setSubmitting(true);
    try {
      // เตรียม payload สำหรับ API
      const payload = {
        // fields ของ publication
        level,                               // NATIONAL / INTERNATIONAL
        year: Number(year) || null,
        has_pdf: hasPdf,
        link_url: linkUrl || null,
        venue_name: venueName || null,
        status,                              // draft | under_review
        // ข้อมูลเพิ่มเติม (ไม่จำเป็นต้องมีคอลัมน์ใน publication)
        // ใช้เก็บประกอบเพื่อสร้าง relation ใน API
        categories: categories
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        authors: authors
          .map((a, i) => ({ ...a, author_order: i + 1 }))
          .filter((a) => a.full_name.trim().length > 0),
        // เก็บไว้เผื่อในอนาคต (ถ้าฐานข้อมูลมีคอลัมน์ title_th/title_en ค่อยเพิ่มใน API)
        _extra_titles: { th: titleTh, en: titleEn },
        _extra_type: type,
        _extra_abstracts: { th: abstractTh, en: abstractEn },
      };

      const res = await fetch('/api/professor/publications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'ไม่สามารถบันทึกได้');

      // ไปหน้ารายละเอียด private ของ professor
      router.push(`/professor/publications/${json.pub_id}`);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* top bar */}
      <div className="flex items-center justify-end px-6 py-3 text-sm">
        {/*<div className="font-semibold">U2. สร้างและแก้ไขผลงานตีพิมพ์อาจารย์</div>*/}
        <div className="text-gray-600">ผู้ใช้: somchai (PROFESSOR)</div>
      </div>

      <main className="px-6 pb-10 max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="text-sm font-medium mb-4">สร้างบันทึกผลงานตีพิมพ์</h2>

          {/* รายละเอียดเนื้อหา */}
          <section className="space-y-3">
            <div>
              <div className="text-xs text-gray-500 mb-1">ชื่อเรื่อง (TH)</div>
              <input
                value={titleTh}
                onChange={(e) => setTitleTh(e.target.value)}
                placeholder="ใส่ชื่อผลงานภาษาไทย..."
                className="w-full border rounded-xl px-3 py-2"
              />
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">ชื่อเรื่อง (EN)</div>
              <input
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                placeholder="Enter English title..."
                className="w-full border rounded-xl px-3 py-2"
              />
            </div>

            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 sm:col-span-4">
                <div className="text-xs text-gray-500 mb-1">ประเภท</div>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full border rounded-xl px-3 py-2"
                >
                  {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="col-span-12 sm:col-span-4">
                <div className="text-xs text-gray-500 mb-1">ระดับ</div>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value as any)}
                  className="w-full border rounded-xl px-3 py-2"
                >
                  {LEVELS.map((lv) => <option key={lv} value={lv}>{lv}</option>)}
                </select>
              </div>
              <div className="col-span-12 sm:col-span-4">
                <div className="text-xs text-gray-500 mb-1">ปีที่ตีพิมพ์</div>
                <input
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2"
                  placeholder="2025"
                />
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">แหล่งตีพิมพ์ (Venue)</div>
              <input
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                placeholder="เช่น IEEE Access / ICAI 2025 / Springer"
                className="w-full border rounded-xl px-3 py-2"
              />
            </div>

            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 sm:col-span-8">
                <div className="text-xs text-gray-500 mb-1">ลิงก์/DOI</div>
                <input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://doi.org/..."
                  className="w-full border rounded-xl px-3 py-2"
                />
              </div>
              <div className="col-span-12 sm:col-span-4 flex items-end gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={hasPdf}
                    onChange={(e) => setHasPdf(e.target.checked)}
                  />
                  ไฟล์ PDF
                </label>
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">บทคัดย่อ (TH)</div>
              <textarea
                value={abstractTh}
                onChange={(e) => setAbstractTh(e.target.value)}
                rows={3}
                className="w-full border rounded-xl px-3 py-2"
                placeholder="เนื้อหาสรุปภาษาไทย..."
              />
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">Abstract (EN)</div>
              <textarea
                value={abstractEn}
                onChange={(e) => setAbstractEn(e.target.value)}
                rows={3}
                className="w-full border rounded-xl px-3 py-2"
                placeholder="English abstract..."
              />
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">หมวดหมู่</div>
              <input
                value={categories}
                onChange={(e) => setCategories(e.target.value)}
                placeholder="เพิ่มหมวดหมู่ (AI, Data Science, ...), คั่นด้วยเครื่องหมาย ,"
                className="w-full border rounded-xl px-3 py-2"
              />
            </div>

            {/* ตารางผู้เขียน */}
            <div>
              <div className="text-xs text-gray-500 mb-2">ผู้เขียน / ผู้ร่วมเขียน</div>
              <div className="border rounded-xl overflow-hidden">
                <div className="grid grid-cols-12 text-xs bg-gray-50 px-3 py-2 text-gray-600">
                  <div className="col-span-4">ชื่อ-นามสกุล</div>
                  <div className="col-span-2">ประเภท</div>
                  <div className="col-span-3">อีเมล</div>
                  <div className="col-span-3">สังกัด</div>
                </div>
                {authors.map((a, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 border-t items-center">
                    <input
                      value={a.full_name}
                      onChange={(e) => updateAuthor(idx, { full_name: e.target.value })}
                      className="col-span-4 border rounded-lg px-2 py-1"
                      placeholder="Assoc. Prof. Somchai"
                    />
                    <select
                      value={a.role}
                      onChange={(e) => updateAuthor(idx, { role: e.target.value as any })}
                      className="col-span-2 border rounded-lg px-2 py-1"
                    >
                      <option value="LEAD">LEAD</option>
                      <option value="COAUTHOR">COAUTHOR</option>
                      <option value="CORRESPONDING">CORRESPONDING</option>
                    </select>
                    <input
                      value={a.email || ''}
                      onChange={(e) => updateAuthor(idx, { email: e.target.value })}
                      className="col-span-3 border rounded-lg px-2 py-1"
                      placeholder="somchai@example.ac.th"
                    />
                    <div className="col-span-3 flex gap-2">
                      <input
                        value={a.affiliation || ''}
                        onChange={(e) => updateAuthor(idx, { affiliation: e.target.value })}
                        className="w-full border rounded-lg px-2 py-1"
                        placeholder="Faculty of Science"
                      />
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

            {/* สถานะ + ปุ่มคำสั่ง */}
            <div className="pt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => submit('draft')}
                className="px-4 py-2 rounded-lg bg-slate-800 text-white disabled:opacity-60"
              >
                บันทึกฉบับร่าง
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => submit('under_review')}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-60"
              >
                ส่งตรวจ
              </button>
              <Link href="/professor/dashboard" className="px-4 py-2 rounded-lg bg-gray-100">
                ยกเลิก
              </Link>
            </div>

            {error && <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {error}
            </div>}
            {/*
            <div className="text-xs text-gray-500 mt-6">
              * หมายเหตุ: ตอนสร้างจะบันทึกเฉพาะข้อมูลหลักลงตาราง <code>publication</code> (level, year, has_pdf, link_url, venue_name, status) <br />
              ส่วนชื่อเรื่อง/บทคัดย่อ/ประเภท ถูกส่งไปกับคำขอเพื่อรองรับการขยาย schema ภายหลัง
            </div>
            */}
          </section>
        </div>
      </main>
    </div>
  );
}
