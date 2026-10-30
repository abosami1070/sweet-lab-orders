import { getTranslations } from 'next-intl/server';
import { PhasePlaceholder } from '@/components/phase-placeholder';

export async function generateMetadata() {
  const t = await getTranslations('pages');
  return { title: t('newOrder.title') };
}

export default function NewOrderPage() {
  return <PhasePlaceholder page="newOrder" />;
}
