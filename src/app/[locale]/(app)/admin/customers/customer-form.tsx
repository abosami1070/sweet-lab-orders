'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Save, Store } from 'lucide-react';
import { saveCustomer } from '@/lib/actions/customers';
import { displayPhone } from '@/lib/forms';
import { describe, Field, FormAlert, SubmitButton, Toggle, useServerForm } from '@/components/ui/form-bits';

export type CustomerRow = {
  id: string;
  name_ar: string;
  name_en: string;
  contact_name: string | null;
  phone: string | null;
  is_active: boolean;
};

export function CustomerForm({ customer }: { customer?: CustomerRow }) {
  const t = useTranslations('admin.customers');
  const tf = useTranslations('forms');
  const locale = useLocale();
  const { state, pending, formRef, onSubmit, err } = useServerForm(saveCustomer);

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="card space-y-4 p-5">
      <input type="hidden" name="locale" value={locale} />
      {customer && <input type="hidden" name="id" value={customer.id} />}
      <FormAlert state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="name_ar" label={t('nameAr')} error={err('name_ar')}>
          <input {...describe('name_ar', err('name_ar'))} defaultValue={customer?.name_ar} dir="rtl" className="field" autoComplete="organization" />
        </Field>
        <Field id="name_en" label={t('nameEn')} error={err('name_en')}>
          <input {...describe('name_en', err('name_en'))} defaultValue={customer?.name_en} dir="ltr" className="field rtl:text-right" />
        </Field>
        <Field id="contact_name" label={t('contactName')} error={err('contact_name')} optional>
          <input {...describe('contact_name', err('contact_name'))} defaultValue={customer?.contact_name ?? ''} className="field" autoComplete="name" />
        </Field>
        <Field id="phone" label={t('phone')} error={err('phone')} hint={tf('phoneHint')} optional>
          <input
            {...describe('phone', err('phone'), tf('phoneHint'))}
            type="tel"
            inputMode="tel"
            dir="ltr"
            placeholder="05XXXXXXXX"
            defaultValue={displayPhone(customer?.phone ?? null)}
            className="field rtl:text-right"
            autoComplete="tel"
          />
        </Field>
      </div>

      <Toggle name="is_active" label={t('active')} hint={t('activeHint')} defaultChecked={customer?.is_active ?? true} />

      <div className="flex justify-end">
        <SubmitButton pending={pending} icon={customer ? <Save className="h-4 w-4" aria-hidden /> : <Store className="h-4 w-4" aria-hidden />}>
          {customer ? tf('save') : t('create')}
        </SubmitButton>
      </div>
    </form>
  );
}
