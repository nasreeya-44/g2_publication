import Link from 'next/link';

type Detail = {
  pub_id: number;
  level: string | null;
  year: number | null;
  has_pdf: boolean | null;
  file_path: string | null;
  status: string | null;
  link_url: string | null;
  venue_name: string | null;
  venue_type: string | null;
  created_at: string | null;
  updated_at: string | null;
  authors: { name: string; email: string | null; affiliation: string | null; order: number | null; role: string | null }[];
  categories: string[];
};

async function fetchDetail(id: string) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const res = await fetch(`${base}/api/publications/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return (await res.json()) as Detail;
}

export default async function PublicationDetailPage({ params }: { params: { id: string } }) {
  const detail = await fetchDetail(params.id);
  if (!detail) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <div className="mb-4">
            <Link href="/" className="text-sm text-blue-600 hover:underline">
              ← กลับสู่หน้าค้นหา
            </Link>
          </div>
          <div className="bg-white rounded-xl shadow p-8 text-center text-gray-600">
            ไม่พบรายการที่ต้องการ
          </div>
        </div>
      </div>
    );
  }

  const title = detail.venue_name || `Publication #${detail.pub_id}`;
  const rightTags = [
    detail.level ? `ประเภท: ${detail.level}` : null,
    detail.year ? `ปี: ${detail.year}` : null,
    detail.has_pdf ? 'มี PDF' : null,
    detail.status ? `สถานะ: ${detail.status}` : null,
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            ← กลับสู่หน้าค้นหา
          </Link>
          <Link href="/login" className="text-sm text-gray-600 hover:underline">
            เข้าสู่ระบบ
          </Link>
        </div>

        {/* Header card */}
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h1 className="text-xl font-semibold">{title}</h1>
          <div className="mt-2 text-sm text-gray-600 flex flex-wrap gap-2">
            {rightTags.map((t, i) => (
              <span key={i} className="px-2 py-1 rounded-lg bg-gray-100">{t}</span>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            {detail.link_url && (
              <a
                href={detail.link_url}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
              >
                เปิดลิงก์
              </a>
            )}
            {detail.has_pdf && detail.file_path && (
              <a
                href={detail.file_path}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm hover:bg-slate-900"
              >
                เปิดไฟล์ PDF
              </a>
            )}
          </div>
        </div>

        {/* Body grid */}
        <div className="grid grid-cols-12 gap-4">
          {/* Left: authors & categories */}
          <div className="col-span-12 md:col-span-8">
            <div className="bg-white rounded-xl shadow p-6 mb-4">
              <h2 className="font-semibold mb-3">ผู้เขียน</h2>
              {detail.authors.length === 0 ? (
                <div className="text-sm text-gray-600">—</div>
              ) : (
                <ol className="list-decimal pl-5 space-y-1">
                  {detail.authors.map((a, i) => (
                    <li key={i} className="text-sm">
                      <span className="font-medium">{a.name}</span>
                      {a.affiliation ? <span className="text-gray-600"> — {a.affiliation}</span> : null}
                      {a.role ? <span className="text-gray-500"> ({a.role})</span> : null}
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="font-semibold mb-3">หมวดหมู่</h2>
              {detail.categories.length === 0 ? (
                <div className="text-sm text-gray-600">—</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {detail.categories.map((c, i) => (
                    <span key={i} className="px-2 py-1 rounded-lg bg-gray-100 text-sm">{c}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: meta */}
          <div className="col-span-12 md:col-span-4">
            <div className="bg-white rounded-xl shadow p-6 sticky top-4">
              <h2 className="font-semibold mb-3">รายละเอียด</h2>
              <dl className="text-sm text-gray-700 space-y-2">
                <div className="flex justify-between"><dt className="text-gray-500">ปี</dt><dd>{detail.year ?? '—'}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">ประเภท</dt><dd>{detail.level ?? '—'}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Venue</dt><dd>{detail.venue_name ?? '—'}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Venue Type</dt><dd>{detail.venue_type ?? '—'}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">สถานะ</dt><dd>{detail.status ?? '—'}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">สร้างเมื่อ</dt><dd>{detail.created_at ? new Date(detail.created_at).toLocaleString() : '—'}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">แก้ไขเมื่อ</dt><dd>{detail.updated_at ? new Date(detail.updated_at).toLocaleString() : '—'}</dd></div>
              </dl>
            </div>
          </div>
        </div>

        <div className="text-right mt-6">
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            ◄ กลับสู่หน้าค้นหา
          </Link>
        </div>
      </div>
    </div>
  );
}
