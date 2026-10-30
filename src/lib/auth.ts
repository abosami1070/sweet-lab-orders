import 'server-only';
import { cache } from 'react';
import { redirect } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { homeFor } from '@/lib/nav';
import type { AppRole, Profile } from '@/types/app';

// يُقرأ مرة واحدة لكل طلب HTTP
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, role, customer_id, preferred_locale, is_active, customer:customers(name_ar, name_en)')
    .eq('id', user.id)
    .single();

  return (data as unknown as Profile) ?? null;
});

export async function requireProfile(locale: string): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_active) {
    return redirect({ href: { pathname: '/login', query: profile ? { error: 'inactiveAccount' } : {} }, locale });
  }
  return profile;
}

// الحارس الخلفي لكل منطقة: الدور غير المناسب يُعاد لصفحته الرئيسية
export async function requireRole(locale: string, roles: AppRole[]): Promise<Profile> {
  const profile = await requireProfile(locale);
  if (!roles.includes(profile.role)) {
    return redirect({ href: homeFor(profile.role), locale });
  }
  return profile;
}
