'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { currentAdmin, refreshAll } from './guard';
import {
  bool, checkText, dbErrorKey, DATE_RE, fail, invalid, isUuid, num, ok, optStr, str,
  type FieldErrors, type FormState
} from '@/lib/forms';
import { riyadhToday } from '@/lib/format';
import { routing } from '@/i18n/routing';
import { PRODUCT_UNITS, type ProductUnit } from '@/types/app';

const localeOf = (fd: FormData) => {
  const l = str(fd, 'locale');
  return (routing.locales as readonly string[]).includes(l) ? l : routing.defaultLocale;
};

// عدد صحيح ضمن مدى؛ null يعني القيمة الافتراضية إن سُمح بالفراغ
function intField(fd: FormData, key: string, errors: FieldErrors, { min, max, fallback }: { min: number; max: number; fallback?: number }) {
  const v = num(fd, key);
  if (v === null) {
    if (fallback !== undefined) return fallback;
    errors[key] = 'forms.errors.required';
    return 0;
  }
  if (Number.isNaN(v) || !Number.isInteger(v)) errors[key] = 'forms.errors.wholeNumber';
  else if (v < min || v > max) errors[key] = 'forms.errors.outOfRange';
  return v;
}

// كمية بمنزلتين عشريتين كحد أقصى (يطابق numeric في القاعدة)
function qtyField(fd: FormData, key: string, errors: FieldErrors, { required, allowZero = false }: { required: boolean; allowZero?: boolean }) {
  const v = num(fd, key);
  if (v === null) {
    if (required) errors[key] = 'forms.errors.required';
    return null;
  }
  if (Number.isNaN(v)) errors[key] = 'forms.errors.numberInvalid';
  else if (allowZero ? v < 0 : v <= 0) errors[key] = allowZero ? 'forms.errors.notNegative' : 'forms.errors.positive';
  else if (Math.abs(Math.round(v * 100) - v * 100) > 1e-6) errors[key] = 'forms.errors.twoDecimals';
  return v;
}

// ---------- التصنيفات ----------
export async function saveCategory(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await currentAdmin())) return fail('errors.ERR_FORBIDDEN');
  const id = str(fd, 'id');
  const errors: FieldErrors = {};
  const name_ar = str(fd, 'name_ar');
  const name_en = str(fd, 'name_en');
  const ar = checkText(name_ar, { min: 1, max: 80 });
  const en = checkText(name_en, { min: 1, max: 80 });
  if (ar) errors.name_ar = ar;
  if (en) errors.name_en = en;
  const sort_order = intField(fd, 'sort_order', errors, { min: 0, max: 9999, fallback: 0 });
  if (Object.keys(errors).length) return invalid(errors);

  const row = { name_ar, name_en, sort_order, is_active: id ? bool(fd, 'is_active') : true };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from('product_categories').update(row).eq('id', id).select('id').single()
    : await supabase.from('product_categories').insert(row).select('id').single();
  if (error) return fail(dbErrorKey(error));
  refreshAll();
  return ok();
}

// حذف تصنيف: منتجاته تبقى وتصبح "بدون تصنيف"
export async function deleteCategory(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await currentAdmin())) return fail('errors.ERR_FORBIDDEN');
  const id = str(fd, 'id');
  if (!isUuid(id)) return fail('errors.ERR_NOT_FOUND');
  const supabase = await createClient();
  const { error } = await supabase.from('product_categories').delete().eq('id', id).select('id').single();
  if (error) return fail(dbErrorKey(error));
  refreshAll();
  return ok();
}

// ---------- المنتجات ----------
export async function saveProduct(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await currentAdmin())) return fail('errors.ERR_FORBIDDEN');
  const id = str(fd, 'id');
  const errors: FieldErrors = {};

  const name_ar = str(fd, 'name_ar');
  const name_en = str(fd, 'name_en');
  const ar = checkText(name_ar, { min: 2, max: 120 });
  const en = checkText(name_en, { min: 2, max: 120 });
  if (ar) errors.name_ar = ar;
  if (en) errors.name_en = en;

  const description_ar = optStr(fd, 'description_ar');
  const description_en = optStr(fd, 'description_en');
  if (description_ar && description_ar.length > 1000) errors.description_ar = 'forms.errors.tooLong';
  if (description_en && description_en.length > 1000) errors.description_en = 'forms.errors.tooLong';

  const skuRaw = str(fd, 'sku').toUpperCase();
  const sku = skuRaw || null;
  if (sku && !/^[A-Z0-9-]{2,30}$/.test(sku)) errors.sku = 'forms.errors.skuInvalid';

  const categoryRaw = str(fd, 'category_id');
  const category_id = categoryRaw && isUuid(categoryRaw) ? categoryRaw : null;

  const unitRaw = str(fd, 'unit');
  if (!(PRODUCT_UNITS as readonly string[]).includes(unitRaw)) errors.unit = 'forms.errors.required';
  const unit = unitRaw as ProductUnit;

  const min_quantity = qtyField(fd, 'min_quantity', errors, { required: true });
  const quantity_step = qtyField(fd, 'quantity_step', errors, { required: true });
  // الحد الأدنى يجب أن يقبل الطلب نفسه: من مضاعفات خطوة الكمية
  if (!errors.min_quantity && !errors.quantity_step && min_quantity && quantity_step) {
    if (Math.round(min_quantity * 100) % Math.round(quantity_step * 100) !== 0) {
      errors.min_quantity = 'forms.errors.minNotMultiple';
    }
  }
  const daily_capacity = qtyField(fd, 'daily_capacity', errors, { required: false });
  const prep_minutes = intField(fd, 'prep_minutes', errors, { min: 0, max: 10080, fallback: 0 });
  const lead_days = intField(fd, 'lead_days', errors, { min: 0, max: 30, fallback: 0 });
  const sort_order = intField(fd, 'sort_order', errors, { min: 0, max: 9999, fallback: 0 });

  if (Object.keys(errors).length) return invalid(errors);

  const row = {
    name_ar, name_en, description_ar, description_en, sku, category_id, unit,
    min_quantity: min_quantity!, quantity_step: quantity_step!, daily_capacity,
    prep_minutes, lead_days, sort_order, is_active: bool(fd, 'is_active')
  };

  const supabase = await createClient();
  const unique = { products_sku_key: 'forms.errors.skuTaken' };

  if (id) {
    const { error } = await supabase.from('products').update(row).eq('id', id).select('id').single();
    if (error) return fail(dbErrorKey(error, unique), error.code === '23505' ? { sku: 'forms.errors.skuTaken' } : undefined);
    refreshAll();
    return ok();
  }

  const { data, error } = await supabase.from('products').insert(row).select('id').single();
  if (error || !data) return fail(dbErrorKey(error, unique), error?.code === '23505' ? { sku: 'forms.errors.skuTaken' } : undefined);
  refreshAll();
  redirect(`/${localeOf(fd)}/admin/products/${data.id}?created=1`);
}

// ---------- الطاقة الإنتاجية ليوم محدد ----------
export async function saveCapacityOverride(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await currentAdmin())) return fail('errors.ERR_FORBIDDEN');
  const product_id = str(fd, 'product_id');
  if (!isUuid(product_id)) return fail('errors.ERR_NOT_FOUND');

  const errors: FieldErrors = {};
  const capacity_date = str(fd, 'capacity_date');
  if (!DATE_RE.test(capacity_date)) errors.capacity_date = 'forms.errors.dateRequired';
  else if (capacity_date < riyadhToday()) errors.capacity_date = 'forms.errors.datePast';
  const max_quantity = qtyField(fd, 'max_quantity', errors, { required: true, allowZero: true });
  if (Object.keys(errors).length) return invalid(errors);

  const supabase = await createClient();
  const { error } = await supabase
    .from('product_capacity_overrides')
    .upsert({ product_id, capacity_date, max_quantity: max_quantity! }, { onConflict: 'product_id,capacity_date' })
    .select('product_id')
    .single();
  if (error) return fail(dbErrorKey(error));
  refreshAll();
  return ok();
}

export async function deleteCapacityOverride(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await currentAdmin())) return fail('errors.ERR_FORBIDDEN');
  const product_id = str(fd, 'product_id');
  const capacity_date = str(fd, 'capacity_date');
  if (!isUuid(product_id) || !DATE_RE.test(capacity_date)) return fail('errors.ERR_NOT_FOUND');
  const supabase = await createClient();
  const { error } = await supabase
    .from('product_capacity_overrides')
    .delete()
    .eq('product_id', product_id)
    .eq('capacity_date', capacity_date)
    .select('product_id')
    .single();
  if (error) return fail(dbErrorKey(error));
  refreshAll();
  return ok();
}
