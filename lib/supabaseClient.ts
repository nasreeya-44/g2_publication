import { createBrowserClient } from '@supabase/ssr';

export function supabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!url || !anonKey) {
    console.error('Missing Supabase ENV vars', { url, anonKey });
    throw new Error('Supabase ENV not loaded');
  }

  return createBrowserClient(url, anonKey);
}