import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// เรียกจาก Server Component: ส่ง headers() เข้ามา
export async function verifyAdminOrRedirect(h: Headers) {
  const cookie = h.get('cookie') || '';
  const token = parseCookie(cookie, 'app_session');
  if (!token) return redirectLogin();

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.SESSION_SECRET!)
    );
    const role = (payload as any).role;
    if (role !== 'ADMIN') return redirectHome();
    return true;
  } catch {
    return redirectLogin();
  }
}

function parseCookie(raw: string, name: string) {
  const m = raw.split(/;\s*/).find((p) => p.startsWith(name + '='));
  return m?.split('=')[1];
}

function redirectLogin() {
  throw NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
}
function redirectHome() {
  throw NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
}