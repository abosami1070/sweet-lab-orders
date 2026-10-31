'use client';

import { useLocale, useTranslations } from 'next-intl';
import { MapPin, Pencil, Plus, Save } from 'lucide-react';
import { saveBranch } from '@/lib/actions/customers';
import { displayPhone } from '@/lib/forms';
import { describe, Field, FormAlert, SubmitButton, Toggle, useServerForm } from '@/components/ui/form-bits';

export type BranchRow = {
  id: string;
  name_ar: string;
  name_en: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
};

function BranchForm({ customerId, branch, onDoneLabel }: { customerId: string; branch?: BranchRow; onDoneLabel: string }) {
  const t = useTranslations('admin.branches');
  const tc = useTranslations('admin.customers');
  const tf = useTranslations('forms');
  const { state, pending, formRef, onSubmit, err } = useServerForm(saveBranch, { resetOnSuccess: !branch });
  const p = (k: string) => (branch ? `${k}-${branch.id}` : `new-${k}`); // معرّفات فريدة لكل نموذج في الصفحة

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-4">
      <input type="hidden" name="customer_id" value={customerId} />
      {branch && <input type="hidden" name="id" value={branch.id} />}
      <FormAlert state={state} success={branch ? undefined : t('added')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={p('name_ar')} label={t('nameAr')} error={err('name_ar')}>
          <input {...describe(p('name_ar'), err('name_ar'))} name="name_ar" defaultValue={branch?.name_ar} className="field" />
        </Field>
        <Field id={p('name_en')} label={t('nameEn')} error={err('name_en')}>
          <input {...describe(p('name_en'), err('name_en'))} name="name_en" defaultValue={branch?.name_en} dir="ltr" className="field rtl:text-right" />
        </Field>
        <Field id={p('address')} label={t('address')} error={err('address')} optional className="sm:col-span-2">
          <input {...describe(p('address'), err('address'))} name="address" defaultValue={branch?.address ?? ''} className="field" />
        </Field>
        <Field id={p('phone')} label={tc('phone')} error={err('phone')} hint={tf('phoneHint')} optional>
          <input
            {...describe(p('phone'), err('phone'), tf('phoneHint'))}
            name="phone"
            type="tel"
            inputMode="tel"
            dir="ltr"
            placeholder="05XXXXXXXX"
            defaultValue={displayPhone(branch?.phone ?? null)}
            className="field rtl:text-right"
          />
        </Field>
      </div>
      {branch && <Toggle name="is_active" label={t('active')} hint={t('activeHint')} defaultChecked={branch.is_active} />}
      <div className="flex justify-end">
        <SubmitButton pending={pending} variant={branch ? 'primary' : 'ghost'} icon={branch ? <Save className="h-4 w-4" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}>
          {onDoneLabel}
        </SubmitButton>
      </div>
    </form>
  );
}

export function Branches({ customerId, branches }: { customerId: string; branches: BranchRow[] }) {
  const t = useTranslations('admin.branches');
  const tf = useTranslations('forms');
  const tcommon = useTranslations('admin.common');
  const locale = useLocale();

  return (
    <div className="space-y-3">
      {branches.length > 0 && (
        <ul className="card divide-y divide-line">
          {branches.map((b) => (
            <li key={b.id}>
              <details className="group">
                <summary className="flex min-h-touch-lg cursor-pointer list-none items-center gap-3 px-4 py-3">
                  <MapPin className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className={`block font-bold ${b.is_active ? '' : 'text-ink-muted line-through'}`}>
                      {locale === 'ar' ? b.name_ar : b.name_en}
                    </span>
                    <span className="block truncate text-sm text-ink-muted">
                      {[b.address, b.phone ? displayPhone(b.phone) : null].filter(Boolean).join(' · ') || t('noDetails')}
                    </span>
                  </span>
                  {!b.is_active && <span className="text-sm text-ink-muted">{tcommon('inactive')}</span>}
                  <span className="btn-ghost btn-sm pointer-events-none">
                    <Pencil className="h-4 w-4" aria-hidden />
                    {tcommon('edit')}
                  </span>
                </summary>
                <div className="border-t border-line bg-surface-raised p-4">
                  <BranchForm customerId={customerId} branch={b} onDoneLabel={tf('save')} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}

      <details className="card" open={branches.length === 0}>
        <summary className="flex min-h-touch cursor-pointer list-none items-center gap-2 px-4 font-bold">
          <Plus className="h-4 w-4" aria-hidden />
          {t('add')}
        </summary>
        <div className="border-t border-line p-4">
          <p className="mb-4 text-sm text-ink-muted">{t('addHint')}</p>
          <BranchForm customerId={customerId} onDoneLabel={t('add')} />
        </div>
      </details>
    </div>
  );
}
