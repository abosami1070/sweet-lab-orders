import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { hasServiceKey } from '@/lib/supabase/admin';
import { getCurrentProfile } from '@/lib/auth';
import { isUuid } from '@/lib/forms';
import { redirect } from '@/i18n/navigation';
import { PageHeader } from '@/components/ui/page-parts';
import { CreateUserForm, type ShopOption } from '../user-forms';
import type { AppRole } from '@/types/app';

export async function generateMetadata() {
  const t = await getTranslations('admin.users');
  return { title: t('add') };
}

export default async function NewUserPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ customer?: string }>;
}) {
  const { locale } = await params;
  const { customer } = await searchParams;
  if (!hasServiceKey()) return redirect({ href: '/admin/users', locale });

  const t = await getTranslations('admin.users');
  const me = (await getCurrentProfile())!;
  const supabase = await createClient();
  const { data } = await supabase.from('customers').select('id, name_ar, name_en, is_active').order('is_active', { ascending: false }).order(locale === 'ar' ? 'name_ar' : 'name_en');
  const shops = (data ?? []) as ShopOption[];
  // المشرف العام يرى العميل أولاً لأنه الأكثر استخداماً
  const roles: AppRole[] = me.role === 'super_admin' ? ['customer', 'kitchen_staff', 'admin', 'super_admin'] : ['customer'];
  const defaultCustomer = customer && isUuid(customer) ? customer : undefined;

  return (
    <section className="max-w-3xl">
      <PageHeader title={t('add')} description={t('addDescription')} back={{ href: '/admin/users', label: t('title') }} />
      <CreateUserForm roles={roles} shops={shops} defaultCustomer={defaultCustomer} />
    </section>
  );
}
