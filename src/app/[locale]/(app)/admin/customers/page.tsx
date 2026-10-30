import { getTranslations } from 'next-intl/server';
import { PhasePlaceholder } from '@/components/phase-placeholder';

export async function generateMetadata() {
  const t = await getTranslations('pages');
  return { title: t('customers.title') };
}

export default function CustomersPage() {
  return <PhasePlaceholder page="customers" />;
}
