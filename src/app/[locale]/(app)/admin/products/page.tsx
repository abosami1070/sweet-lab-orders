import { getTranslations } from 'next-intl/server';
import { PhasePlaceholder } from '@/components/phase-placeholder';

export async function generateMetadata() {
  const t = await getTranslations('pages');
  return { title: t('products.title') };
}

export default function ProductsPage() {
  return <PhasePlaceholder page="products" />;
}
