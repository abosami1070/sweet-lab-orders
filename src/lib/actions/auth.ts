'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { homeFor } from '@/lib/nav';
import { routing } from '@/i18n/routing';
import type { AppRole } from '@/types/app';

export type SignInError =
  | 'emailRequired' | 'emailInvalid' | 'passwordRequired' | 'invalidCredentials'
  | 'inactiveAccount' | 'rateLimited' | 'network' | 'generic';

export type SignInState = {
  error?: SignInError;
  field?: 'email' | 'password';
  email?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// يمنع إعادة التوجيه لموقع خارجي: مسار داخلي بسيط فقط
const SAFE_PATH_RE = /^\/[a-z0-9\-/]*$/i;

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '');

  if (!email) return { error: 'emailRequired', field: 'email', email };
  if (!EMAIL_RE.test(email)) return { error: 'emailInvalid', field: 'email', email };
  if (!password) return { error: 'passwordRequired', field: 'password', email };

  const supabase = await createClient();
  let userId: string;
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.status === 429) return { error: 'rateLimited', email };
      if (error.status === 400 || error.code === 'invalid_credentials') return { error: 'invalidCredentials', email };
      return { error: 'generic', email };
    }
    userId = data.user.id;
  } catch {
    return { error: 'network', email };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, preferred_locale, is_active')
    .eq('id', userId)
    .single<{ role: AppRole; preferred_locale: string; is_active: boolean }>();

  if (!profile?.is_active) {
    await supabase.auth.signOut();
    return { error: 'inactiveAccount', email };
  }

  // اللغة المحفوظة للمستخدم تحدد واجهة ما بعد الدخول
  const locale = (routing.locales as readonly string[]).includes(profile.preferred_locale)
    ? profile.preferred_locale
    : routing.defaultLocale;
  const target = next && SAFE_PATH_RE.test(next) && !next.startsWith('//') ? next : homeFor(profile.role);

  redirect(`/${locale}${target}`);
}

export async function signOut(formData: FormData) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const locale = String(formData.get('locale') ?? routing.defaultLocale);
  redirect(`/${(routing.locales as readonly string[]).includes(locale) ? locale : routing.defaultLocale}/login`);
}
