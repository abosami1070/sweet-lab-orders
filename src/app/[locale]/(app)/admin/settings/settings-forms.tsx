'use client';

import { useLocale, useTranslations } from 'next-intl';
import { CalendarOff, Clock, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { addClosedDate, deleteClosedDate, saveDeliveryWindow, saveGeneralSettings } from '@/lib/actions/settings';
import { describe, Field, FormAlert, SubmitButton, Toggle, useServerForm } from '@/components/ui/form-bits';
import { formatDate, hhmm, riyadhToday } from '@/lib/format';

// ---------- الإعدادات العامة ----------
export function GeneralSettingsForm({ cutoff, maxDays }: { cutoff: string; maxDays: number }) {
  const t = useTranslations('admin.settings');
  const tf = useTranslations('forms');
  const { state, pending, formRef, onSubmit, err } = useServerForm(saveGeneralSettings);

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="card space-y-4 p-5">
      <FormAlert state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="same_day_cutoff" label={t('cutoff')} error={err('same_day_cutoff')} hint={t('cutoffHint')}>
          <input {...describe('same_day_cutoff', err('same_day_cutoff'), t('cutoffHint'))} type="time" defaultValue={hhmm(cutoff)} dir="ltr" className="field rtl:text-right" />
        </Field>
        <Field id="max_days_ahead" label={t('maxDays')} error={err('max_days_ahead')} hint={t('maxDaysHint')}>
          <input {...describe('max_days_ahead', err('max_days_ahead'), t('maxDaysHint'))} type="text" inputMode="numeric" defaultValue={maxDays} dir="ltr" className="field tabular-nums rtl:text-right" />
        </Field>
      </div>
      <div className="flex justify-end">
        <SubmitButton pending={pending} icon={<Save className="h-4 w-4" aria-hidden />}>{tf('save')}</SubmitButton>
      </div>
    </form>
  );
}

// ---------- فترات التسليم ----------
export type WindowRow = { id: string; label_ar: string; label_en: string; start_time: string; end_time: string; sort_order: number; is_active: boolean };

function WindowForm({ w }: { w?: WindowRow }) {
  const t = useTranslations('admin.windows');
  const tf = useTranslations('forms');
  const { state, pending, formRef, onSubmit, err } = useServerForm(saveDeliveryWindow, { resetOnSuccess: !w });
  const p = (k: string) => (w ? `win-${k}-${w.id}` : `win-new-${k}`);

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-4">
      {w && <input type="hidden" name="id" value={w.id} />}
      <FormAlert state={state} success={w ? undefined : t('added')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={p('label_ar')} label={t('labelAr')} error={err('label_ar')}>
          <input {...describe(p('label_ar'), err('label_ar'))} name="label_ar" defaultValue={w?.label_ar} placeholder={t('labelArPlaceholder')} className="field" />
        </Field>
        <Field id={p('label_en')} label={t('labelEn')} error={err('label_en')}>
          <input {...describe(p('label_en'), err('label_en'))} name="label_en" defaultValue={w?.label_en} placeholder="Morning" dir="ltr" className="field rtl:text-right" />
        </Field>
        <Field id={p('start_time')} label={t('start')} error={err('start_time')}>
          <input {...describe(p('start_time'), err('start_time'))} name="start_time" type="time" defaultValue={hhmm(w?.start_time)} dir="ltr" className="field rtl:text-right" />
        </Field>
        <Field id={p('end_time')} label={t('end')} error={err('end_time')}>
          <input {...describe(p('end_time'), err('end_time'))} name="end_time" type="time" defaultValue={hhmm(w?.end_time)} dir="ltr" className="field rtl:text-right" />
        </Field>
        <Field id={p('sort_order')} label={t('sortOrder')} error={err('sort_order')}>
          <input {...describe(p('sort_order'), err('sort_order'))} name="sort_order" type="text" inputMode="numeric" defaultValue={w?.sort_order ?? 0} dir="ltr" className="field tabular-nums rtl:text-right" />
        </Field>
      </div>
      {w && <Toggle name="is_active" label={t('active')} hint={t('activeHint')} defaultChecked={w.is_active} />}
      <div className="flex justify-end">
        <SubmitButton pending={pending} variant={w ? 'primary' : 'ghost'} icon={w ? <Save className="h-4 w-4" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}>
          {w ? tf('save') : t('add')}
        </SubmitButton>
      </div>
    </form>
  );
}

export function DeliveryWindows({ windows }: { windows: WindowRow[] }) {
  const t = useTranslations('admin.windows');
  const tc = useTranslations('admin.common');
  const locale = useLocale();

  return (
    <div className="space-y-3">
      {windows.length > 0 && (
        <ul className="card divide-y divide-line">
          {windows.map((w) => (
            <li key={w.id}>
              <details>
                <summary className="flex min-h-touch-lg cursor-pointer list-none items-center gap-3 px-4 py-3">
                  <Clock className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className={`block font-bold ${w.is_active ? '' : 'text-ink-muted line-through'}`}>{locale === 'ar' ? w.label_ar : w.label_en}</span>
                    <span className="block text-sm text-ink-muted tabular-nums" dir="ltr">
                      {hhmm(w.start_time)} – {hhmm(w.end_time)}
                    </span>
                  </span>
                  {!w.is_active && <span className="text-sm text-ink-muted">{tc('inactive')}</span>}
                  <span className="btn-ghost btn-sm pointer-events-none">
                    <Pencil className="h-4 w-4" aria-hidden />
                    {tc('edit')}
                  </span>
                </summary>
                <div className="border-t border-line bg-surface-raised p-4">
                  <WindowForm w={w} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
      <details className="card" open={windows.length === 0}>
        <summary className="flex min-h-touch cursor-pointer list-none items-center gap-2 px-4 font-bold">
          <Plus className="h-4 w-4" aria-hidden />
          {t('add')}
        </summary>
        <div className="border-t border-line p-4">
          <WindowForm />
        </div>
      </details>
    </div>
  );
}

// ---------- أيام الإغلاق ----------
export type ClosedRow = { closed_date: string; reason_ar: string | null; reason_en: string | null };

function RemoveClosed({ date }: { date: string }) {
  const t = useTranslations('admin.closed');
  const { state, pending, onSubmit } = useServerForm(deleteClosedDate);
  return (
    <form onSubmit={onSubmit} className="flex flex-col items-end gap-1">
      <input type="hidden" name="closed_date" value={date} />
      <SubmitButton pending={pending} variant="ghost" className="btn-sm" pendingLabel={t('removing')} icon={<Trash2 className="h-4 w-4" aria-hidden />}>
        {t('remove')}
      </SubmitButton>
      {state.status === 'error' && <FormAlert state={state} />}
    </form>
  );
}

export function ClosedDates({ dates }: { dates: ClosedRow[] }) {
  const t = useTranslations('admin.closed');
  const locale = useLocale();
  const { state, pending, formRef, onSubmit, err } = useServerForm(addClosedDate, { resetOnSuccess: true });

  return (
    <div className="space-y-3">
      {dates.length > 0 && (
        <ul className="card divide-y divide-line">
          {dates.map((d) => {
            const reason = locale === 'ar' ? d.reason_ar ?? d.reason_en : d.reason_en ?? d.reason_ar;
            return (
              <li key={d.closed_date} className="flex min-h-touch-lg items-center gap-3 px-4 py-3">
                <CalendarOff className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{formatDate(locale, `${d.closed_date}T12:00:00`, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  {reason && <span className="block text-sm text-ink-muted">{reason}</span>}
                </span>
                <RemoveClosed date={d.closed_date} />
              </li>
            );
          })}
        </ul>
      )}

      <form ref={formRef} onSubmit={onSubmit} noValidate className="card space-y-4 p-4">
        <FormAlert state={state} success={t('added')} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="closed_date" label={t('date')} error={err('closed_date')}>
            <input {...describe('closed_date', err('closed_date'))} type="date" min={riyadhToday()} dir="ltr" className="field rtl:text-right" />
          </Field>
          <Field id="reason_ar" label={t('reasonAr')} error={err('reason_ar')} optional>
            <input {...describe('reason_ar', err('reason_ar'))} placeholder={t('reasonArPlaceholder')} className="field" />
          </Field>
          <Field id="reason_en" label={t('reasonEn')} error={err('reason_en')} optional>
            <input {...describe('reason_en', err('reason_en'))} placeholder="Eid holiday" dir="ltr" className="field rtl:text-right" />
          </Field>
        </div>
        <div className="flex justify-end">
          <SubmitButton pending={pending} variant="ghost" icon={<CalendarOff className="h-4 w-4" aria-hidden />}>{t('add')}</SubmitButton>
        </div>
      </form>
    </div>
  );
}
