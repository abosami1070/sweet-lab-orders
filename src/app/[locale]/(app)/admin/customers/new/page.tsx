import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui/page-parts';
import { CustomerForm } from '../customer-form';

export async function generateMetadata() {
  const t = await getTranslations('admin.customers');
  return { title: t('add') };
}

export default async function NewCustomerPage() {
  const t = await getTranslations('admin.customers');
  return (
    <section className="max-w-3xl">
      <PageHeader title={t('add')} description={t('addDescription')} back={{ href: '/admin/customers', label: t('title') }} />
      <CustomerForm />
    </section>
  );
}
