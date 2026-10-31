import 'server-only';
import { createClient } from '@supabase/supabase-js';

// عميل بمفتاح الخدمة لإدارة الحسابات فقط (إنشاء مستخدم، تعيين كلمة مرور، قراءة البريد).
// - يعمل في الخادم فقط: 'server-only' يمنع استيراده في أي مكون يصل للمتصفح.
// - المتغير SUPABASE_SERVICE_ROLE_KEY بدون NEXT_PUBLIC_ فلا يُرسل للمتصفح أبداً.
// - كل إجراء يستخدمه يتحقق أولاً من دور المستخدم الحالي عبر جلسته العادية.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('ERR_SERVICE_KEY_MISSING');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export const hasServiceKey = () => Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
