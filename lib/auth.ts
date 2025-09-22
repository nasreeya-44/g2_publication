// lib/auth.ts
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

/* -------------------------------------------------------
 *  Low-level cookie utils
 * ----------------------------------------------------- */
function parseCookie(raw: string, name: string) {
  const m = raw.split(/;\s*/).find((p) => p.startsWith(name + '='));
  return m?.split('=')[1];
}

function baseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
}

function redirectLogin() {
  throw NextResponse.redirect(new URL('/login', baseUrl()));
}
function redirectHome() {
  throw NextResponse.redirect(new URL('/', baseUrl()));
}

/* -------------------------------------------------------
 *  Session helpers (shared)
 * ----------------------------------------------------- */
export type SessionPayload = {
  user_id: number;
  username: string;
  role: 'ADMIN' | 'STAFF' | 'PROFESSOR';
};

async function decodeToken(token?: string | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.SESSION_SECRET!)
    );
    const p = payload as any;
    if (!p?.user_id || !p?.role) return null;
    return { user_id: p.user_id, username: p.username, role: p.role };
  } catch {
    return null;
  }
}

/** อ่าน session จาก header `cookie` (ใช้ใน Server Component / route.ts ที่มี headers()) */
export async function getSessionFromHeaders(h: Headers): Promise<SessionPayload | null> {
  const token = parseCookie(h.get('cookie') || '', 'app_session');
  return decodeToken(token);
}

/** อ่าน user_id จากคุกกี้ใน NextRequest (ใช้ใน API routes) */
export async function getSessionUserId(req: NextRequest): Promise<number | null> {
  const token = req.cookies.get('app_session')?.value;
  const sess = await decodeToken(token);
  return sess?.user_id ?? null;
}

/** อ่าน session เต็มจาก NextRequest (ใช้ใน API routes) */
export async function getSessionFromRequest(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get('app_session')?.value;
  return decodeToken(token);
}

/* -------------------------------------------------------
 *  Guards with Redirect (throw NextResponse.redirect)
 * ----------------------------------------------------- */

/** เดิม: ใช้ในหน้า admin เท่านั้น */
export async function verifyAdminOrRedirect(h: Headers) {
  const token = parseCookie(h.get('cookie') || '', 'app_session');
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

/** ใหม่: ตรวจสิทธิ์ตามรายชื่อ role ที่อนุญาต เช่น ['ADMIN','STAFF'] */
export async function verifyRoleOrRedirect(h: Headers, allowed: Array<SessionPayload['role']>) {
  const sess = await getSessionFromHeaders(h);
  if (!sess) return redirectLogin();
  if (!allowed.includes(sess.role)) return redirectHome();
  return true;
}

/** ใหม่: ต้องล็อกอินเท่านั้น (role ใดก็ได้) */
export async function verifyLoggedInOrRedirect(h: Headers) {
  const sess = await getSessionFromHeaders(h);
  if (!sess) return redirectLogin();
  return true;
}

/** ใหม่: helper ตรวจ role แบบเฉพาะทาง */
export async function verifyProfessorOrRedirect(h: Headers) {
  return verifyRoleOrRedirect(h, ['PROFESSOR', 'ADMIN']);
}
export async function verifyStaffOrRedirect(h: Headers) {
  return verifyRoleOrRedirect(h, ['STAFF', 'ADMIN']);
