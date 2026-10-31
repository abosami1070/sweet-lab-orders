import { getLocale, getTranslations } from 'next-intl/server';
import { ChevronLeft, Plus, Store } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { displayPhone } from '@/lib/forms';
import { formatNumber } from '@/lib/format';
import { ActiveBadge, EmptyState, PageHeader } from '@/components/ui/page-parts';

export async function generateMetadata() {
  const t = await getTranslations('admin.customers');
  return { title: t('title') };
}

type Row = {
  id: string;
  name_ar: string;
  name_en: string;
  contact_name: string | null;
  phone: string | null;
  is_active: boolean;
  customer_branches: { count: number }[];
  profiles: { count: number }[];
};

// قائمة المحلات: المفعّلة أولاً ثم الموقوفة
export default async function CustomersPage() {
  const locale = await getLocale();
  const t = await getTranslations('admin.customers');
  const tc = await getTranslations('admin.common');
  const supabase = await createClient();
  const { data } = await supabase
    .from('customers')
    .select('id, name_ar, name_en, contact_name, phone, is_active, customer_branches(count), profiles(count)')
    .order('is_active', { ascending: false })
    .order(locale === 'ar' ? 'name_ar' : 'name_en');
  const rows = (data ?? []) as unknown as Row[];

  const addButton = (
    <Link href="/admin/customers/new" className="btn-primary">
      <Plus className="h-4 w-4" aria-hidden />
      {t('add')}
    </Link>
  );

  return (
    <section>
      <PageHeader title={t('title')} description={t('description')} action={rows.length > 0 ? addButton : undefined} />

      {rows.length === 0 ? (
        <EmptyState icon={<Store className="h-6 w-6" aria-hidden />} title={t('emptyTitle')} body={t('emptyBody')} action={addButton} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/customers/${c.id}`} className="card flex h-full items-start gap-3 p-4 hover:border-primary">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-primary-soft">
                  <Store className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-bold">{locale === 'ar' ? c.name_ar : c.name_en}</span>
                    {!c.is_active && <ActiveBadge active={false} labels={{ on: tc('active'), off: tc('inactive') }} />}
                  </span>
                  <span className="block truncate text-sm text-ink-muted">{locale === 'ar' ? c.name_en : c.name_ar}</span>
                  <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
                    {c.contact_name && <span>{c.contact_name}</span>}
                    {c.phone && <span dir="ltr">{displayPhone(c.phone)}</span>}
                    <span>{t('branchesCount', { count: c.customer_branches[0]?.count ?? 0, n: formatNumber(locale, c.customer_branches[0]?.count ?? 0) })}</span>
                    <span>{t('accountsCount', { count: c.profiles[0]?.count ?? 0, n: formatNumber(locale, c.profiles[0]?.count ?? 0) })}</span>
                  </span>
                </span>
                <ChevronLeft className="mt-3 h-5 w-5 shrink-0 text-ink-muted ltr:-scale-x-100" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
