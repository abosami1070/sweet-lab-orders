'use server';

import { createClient } from '@/lib/supabase/server';
import { currentAdmin, refreshAll } from './guard';
import {
  bool, checkText, dbErrorKey, DATE_RE, fail, invalid, num, ok, optStr, str, TIME_RE, toLatinDigits,
  type FieldErrors, type FormState
} from '@/lib/forms';
import { riyadhToday } from '@/lib/format';

const timeField = (fd: FormData, key: string, errors: FieldErrors) => {
  const v = toLatinDigits(str(fd, key)).slice(0, 5);
  if (!TIME_RE.test(v)) errors[key] = 'forms.errors.timeInvalid';
  return v;
};

// إعدادات التشغيل العامة (صف واحد)
export async function saveGeneralSettings(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await currentAdmin();
  if (!admin) return fail('errors.ERR_FORBIDDEN');

  const errors: FieldErrors = {};
  const same_day_cutoff = timeField(fd, 'same_day_cutoff', errors);
  const days = num(fd, 'max_days_ahead');
  if (days === null) errors.max_days_ahead = 'forms.errors.required';
  else if (Number.isNaN(days) || !Number.isInteger(days)) errors.max_days_ahead = 'forms.errors.wholeNumber';
  else if (days < 1 || days > 180) errors.max_days_ahead = 'forms.errors.outOfRange';
  if (Object.keys(errors).length) return invalid(errors);

  const supabase = await createClient();
  const { error } = await supabase
    .from('app_settings')
    .update({ same_day_cutoff, max_days_ahead: days!, updated_by: admin.id })
    .eq('id', true)
    .select('id')
    .single();
  if (error) return fail(dbErrorKey(error));
  refreshAll();
  return ok();
}

// فترات التسليم
export async function saveDeliveryWindow(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await currentAdmin())) return fail('errors.ERR_FORBIDDEN');
  const id = str(fd, 'id');
  const errors: FieldErrors = {};

  const label_ar = str(fd, 'label_ar');
  const label_en = str(fd, 'label_en');
  const ar = checkText(label_ar, { min: 2, max: 60 });
  const en = checkText(label_en, { min: 2, max: 60 });
  if (ar) errors.label_ar = ar;
  if (en) errors.label_en = en;
  const start_time = timeField(fd, 'start_time', errors);
  const end_time = timeField(fd, 'end_time', errors);
  if (!errors.start_time && !errors.end_time && end_time <= start_time) errors.end_time = 'forms.errors.endBeforeStart';
  const sort = num(fd, 'sort_order');
  const sort_order = sort === null || Number.isNaN(sort) ? 0 : Math.max(0, Math.min(9999, Math.trunc(sort)));
  if (Object.keys(errors).length) return invalid(errors);

  const row = { label_ar, label_en, start_time, end_time, sort_order, is_active: id ? bool(fd, 'is_active') : true };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from('delivery_windows').update(row).eq('id', id).select('id').single()
    : await supabase.from('delivery_windows').insert(row).select('id').single();
  if (error) return fail(dbErrorKey(error));
  refreshAll();
  return ok();
}

// أيام الإغلاق
export async function addClosedDate(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await currentAdmin();
  if (!admin) return fail('errors.ERR_FORBIDDEN');

  const errors: FieldErrors = {};
  const closed_date = str(fd, 'closed_date');
  if (!DATE_RE.test(closed_date)) errors.closed_date = 'forms.errors.dateRequired';
  else if (closed_date < riyadhToday()) errors.closed_date = 'forms.errors.datePast';
  const reason_ar = optStr(fd, 'reason_ar');
  const reason_en = optStr(fd, 'reason_en');
  if (reason_ar && reason_ar.length > 200) errors.reason_ar = 'forms.errors.tooLong';
  if (reason_en && reason_en.length > 200) errors.reason_en = 'forms.errors.tooLong';
  if (Object.keys(errors).length) return invalid(errors);

  const supabase = await createClient();
  const { error } = await supabase
    .from('closed_dates')
    .insert({ closed_date, reason_ar, reason_en, created_by: admin.id })
    .select('closed_date')
    .single();
  if (error) {
    const key = dbErrorKey(error, { closed_dates_pkey: 'forms.errors.dateTaken' });
    return fail(key, key === 'forms.errors.dateTaken' ? { closed_date: key } : undefined);
  }
  refreshAll();
  return ok();
}

export async function deleteClosedDate(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await currentAdmin())) return fail('errors.ERR_FORBIDDEN');
  const closed_date = str(fd, 'closed_date');
  if (!DATE_RE.test(closed_date)) return fail('errors.ERR_NOT_FOUND');
  const supabase = await createClient();
  const { error } = await supabase.from('closed_dates').delete().eq('closed_date', closed_date).select('closed_date').single();
  if (error) return fail(dbErrorKey(error));
  refreshAll();
  return ok();
}
