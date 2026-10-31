'use client';

import { useLocale, useTranslations } from 'next-intl';
import { CalendarPlus, Trash2 } from 'lucide-react';
import { deleteCapacityOverride, saveCapacityOverride } from '@/lib/actions/catalog';
import { describe, Field, FormAlert, SubmitButton, useServerForm } from '@/components/ui/form-bits';
import { formatDate, formatNumber, riyadhToday } from '@/lib/format';
import type { ProductUnit } from '@/types/app';

export type OverrideRow = { capacity_date: string; max_quantity: number };

function RemoveOverride({ productId, date }: { productId: string; date: string }) {
  const t = useTranslations('admin.overrides');
  const { state, pending, onSubmit } = useServerForm(deleteCapacityOverride);
  return (
    <form onSubmit={onSubmit} className="flex flex-col items-end gap-1">
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="capacity_date" value={date} />
      <SubmitButton pending={pending} variant="ghost" className="btn-sm" pendingLabel={t('removing')} icon={<Trash2 className="h-4 w-4" aria-hidden />}>
        {t('remove')}
      </SubmitButton>
      {state.status === 'error' && <FormAlert state={state} />}
    </form>
  );
}

export function CapacityOverrides({ productId, unit, overrides }: { productId: string; unit: ProductUnit; overrides: OverrideRow[] }) {
  const t = useTranslations('admin.overrides');
  const tu = useTranslations('units');
  const locale = useLocale();
  const { state, pending, formRef, onSubmit, err } = useServerForm(saveCapacityOverride, { resetOnSuccess: true });

  return (
    <div className="space-y-3">
      {overrides.length > 0 && (
        <ul className="card divide-y divide-line">
          {overrides.map((o) => (
            <li key={o.capacity_date} className="flex min-h-touch-lg items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{formatDate(locale, `${o.capacity_date}T12:00:00`, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                <span className="block text-sm text-ink-muted">
                  {o.max_quantity === 0 ? t('closedForProduct') : t('maxPerDay', { qty: formatNumber(locale, o.max_quantity), unit: tu(unit) })}
                </span>
              </span>
              <RemoveOverride productId={productId} date={o.capacity_date} />
            </li>
          ))}
        </ul>
      )}

      <form ref={formRef} onSubmit={onSubmit} noValidate className="card space-y-4 p-4">
        <input type="hidden" name="product_id" value={productId} />
        <FormAlert state={state} success={t('saved')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="capacity_date" label={t('date')} error={err('capacity_date')}>
            <input {...describe('capacity_date', err('capacity_date'))} type="date" min={riyadhToday()} dir="ltr" className="field rtl:text-right" />
          </Field>
          <Field id="max_quantity" label={t('maxQuantity', { unit: tu(unit) })} error={err('max_quantity')} hint={t('maxQuantityHint')}>
            <input {...describe('max_quantity', err('max_quantity'), t('maxQuantityHint'))} type="text" inputMode="decimal" dir="ltr" className="field tabular-nums rtl:text-right" />
          </Field>
        </div>
        <div className="flex justify-end">
          <SubmitButton pending={pending} variant="ghost" icon={<CalendarPlus className="h-4 w-4" aria-hidden />}>
            {t('save')}
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
