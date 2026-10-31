import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-parts';
import { ProductForm, type CategoryOption } from '../product-form';

export async function generateMetadata() {
  const t = await getTranslations('admin.products');
  return { title: t('add') };
}

export default async function NewProductPage() {
  const t = await getTranslations('admin.products');
  const supabase = await createClient();
  const { data } = await supabase.from('product_categories').select('id, name_ar, name_en').eq('is_active', true).order('sort_order');
  return (
    <section className="max-w-3xl">
      <PageHeader title={t('add')} description={t('addDescription')} back={{ href: '/admin/products', label: t('title') }} />
      <ProductForm categories={(data ?? []) as CategoryOption[]} />
    </section>
  );
}
