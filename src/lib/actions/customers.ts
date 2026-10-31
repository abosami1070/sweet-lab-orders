'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { currentAdmin, refreshAll } from './guard';
import {
  bool, checkText, dbErrorKey, fail, invalid, isUuid, normalizeSaudiPhone, ok, optStr, str,
  type FieldErrors, type FormState
} from '@/lib/forms';
import { routing } from '@/i18n/routing';

const localeOf = (fd: FormData) => {
  const l = str(fd, 'locale');
  return (routing.locales as readonly string[]).includes(l) ? l : routing.defaultLocale;
};

function readNames(fd: FormData, errors: FieldErrors) {
  const name_ar = str(fd, 'name_ar');
  const name_en = str(fd, 'name_en');
  const ar = checkText(name_ar, { min: 2, max: 120 });
  const en = checkText(name_en, { min: 2, max: 120 });
  if (ar) errors.name_ar = ar;
  if (en) errors.name_en = en;
  return { name_ar, name_en };
}

function readPhone(fd: FormData, errors: FieldErrors) {
  const phone = normalizeSaudiPhone(str(fd, 'phone'));
  if (phone === 'invalid') {
    errors.phone = 'forms.errors.phoneInvalid';
    return null;
  }
  return phone;
}

// إنشاء محل أو تعديله
export async function saveCustomer(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await currentAdmin())) return fail('errors.ERR_FORBIDDEN');

  const id = str(fd, 'id');
  const errors: FieldErrors = {};
  const names = readNames(fd, errors);
  const contact_name = optStr(fd, 'contact_name');
  if (contact_name && contact_name.length > 120) errors.contact_name = 'forms.errors.tooLong';
  const phone = readPhone(fd, errors);
  if (Object.keys(errors).length) return invalid(errors);

  const row = { ...names, contact_name, phone, is_active: bool(fd, 'is_active') };
  const supabase = await createClient();

  if (id) {
    if (!isUuid(id)) return fail('errors.ERR_NOT_FOUND');
    const { error } = await supabase.from('customers').update(row).eq('id', id).select('id').single();
    if (error) return fail(dbErrorKey(error));
    refreshAll();
    return ok();
  }

  const { data, error } = await supabase.from('customers').insert(row).select('id').single();
  if (error || !data) return fail(dbErrorKey(error));
  refreshAll();
  redirect(`/${localeOf(fd)}/admin/customers/${data.id}?created=1`);
}

// إضافة فرع أو تعديله (الفروع لا تُحذف حتى لا تتأثر الطلبات السابقة؛ تُوقف فقط)
export async function saveBranch(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await currentAdmin())) return fail('errors.ERR_FORBIDDEN');

  const id = str(fd, 'id');
  const customer_id = str(fd, 'customer_id');
  if (!isUuid(customer_id)) return fail('errors.ERR_NOT_FOUND');

  const errors: FieldErrors = {};
  const names = readNames(fd, errors);
  const address = optStr(fd, 'address');
  if (address && address.length > 500) errors.address = 'forms.errors.tooLong';
  const phone = readPhone(fd, errors);
  if (Object.keys(errors).length) return invalid(errors);

  const row = { ...names, address, phone, is_active: id ? bool(fd, 'is_active') : true };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from('customer_branches').update(row).eq('id', id).eq('customer_id', customer_id).select('id').single()
    : await supabase.from('customer_branches').insert({ ...row, customer_id }).select('id').single();
  if (error) return fail(dbErrorKey(error));
  refreshAll();
  return ok();
}
