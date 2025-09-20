'use client';

import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <button
      onClick={handleLogout}
      className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700"
    >
      ออกจากระบบ
    </button>
  );
}
