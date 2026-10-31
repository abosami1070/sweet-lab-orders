import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/forms';
import { riyadhToday } from '@/lib/format';
import { PageHeader, Section } from '@/components/ui/page-parts';
import { ProductForm, type CategoryOption, type ProductRow } from '../product-form';
import { CapacityOverrides, type OverrideRow } from './capacity-overrides';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getLocale();
  const t = await getTranslations('admin.products');
  if (!isUuid(id)) return { title: t('title') };
  const supabase = await createClient();
  const { data } = await supabase.from('products').select('name_ar, name_en').eq('id', id).maybeSingle<{ name_ar: string; name_en: string }>();
  return { title: data ? (locale === 'ar' ? data.name_ar : data.name_en) : t('title') };
}

export default async function ProductPage({
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
  const t = await getTranslations('admin.products');
  const supabase = await createClient();

  const [{ data: product }, { data: cats }, { data: overrides }] = await Promise.all([
    supabase
      .from('products')
      .select('id, category_id, sku, name_ar, name_en, description_ar, description_en, unit, min_quantity, quantity_step, prep_minutes, lead_days, daily_capacity, sort_order, is_active')
      .eq('id', id)
      .maybeSingle<ProductRow>(),
    supabase.from('product_categories').select('id, name_ar, name_en, is_active').order('sort_order'),
    supabase
      .from('product_capacity_overrides')
      .select('capacity_date, max_quantity')
      .eq('product_id', id)
      .gte('capacity_date', riyadhToday())
      .order('capacity_date')
  ]);
  if (!product) notFound();

  // التصنيفات المفعّلة + تصنيف المنتج الحالي حتى لو أُوقف
  const categories = ((cats ?? []) as (CategoryOption & { is_active: boolean })[]).filter(
    (c) => c.is_active || c.id === product.category_id
  );

  return (
    <section className="max-w-3xl">
      <PageHeader
        title={locale === 'ar' ? product.name_ar : product.name_en}
        description={locale === 'ar' ? product.name_en : product.name_ar}
        back={{ href: '/admin/products', label: t('title') }}
      />
      {created && (
        <div role="status" className="mb-4 flex items-center gap-3 rounded-card border border-success bg-surface p-4 font-bold">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden />
          {t('createdTitle')}
        </div>
      )}
      <ProductForm product={product} categories={categories} />

      <Section title={t('overridesTitle')} description={t('overridesDescription')}>
        <CapacityOverrides productId={product.id} unit={product.unit} overrides={(overrides ?? []) as OverrideRow[]} />
      </Section>
    </section>
  );
}
