import { createBrowserClient } from '@supabase/ssr';

// عميل المتصفح: يستخدم المفتاح العام فقط، والصلاحيات تفرضها سياسات RLS
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
