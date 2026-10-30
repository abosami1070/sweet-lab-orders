import { redirect } from '@/i18n/navigation';
import { requireProfile } from '@/lib/auth';
import { homeFor } from '@/lib/nav';

// المدخل الرئيسي: يوجّه كل مستخدم إلى واجهة دوره
export default async function RootPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const profile = await requireProfile(locale);
  return redirect({ href: homeFor(profile.role), locale });
}
