import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { CheckCircle2, ChevronLeft, UserPlus, Users } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/forms';
import { ActiveBadge, EmptyState, PageHeader, Section } from '@/components/ui/page-parts';
import { CustomerForm, type CustomerRow } from '../customer-form';
import { Branches, type BranchRow } from './branches';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getLocale();
  const t = await getTranslations('admin.customers');
  if (!isUuid(id)) return { title: t('title') };
  const supabase = await createClient();
  const { data } = await supabase.from('customers').select('name_ar, name_en').eq('id', id).maybeSingle<{ name_ar: string; name_en: string }>();
  return { title: data ? (locale === 'ar' ? data.name_ar : data.name_en) : t('title') };
}

export default async function CustomerPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;
  if (!isUuid(id)) notFound();

  const locale = await getLocale();
  const t = await getTranslations('admin.customers');
  const tc = await getTranslations('admin.common');
  const tr = await getTranslations('roles');
  const supabase = await createClient();

  const [{ data: customer }, { data: branches }, { data: accounts }] = await Promise.all([
    supabase.from('customers').select('id, name_ar, name_en, contact_name, phone, is_active').eq('id', id).maybeSingle<CustomerRow>(),
    supabase
      .from('customer_branches')
      .select('id, name_ar, name_en, address, phone, is_active')
      .eq('customer_id', id)
      .order('is_active', { ascending: false })
      .order('created_at'),
    supabase.from('profiles').select('id, full_name, role, is_active').eq('customer_id', id).order('full_name')
  ]);
  if (!customer) notFound();

  const name = locale === 'ar' ? customer.name_ar : customer.name_en;
  const users = (accounts ?? []) as { id: string; full_name: string; role: 'customer'; is_active: boolean }[];
  const addAccount = (
    <Link href={`/admin/users/new?customer=${customer.id}`} className="btn-ghost">
      <UserPlus className="h-4 w-4" aria-hidden />
      {t('addAccount')}
    </Link>
  );

  return (
    <section className="max-w-3xl">
      <PageHeader
        title={name}
        description={locale === 'ar' ? customer.name_en : customer.name_ar}
        back={{ href: '/admin/customers', label: t('title') }}
        action={<ActiveBadge active={customer.is_active} labels={{ on: tc('active'), off: tc('inactive') }} />}
      />

      {created && (
        <div role="status" className="mb-4 flex items-start gap-3 rounded-card border border-success bg-surface p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
          <div>
            <p className="font-bold">{t('createdTitle')}</p>
            <p className="text-sm text-ink-muted">{t('createdBody')}</p>
          </div>
        </div>
      )}

      <CustomerForm customer={customer} />

      <Section title={t('branchesTitle')} description={t('branchesDescription')}>
        <Branches customerId={customer.id} branches={(branches ?? []) as BranchRow[]} />
      </Section>

      <Section title={t('accountsTitle')} description={t('accountsDescription')} action={users.length > 0 ? addAccount : undefined}>
        {users.length === 0 ? (
          <EmptyState icon={<Users className="h-6 w-6" aria-hidden />} title={t('noAccountsTitle')} body={t('noAccountsBody')} action={addAccount} />
        ) : (
          <ul className="card divide-y divide-line">
            {users.map((u) => (
              <li key={u.id}>
                <Link href={`/admin/users/${u.id}`} className="flex min-h-touch-lg items-center gap-3 px-4 py-3 hover:bg-primary-soft">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{u.full_name || tr(u.role)}</span>
                  </span>
                  <ActiveBadge active={u.is_active} labels={{ on: tc('active'), off: tc('inactive') }} />
                  <ChevronLeft className="h-5 w-5 text-ink-muted ltr:-scale-x-100" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </section>
  );
}
