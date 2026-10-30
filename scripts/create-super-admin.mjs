// إنشاء أول مشرف عام — يُشغَّل مرة واحدة من جهازك فقط (يستخدم مفتاح الخدمة)
// الاستخدام:
//   BOOTSTRAP_ADMIN_PASSWORD='...' npm run bootstrap:admin -- owner@lab.com "اسم المشرف"
import { createClient } from '@supabase/supabase-js';

const [email, fullName = ''] = process.argv.slice(2);
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email || !password || !url || !serviceKey) {
  console.error('يلزم: البريد كوسيط، و BOOTSTRAP_ADMIN_PASSWORD و NEXT_PUBLIC_SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في .env.local');
  process.exit(1);
}
if (password.length < 12) {
  console.error('كلمة المرور يجب ألا تقل عن 12 حرفاً');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  // app_metadata لا يستطيع المستخدم تعديله؛ منه يقرأ التريغر الدور
  app_metadata: { role: 'super_admin', is_active: true },
  user_metadata: { full_name: fullName, preferred_locale: 'ar' }
});

if (error) {
  console.error('فشل الإنشاء:', error.message);
  process.exit(1);
}
console.log(`تم إنشاء المشرف العام ${data.user.email}. احذف BOOTSTRAP_ADMIN_PASSWORD من .env.local الآن.`);
