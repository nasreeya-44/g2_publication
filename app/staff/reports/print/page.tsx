'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type Person = { full_name: string | null; person_type?: string | null } | null;
type PubPerson = { person: Person } | null;

type Pub = {
  pub_id: number;
  pub_name: string | null;
  year: number | null;
  status: string | null;
  level: string | null;
  has_pdf?: boolean | null;
  updated_at?: string | null;
  publication_person?: PubPerson[];   // รายชื่อผู้แต่ง
  categories?: string[];              // ชื่อหมวดหมู่ (ถ้ามี)
};

export default function PrintReportPage() {
  const sp = useSearchParams();
  const [rows, setRows] = useState<Pub[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [autoPrintDone, setAutoPrintDone] = useState(false);

  const queryString = useMemo(() => {
    const params = new URLSearchParams(sp as any);
    return params.toString();
  }, [sp]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/staff/reports/export/json?${queryString}`, { cache: 'no-store' });
        const j = await res.json();
        if (!res.ok || j?.ok === false) throw new Error(j?.message || 'load failed');
        if (alive) setRows(j.pubs || []);
      } catch (e: any) {
        if (alive) setErr(e?.message || 'โหลดข้อมูลไม่สำเร็จ');
      }
    })();
    return () => { alive = false; };
  }, [queryString]);

  // เรียกหน้าพิมพ์อัตโนมัติเมื่อโหลดเสร็จ
  useEffect(() => {
    if (rows && !autoPrintDone) {
      // เว้น 200ms ให้เบราว์เซอร์เรนเดอร์ก่อน แล้วค่อยสั่งพิมพ์
      const t = setTimeout(() => {
        try { window.print(); } catch {}
        setAutoPrintDone(true);
      }, 200);
      return () => clearTimeout(t);
    }
  }, [rows, autoPrintDone]);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* สไตล์สำหรับพิมพ์ */}
      <style>{`
        @page { size: A4; margin: 16mm; }
        @media print {
          .no-print { display: none !important; }
          body { background: #fff; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          .print-title { margin-top: 0; }
        }
        .container { max-width: 960px; margin: 0 auto; padding: 16px; }
        .badge { display:inline-block; padding:2px 8px; font-size:11px; border-radius:9999px; border:1px solid #e5e7eb; background:#f9fafb; color:#374151; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border-bottom: 1px solid #e5e7eb; padding: 8px; vertical-align: top; }
        th { text-align: left; color: #6b7280; font-weight: 600; font-size: 12px; }
        td { font-size: 13px; }
        h1 { font-size: 20px; font-weight: 700; }
        .meta { color:#6b7280; font-size:12px; }
      `}</style>

      <div className="container">
        <div className="no-print" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <div className="text-sm text-gray-600">หน้านี้ถูกออกแบบให้ “พิมพ์เป็น PDF” โดยใช้ Command/Ctrl + P</div>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="px-3 py-1.5 rounded border">
              พิมพ์ / บันทึกเป็น PDF
            </button>
            <button onClick={() => window.close()} className="px-3 py-1.5 rounded border">
              ปิดหน้าต่าง
            </button>
          </div>
        </div>

        <h1 className="print-title">รายงานผลงานตีพิมพ์</h1>

        {/* แสดงพารามิเตอร์ที่ใช้ค้นหา */}
        <div className="meta" style={{ marginBottom: 8 }}>
          {Array.from(sp.entries()).map(([k, v], i) => (
            <span key={i} style={{ marginRight: 8 }} className="badge">{k}={v}</span>
          ))}
        </div>

        {err && (
          <div className="no-print" style={{ color:'#b91c1c', marginTop: 12 }}>
            เกิดข้อผิดพลาด: {err}
          </div>
        )}

        {!rows ? (
          <div style={{ marginTop: 12 }}>กำลังโหลด…</div>
        ) : rows.length === 0 ? (
          <div style={{ marginTop: 12, color:'#6b7280' }}>ไม่พบข้อมูล</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{width:60}}>ลำดับ</th>
                <th>ชื่อเรื่อง</th>
                <th style={{width:120}}>ปี</th>
                <th style={{width:150}}>ระดับ</th>
                <th style={{width:150}}>สถานะ</th>
                <th style={{width:260}}>ผู้แต่ง</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => {
                const authors = (p.publication_person ?? [])
                  .map(pp => pp?.person?.full_name)
                  .filter(Boolean)
                  .join(', ');
                return (
                  <tr key={p.pub_id}>
                    <td>{i + 1}</td>
                    <td>{p.pub_name ?? '—'}</td>
                    <td>{p.year ?? '—'}</td>
                    <td>{p.level ?? '—'}</td>
                    <td>{p.status ?? '—'}</td>
                    <td>{authors || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div className="meta" style={{ marginTop: 8 }}>
          พิมพ์เมื่อ: {new Date().toLocaleString('th-TH')}
        </div>
      </div>
    </div>
  );
}