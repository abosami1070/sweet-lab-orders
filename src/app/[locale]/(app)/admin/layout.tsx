import { setRequestLocale } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { requireRole } from '@/lib/auth';

export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const profile = await requireRole(locale, ['admin', 'super_admin']);
  return <AppShell profile={profile}>{children}</AppShell>;
}
