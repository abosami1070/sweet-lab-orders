'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Pencil, Plus, Save, Tag, Trash2 } from 'lucide-react';
import { deleteCategory, saveCategory } from '@/lib/actions/catalog';
import { describe, Field, FormAlert, SubmitButton, Toggle, useServerForm } from '@/components/ui/form-bits';

export type CategoryRow = { id: string; name_ar: string; name_en: string; sort_order: number; is_active: boolean; products: number };

function CategoryForm({ category }: { category?: CategoryRow }) {
  const t = useTranslations('admin.categories');
  const tf = useTranslations('forms');
  const { state, pending, formRef, onSubmit, err } = useServerForm(saveCategory, { resetOnSuccess: !category });
  const p = (k: string) => (category ? `cat-${k}-${category.id}` : `cat-new-${k}`);

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-4">
      {category && <input type="hidden" name="id" value={category.id} />}
      <FormAlert state={state} success={category ? undefined : t('added')} />
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_8rem]">
        <Field id={p('name_ar')} label={t('nameAr')} error={err('name_ar')}>
          <input {...describe(p('name_ar'), err('name_ar'))} name="name_ar" defaultValue={category?.name_ar} className="field" />
        </Field>
        <Field id={p('name_en')} label={t('nameEn')} error={err('name_en')}>
          <input {...describe(p('name_en'), err('name_en'))} name="name_en" defaultValue={category?.name_en} dir="ltr" className="field rtl:text-right" />
        </Field>
        <Field id={p('sort_order')} label={t('sortOrder')} error={err('sort_order')}>
          <input
            {...describe(p('sort_order'), err('sort_order'))}
            name="sort_order"
            type="text"
            inputMode="numeric"
            dir="ltr"
            defaultValue={category?.sort_order ?? 0}
            className="field tabular-nums rtl:text-right"
          />
        </Field>
      </div>
      {category && <Toggle name="is_active" label={t('active')} hint={t('activeHint')} defaultChecked={category.is_active} />}
      <div className="flex justify-end">
        <SubmitButton pending={pending} variant={category ? 'primary' : 'ghost'} icon={category ? <Save className="h-4 w-4" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}>
          {category ? tf('save') : t('add')}
        </SubmitButton>
      </div>
    </form>
  );
}

function DeleteCategory({ category }: { category: CategoryRow }) {
  const t = useTranslations('admin.categories');
  const { state, pending, onSubmit } = useServerForm(deleteCategory, {
    confirm: category.products > 0 ? t('deleteConfirmWithProducts', { n: category.products }) : t('deleteConfirm')
  });
  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3 border-t border-line pt-4">
      <input type="hidden" name="id" value={category.id} />
      <FormAlert state={state} />
      <SubmitButton pending={pending} variant="danger" pendingLabel={t('deleting')} icon={<Trash2 className="h-4 w-4" aria-hidden />}>
        {t('delete')}
      </SubmitButton>
    </form>
  );
}

export function Categories({ categories }: { categories: CategoryRow[] }) {
  const t = useTranslations('admin.categories');
  const tc = useTranslations('admin.common');
  const locale = useLocale();

  return (
    <div className="space-y-3">
      {categories.length > 0 && (
        <ul className="card divide-y divide-line">
          {categories.map((c) => (
            <li key={c.id}>
              <details>
                <summary className="flex min-h-touch-lg cursor-pointer list-none items-center gap-3 px-4 py-3">
                  <Tag className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className={`block font-bold ${c.is_active ? '' : 'text-ink-muted line-through'}`}>{locale === 'ar' ? c.name_ar : c.name_en}</span>
                    <span className="block text-sm text-ink-muted">{t('productsCount', { count: c.products, n: c.products })}</span>
                  </span>
                  {!c.is_active && <span className="text-sm text-ink-muted">{tc('inactive')}</span>}
                  <span className="btn-ghost btn-sm pointer-events-none">
                    <Pencil className="h-4 w-4" aria-hidden />
                    {tc('edit')}
                  </span>
                </summary>
                <div className="border-t border-line bg-surface-raised p-4">
                  <CategoryForm category={c} />
                  <DeleteCategory category={c} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
      <details className="card" open={categories.length === 0}>
        <summary className="flex min-h-touch cursor-pointer list-none items-center gap-2 px-4 font-bold">
          <Plus className="h-4 w-4" aria-hidden />
          {t('add')}
        </summary>
        <div className="border-t border-line p-4">
          <CategoryForm />
        </div>
      </details>
    </div>
  );
}
