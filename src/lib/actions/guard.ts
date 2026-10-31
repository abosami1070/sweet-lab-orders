import 'server-only';
import { revalidatePath } from 'next/cache';
import { getCurrentProfile } from '@/lib/auth';
import type { Profile } from '@/types/app';

// تحقق سريع داخل الإجراء قبل أي كتابة. سياسات RLS في القاعدة تفرض نفس القيد مرة أخرى،
// فهذا الفحص لرسالة واضحة وليس خط الحماية الوحيد.
export async function currentAdmin(): Promise<Profile | null> {
  const profile = await getCurrentProfile();
  if (!profile?.is_active) return null;
  return profile.role === 'admin' || profile.role === 'super_admin' ? profile : null;
}

// بعد أي تعديل إداري: تحديث كل الصفحات المعروضة (البيانات صغيرة والتحديث رخيص)
export const refreshAll = () => revalidatePath('/', 'layout');
