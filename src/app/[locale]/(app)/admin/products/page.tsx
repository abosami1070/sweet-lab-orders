import { getLocale, getTranslations } from 'next-intl/server';
import { CakeSlice, ChevronLeft, Plus } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatNumber } from '@/lib/format';
import { ActiveBadge, EmptyState, PageHeader, Section } from '@/components/ui/page-parts';
import { Categories, type CategoryRow } from './categories';
import type { ProductUnit } from '@/types/app';

export async function generateMetadata() {
  const t = await getTranslations('admin.products');
  return { title: t('title') };
}

type Product = {
  id: string;
  category_id: string | null;
  sku: string | null;
  name_ar: string;
  name_en: string;
  unit: ProductUnit;
  min_quantity: number;
  lead_days: number;
  daily_capacity: number | null;
  is_active: boolean;
};

export default async function ProductsPage() {
  const locale = await getLocale();
  const t = await getTranslations('admin.products');
  const tc = await getTranslations('admin.common');
  const tu = await getTranslations('units');
  const supabase = await createClient();

  const [{ data: cats }, { data: prods }] = await Promise.all([
    supabase.from('product_categories').select('id, name_ar, name_en, sort_order, is_active').order('sort_order').order('created_at'),
    supabase
      .from('products')
      .select('id, category_id, sku, name_ar, name_en, unit, min_quantity, lead_days, daily_capacity, is_active')
      .order('is_active', { ascending: false })
      .order('sort_order')
      .order(locale === 'ar' ? 'name_ar' : 'name_en')
  ]);
  const products = (prods ?? []) as Product[];
  const categories = ((cats ?? []) as Omit<CategoryRow, 'products'>[]).map((c) => ({
    ...c,
    products: products.filter((p) => p.category_id === c.id).length
  }));

  // تجميع حسب التصنيف بترتيبه، ثم "بدون تصنيف" في الأخير
  const groups = [
    ...categories.map((c) => ({ key: c.id, title: locale === 'ar' ? c.name_ar : c.name_en, items: products.filter((p) => p.category_id === c.id) })),
    { key: 'none', title: t('noCategory'), items: products.filter((p) => !p.category_id || !categories.some((c) => c.id === p.category_id)) }
  ].filter((g) => g.items.length > 0);

  const addButton = (
    <Link href="/admin/products/new" className="btn-primary">
      <Plus className="h-4 w-4" aria-hidden />
      {t('add')}
    </Link>
  );

  return (
    <section>
      <PageHeader title={t('title')} description={t('description')} action={products.length > 0 ? addButton : undefined} />

      {products.length === 0 ? (
        <EmptyState icon={<CakeSlice className="h-6 w-6" aria-hidden />} title={t('emptyTitle')} body={t('emptyBody')} action={addButton} />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.key}>
              <h2 className="mb-2 text-base text-ink-muted">{g.title}</h2>
              <ul className="card divide-y divide-line">
                {g.items.map((p) => (
                  <li key={p.id}>
                    <Link href={`/admin/products/${p.id}`} className="flex min-h-touch-lg items-center gap-3 px-4 py-3 hover:bg-primary-soft">
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className={`font-bold ${p.is_active ? '' : 'text-ink-muted'}`}>{locale === 'ar' ? p.name_ar : p.name_en}</span>
                          {p.sku && <span dir="ltr" className="rounded bg-line px-1.5 text-xs font-bold text-ink-muted">{p.sku}</span>}
                          {!p.is_active && <ActiveBadge active={false} labels={{ on: tc('active'), off: tc('inactive') }} />}
                        </span>
                        <span className="mt-0.5 flex flex-wrap gap-x-4 text-sm text-ink-muted">
                          <span>{t('summaryMin', { qty: formatNumber(locale, p.min_quantity), unit: tu(p.unit) })}</span>
                          {p.lead_days > 0 && <span>{t('summaryLead', { count: p.lead_days, n: formatNumber(locale, p.lead_days) })}</span>}
                          <span>
                            {p.daily_capacity === null
                              ? t('summaryNoCapacity')
                              : t('summaryCapacity', { qty: formatNumber(locale, p.daily_capacity), unit: tu(p.unit) })}
                          </span>
                        </span>
                      </span>
                      <ChevronLeft className="h-5 w-5 shrink-0 text-ink-muted ltr:-scale-x-100" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <Section title={t('categoriesTitle')} description={t('categoriesDescription')}>
        <Categories categories={categories} />
      </Section>
    </section>
  );
}
