import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { riyadhToday } from '@/lib/format';
import { PageHeader, Section } from '@/components/ui/page-parts';
import { ClosedDates, DeliveryWindows, GeneralSettingsForm, type ClosedRow, type WindowRow } from './settings-forms';

export async function generateMetadata() {
  const t = await getTranslations('admin.settings');
  return { title: t('title') };
}

export default async function SettingsPage() {
  const t = await getTranslations('admin.settings');
  const supabase = await createClient();

  const [{ data: settings }, { data: windows }, { data: closed }] = await Promise.all([
    supabase.from('app_settings').select('same_day_cutoff, max_days_ahead').eq('id', true).maybeSingle<{ same_day_cutoff: string; max_days_ahead: number }>(),
    supabase.from('delivery_windows').select('id, label_ar, label_en, start_time, end_time, sort_order, is_active').order('sort_order').order('start_time'),
    supabase.from('closed_dates').select('closed_date, reason_ar, reason_en').gte('closed_date', riyadhToday()).order('closed_date')
  ]);

  return (
    <section className="max-w-3xl">
      <PageHeader title={t('title')} description={t('description')} />

      <GeneralSettingsForm cutoff={settings?.same_day_cutoff ?? '10:00'} maxDays={settings?.max_days_ahead ?? 30} />

      <Section title={t('windowsTitle')} description={t('windowsDescription')}>
        <DeliveryWindows windows={(windows ?? []) as WindowRow[]} />
      </Section>

      <Section title={t('closedTitle')} description={t('closedDescription')}>
        <ClosedDates dates={(closed ?? []) as ClosedRow[]} />
      </Section>
    </section>
  );
}
