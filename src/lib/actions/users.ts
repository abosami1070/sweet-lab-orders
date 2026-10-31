'use server';

import { randomInt } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { currentAdmin, refreshAll } from './guard';
import {
  bool, checkText, dbErrorKey, EMAIL_RE, fail, invalid, isUuid, ok, str,
  type FieldErrors, type FormState
} from '@/lib/forms';
import { APP_ROLES, type AppRole } from '@/types/app';

// كلمة مرور مؤقتة سهلة القراءة والنسخ: بدون أحرف ملتبسة مثل 0/O و1/l
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function temporaryPassword() {
  const group = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return `${group()}-${group()}-${group()}`;
}

const serviceError = (e: unknown) =>
  e instanceof Error && e.message === 'ERR_SERVICE_KEY_MISSING' ? 'errors.ERR_SERVICE_KEY_MISSING' : 'errors.unknown';

// إنشاء حساب: المشرف ينشئ حسابات العملاء فقط، والمشرف العام ينشئ كل الأدوار.
// الدور والمحل يُكتبان في app_metadata، ومنها يُنشئ تريغر القاعدة الملف الشخصي مفعّلاً.
export async function createUser(_prev: FormState, fd: FormData): Promise<FormState> {
  const caller = await currentAdmin();
  if (!caller) return fail('errors.ERR_FORBIDDEN');

  const errors: FieldErrors = {};
  const full_name = str(fd, 'full_name');
  const nameErr = checkText(full_name, { min: 2, max: 120 });
  if (nameErr) errors.full_name = nameErr;

  const email = str(fd, 'email').toLowerCase();
  if (!email) errors.email = 'forms.errors.required';
  else if (!EMAIL_RE.test(email)) errors.email = 'forms.errors.emailInvalid';

  const role = str(fd, 'role') as AppRole;
  if (!APP_ROLES.includes(role)) errors.role = 'forms.errors.required';
  else if (caller.role === 'admin' && role !== 'customer') return fail('errors.ERR_FORBIDDEN');

  const preferred_locale = str(fd, 'preferred_locale') === 'en' ? 'en' : 'ar';

  const supabase = await createClient();
  let customer_id: string | null = null;
  let customerPhone = '';
  if (role === 'customer') {
    customer_id = str(fd, 'customer_id');
    if (!isUuid(customer_id)) errors.customer_id = 'forms.errors.customerRequired';
    else {
      const { data: customer } = await supabase
        .from('customers')
        .select('id, phone, is_active')
        .eq('id', customer_id)
        .maybeSingle<{ id: string; phone: string | null; is_active: boolean }>();
      if (!customer) errors.customer_id = 'forms.errors.customerRequired';
      else if (!customer.is_active) errors.customer_id = 'forms.errors.customerInactive';
      else customerPhone = customer.phone ?? '';
    }
  }
  if (Object.keys(errors).length) return invalid(errors);

  const password = temporaryPassword();
  let userId: string;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role, customer_id, is_active: true },
      user_metadata: { full_name, preferred_locale }
    });
    if (error || !data.user) {
      const taken = error?.code === 'email_exists' || /already (been )?registered|already exists/i.test(error?.message ?? '');
      return taken ? invalid({ email: 'forms.errors.emailTaken' }) : fail('errors.unknown');
    }
    userId = data.user.id;
  } catch (e) {
    return fail(serviceError(e));
  }

  refreshAll();
  // كلمة المرور تُعرض مرة واحدة فقط ولا تُحفظ في أي مكان
  return ok({ password, email, userId, name: full_name, phone: customerPhone });
}

// تعديل الدور والمحل والتفعيل: عبر دالة القاعدة admin_update_profile التي تفرض القيود بنفسها
export async function updateUser(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await currentAdmin())) return fail('errors.ERR_FORBIDDEN');

  const user_id = str(fd, 'user_id');
  if (!isUuid(user_id)) return fail('errors.ERR_NOT_FOUND');

  const errors: FieldErrors = {};
  const full_name = str(fd, 'full_name');
  const nameErr = checkText(full_name, { min: 2, max: 120 });
  if (nameErr) errors.full_name = nameErr;
  const role = str(fd, 'role') as AppRole;
  if (!APP_ROLES.includes(role)) errors.role = 'forms.errors.required';
  const is_active = bool(fd, 'is_active');
  const customerRaw = str(fd, 'customer_id');
  const customer_id = role === 'customer' && isUuid(customerRaw) ? customerRaw : null;
  if (role === 'customer' && is_active && !customer_id) errors.customer_id = 'forms.errors.customerRequired';
  if (Object.keys(errors).length) return invalid(errors);

  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_update_profile', {
    p_user_id: user_id,
    p_role: role,
    p_customer_id: customer_id,
    p_is_active: is_active,
    p_full_name: full_name
  });
  if (error) return fail(dbErrorKey(error));
  refreshAll();
  return ok();
}

// كلمة مرور مؤقتة جديدة لحساب نسي صاحبه كلمة المرور
export async function resetUserPassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const caller = await currentAdmin();
  if (!caller) return fail('errors.ERR_FORBIDDEN');

  const user_id = str(fd, 'user_id');
  if (!isUuid(user_id)) return fail('errors.ERR_NOT_FOUND');

  const supabase = await createClient();
  const { data: target } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user_id)
    .maybeSingle<{ id: string; role: AppRole }>();
  if (!target) return fail('errors.ERR_NOT_FOUND');
  // المشرف يعيد تعيين كلمات مرور العملاء فقط
  if (caller.role === 'admin' && target.role !== 'customer') return fail('errors.ERR_FORBIDDEN');

  const password = temporaryPassword();
  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(user_id, { password });
    if (error) return fail('errors.unknown');
  } catch (e) {
    return fail(serviceError(e));
  }
  return ok({ password });
}
