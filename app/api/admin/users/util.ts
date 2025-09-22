import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

export async function assertAdmin(req: NextRequest) {
  const token = req.cookies.get('app_session')?.value;
  if (!token) throw NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET!));
    const role = (payload as any).role;
    if (role !== 'ADMIN') throw new Error('forbidden');
  } catch {
    throw NextResponse.json({ message: 'forbidden' }, { status: 403 });
  }
}