import { getTranslations } from 'next-intl/server';
import { PhasePlaceholder } from '@/components/phase-placeholder';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('pages');
  return { title: t('users.title') };
}

// إدارة المستخدمين للمشرف العام فقط (والقاعدة تفرض نفس القيد في admin_update_profile)
export default async function UsersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireRole(locale, ['super_admin']);
  return <PhasePlaceholder page="users" />;
}
