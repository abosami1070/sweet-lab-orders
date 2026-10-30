'use server';

import { createClient } from '@/lib/supabase/server';
import { routing } from '@/i18n/routing';

// يحفظ اللغة المفضلة في ملف المستخدم (إن كان مسجلاً) لتُستخدم في الدخول التالي
export async function savePreferredLocale(locale: string): Promise<void> {
  if (!(routing.locales as readonly string[]).includes(locale)) return;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('profiles').update({ preferred_locale: locale }).eq('id', user.id);
}
