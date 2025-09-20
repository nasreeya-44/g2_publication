// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SESSION_SECRET = process.env.SESSION_SECRET!;

async function verify(token: string) {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(SESSION_SECRET));
    return payload as { user_id: number; username: string; role: 'ADMIN' | 'STAFF' | 'PROFESSOR' };
  } catch {
    return null;
  }
}

// กำหนดสิทธิ์ต่อเส้นทาง
function canAccess(pathname: string, role: string) {
  if (pathname.startsWith('/admin'))     return role === 'ADMIN';
  if (pathname.startsWith('/staff'))     return role === 'STAFF' || role === 'ADMIN';
  if (pathname.startsWith('/professor')) return role === 'PROFESSOR' || role === 'ADMIN';
  return true; // หน้าอื่น ๆ ไม่ล็อก
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ไม่เช็คหน้า login และ public assets
  if (pathname.startsWith('/login') || pathname.startsWith('/_next') || pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  const token = req.cookies.get('app_session')?.value;
  if (!token) {
    // ต้องล็อกอินก่อน ถ้าจะเข้าโซนที่ต้องล็อกอิน (เช่น dashboard)
    if (pathname.startsWith('/admin') || pathname.startsWith('/staff') || pathname.startsWith('/professor')) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  const payload = await verify(token);
  if (!payload) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // ตรวจ role
  if (!canAccess(pathname, payload.role)) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/(.*)'],
};
