// app/professor/layout.tsx
import { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { createClient } from '@supabase/supabase-js';

import ProfessorSidebar from '@/components/professor/ProfessorSidebar';
import ProfessorTopbar from '@/components/professor/ProfessorTopbar';

type TokenPayload = {
  user_id: number;
  username: string;
  role: 'ADMIN' | 'STAFF' | 'PROFESSOR';
};

type DbUser = {
  user_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  profile_image: string | null;
  role: 'ADMIN' | 'STAFF' | 'PROFESSOR';
};

type Me = {
  user_id: number;
  username: string;
  role: 'ADMIN' | 'STAFF' | 'PROFESSOR';
  full_name?: string | null;
  avatar_url?: string | null;
};

async function getMe(): Promise<Me | null> {
  const token = cookies().get('app_session')?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.SESSION_SECRET!)
    );
    const p = payload as unknown as TokenPayload;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE!
    );

    const { data: row } = await supabase
      .from('users')
      .select('user_id, username, first_name, last_name, profile_image, role')
      .eq('user_id', p.user_id)
      .maybeSingle();

    if (!row) {
      return { user_id: p.user_id, username: p.username, role: p.role };
    }

    const u = row as DbUser;
    const fullName = `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim();

    return {
      user_id: u.user_id,
      username: u.username || p.username,
      role: u.role,
      full_name: fullName || u.username || p.username,
      avatar_url: u.profile_image || null,
    };
  } catch {
    return null;
  }
}

export default async function ProfessorLayout({ children }: { children: ReactNode }) {
  const me = await getMe();
  const displayName = me?.full_name || me?.username || 'Professor';
  const displayRole = me?.role || 'PROFESSOR';
  const avatar =
    me?.avatar_url ||
    `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(me?.username || 'user')}`;

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Topbar แบบไดนามิก */}
      <ProfessorTopbar
        name={displayName}
        role={displayRole}
        avatarUrl={avatar}
        profileHref="/professor/profile"
      />

      {/* Main grid */}
      <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-12 gap-6">
        <aside className="col-span-12 md:col-span-3 lg:col-span-2">
          <ProfessorSidebar />
        </aside>
        <main className="col-span-12 md:col-span-9 lg:col-span-10">{children}</main>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
