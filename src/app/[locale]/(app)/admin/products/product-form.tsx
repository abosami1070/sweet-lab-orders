'use client';

import { useLocale, useTranslations } from 'next-intl';
import { CakeSlice, Save } from 'lucide-react';
import { saveProduct } from '@/lib/actions/catalog';
import { describe, Field, FormAlert, SubmitButton, Toggle, useServerForm } from '@/components/ui/form-bits';
import { PRODUCT_UNITS, type ProductUnit } from '@/types/app';

export type ProductRow = {
  id: string;
  category_id: string | null;
  sku: string | null;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  unit: ProductUnit;
  min_quantity: number;
  quantity_step: number;
  prep_minutes: number;
  lead_days: number;
  daily_capacity: number | null;
  sort_order: number;
  is_active: boolean;
};

export type CategoryOption = { id: string; name_ar: string; name_en: string };

// حقل رقمي: نصي مع لوحة أرقام حتى يقبل الأرقام العربية ويتحقق منها الخادم
const numberInput = { type: 'text', inputMode: 'decimal', dir: 'ltr', className: 'field rtl:text-right tabular-nums' } as const;

export function ProductForm({ product, categories }: { product?: ProductRow; categories: CategoryOption[] }) {
  const t = useTranslations('admin.products');
  const tu = useTranslations('units');
  const tf = useTranslations('forms');
  const locale = useLocale();
  const { state, pending, formRef, onSubmit, err } = useServerForm(saveProduct);

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      {product && <input type="hidden" name="id" value={product.id} />}
      <FormAlert state={state} />

      <fieldset className="card space-y-4 p-5">
        <legend className="sr-only">{t('basics')}</legend>
        <h2 className="text-lg">{t('basics')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="name_ar" label={t('nameAr')} error={err('name_ar')}>
            <input {...describe('name_ar', err('name_ar'))} defaultValue={product?.name_ar} dir="rtl" className="field" />
          </Field>
          <Field id="name_en" label={t('nameEn')} error={err('name_en')}>
            <input {...describe('name_en', err('name_en'))} defaultValue={product?.name_en} dir="ltr" className="field rtl:text-right" />
          </Field>
          <Field id="category_id" label={t('category')} error={err('category_id')} optional>
            <select {...describe('category_id', err('category_id'))} defaultValue={product?.category_id ?? ''} className="field">
              <option value="">{t('noCategory')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{locale === 'ar' ? c.name_ar : c.name_en}</option>
              ))}
            </select>
          </Field>
          <Field id="sku" label={t('sku')} error={err('sku')} hint={t('skuHint')} optional>
            <input {...describe('sku', err('sku'), t('skuHint'))} defaultValue={product?.sku ?? ''} dir="ltr" autoCapitalize="characters" className="field uppercase rtl:text-right" />
          </Field>
          <Field id="description_ar" label={t('descriptionAr')} error={err('description_ar')} optional>
            <textarea {...describe('description_ar', err('description_ar'))} defaultValue={product?.description_ar ?? ''} rows={2} className="field py-2" />
          </Field>
          <Field id="description_en" label={t('descriptionEn')} error={err('description_en')} optional>
            <textarea {...describe('description_en', err('description_en'))} defaultValue={product?.description_en ?? ''} rows={2} dir="ltr" className="field py-2 rtl:text-right" />
          </Field>
        </div>
      </fieldset>

      <fieldset className="card space-y-4 p-5">
        <legend className="sr-only">{t('ordering')}</legend>
        <div>
          <h2 className="text-lg">{t('ordering')}</h2>
          <p className="text-sm text-ink-muted">{t('orderingHint')}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="unit" label={t('unit')} error={err('unit')}>
            <select {...describe('unit', err('unit'))} defaultValue={product?.unit ?? 'piece'} className="field">
              {PRODUCT_UNITS.map((u) => (
                <option key={u} value={u}>{tu(u)}</option>
              ))}
            </select>
          </Field>
          <Field id="min_quantity" label={t('minQuantity')} error={err('min_quantity')} hint={t('minQuantityHint')}>
            <input {...describe('min_quantity', err('min_quantity'), t('minQuantityHint'))} {...numberInput} defaultValue={product?.min_quantity ?? 1} />
          </Field>
          <Field id="quantity_step" label={t('quantityStep')} error={err('quantity_step')} hint={t('quantityStepHint')}>
            <input {...describe('quantity_step', err('quantity_step'), t('quantityStepHint'))} {...numberInput} defaultValue={product?.quantity_step ?? 1} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="card space-y-4 p-5">
        <legend className="sr-only">{t('production')}</legend>
        <div>
          <h2 className="text-lg">{t('production')}</h2>
          <p className="text-sm text-ink-muted">{t('productionHint')}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="lead_days" label={t('leadDays')} error={err('lead_days')} hint={t('leadDaysHint')}>
            <input {...describe('lead_days', err('lead_days'), t('leadDaysHint'))} {...numberInput} inputMode="numeric" defaultValue={product?.lead_days ?? 0} />
          </Field>
          <Field id="prep_minutes" label={t('prepMinutes')} error={err('prep_minutes')} hint={t('prepMinutesHint')}>
            <input {...describe('prep_minutes', err('prep_minutes'), t('prepMinutesHint'))} {...numberInput} inputMode="numeric" defaultValue={product?.prep_minutes ?? 0} />
          </Field>
          <Field id="daily_capacity" label={t('dailyCapacity')} error={err('daily_capacity')} hint={t('dailyCapacityHint')} optional>
            <input {...describe('daily_capacity', err('daily_capacity'), t('dailyCapacityHint'))} {...numberInput} defaultValue={product?.daily_capacity ?? ''} />
          </Field>
        </div>
      </fieldset>

      <div className="card grid gap-4 p-5 sm:grid-cols-2">
        <Toggle name="is_active" label={t('active')} hint={t('activeHint')} defaultChecked={product?.is_active ?? true} />
        <Field id="sort_order" label={t('sortOrder')} error={err('sort_order')} hint={t('sortOrderHint')}>
          <input {...describe('sort_order', err('sort_order'), t('sortOrderHint'))} {...numberInput} inputMode="numeric" defaultValue={product?.sort_order ?? 0} />
        </Field>
      </div>

      <div className="flex justify-end">
        <SubmitButton pending={pending} icon={product ? <Save className="h-4 w-4" aria-hidden /> : <CakeSlice className="h-4 w-4" aria-hidden />}>
          {product ? tf('save') : t('create')}
        </SubmitButton>
      </div>
    </form>
  );
}
