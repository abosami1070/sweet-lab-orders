-- اختبارات الصلاحيات ودورة الطلب — تُشغَّل بالأمر: npm run db:test
-- كل البيانات هنا داخل معاملة تُلغى في النهاية (rollback) ولا تبقى في القاعدة.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- ---------- تجهيز بيئة الاختبار ----------
insert into public.customers (id, name_ar, name_en) values
  ('a0000000-0000-0000-0000-00000000000a', 'محل اختبار أ', 'Test Shop A'),
  ('b0000000-0000-0000-0000-00000000000b', 'محل اختبار ب', 'Test Shop B');

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000001', 'cust-a@test.local', 'authenticated', 'authenticated',
     '{"role":"customer","customer_id":"a0000000-0000-0000-0000-00000000000a","is_active":true}', '{"full_name":"عميل أ"}'),
  ('10000000-0000-0000-0000-000000000002', 'cust-b@test.local', 'authenticated', 'authenticated',
     '{"role":"customer","customer_id":"b0000000-0000-0000-0000-00000000000b","is_active":true}', '{"full_name":"عميل ب"}'),
  ('10000000-0000-0000-0000-000000000003', 'admin@test.local', 'authenticated', 'authenticated',
     '{"role":"admin","is_active":true}', '{"full_name":"مشرف"}'),
  ('10000000-0000-0000-0000-000000000004', 'kitchen@test.local', 'authenticated', 'authenticated',
     '{"role":"kitchen_staff","is_active":true}', '{"full_name":"المعمل"}'),
  ('10000000-0000-0000-0000-000000000005', 'stranger@test.local', 'authenticated', 'authenticated',
     '{}', '{}');

insert into public.products (id, name_ar, name_en, daily_capacity) values
  ('c0000000-0000-0000-0000-00000000000c', 'كيكة اختبار', 'Test Cake', 50);

create temporary table t_ctx (order_id uuid);
grant all on t_ctx to authenticated;

-- ---------- 1. إنشاء الملف الشخصي ----------
select is((select role::text from public.profiles where id = '10000000-0000-0000-0000-000000000004'),
          'kitchen_staff', 'الدور يُقرأ من app_metadata');
select is((select is_active from public.profiles where id = '10000000-0000-0000-0000-000000000005'),
          false, 'حساب بلا بيانات صلاحية يبقى غير مفعّل');

-- ---------- 2. العميل أ ينشئ طلباً ----------
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok($$
  insert into t_ctx select id from public.place_order(
    'd0000000-0000-0000-0000-000000000001', app.riyadh_today() + 2,
    '[{"product_id":"c0000000-0000-0000-0000-00000000000c","quantity":10}]'::jsonb)
$$, 'العميل ينشئ طلباً');

select is((select status::text from public.orders where id = (select order_id from t_ctx)),
          'pending_approval', 'الطلب يبدأ بانتظار الاعتماد');

select is((select id from public.place_order(
    'd0000000-0000-0000-0000-000000000001', app.riyadh_today() + 2,
    '[{"product_id":"c0000000-0000-0000-0000-00000000000c","quantity":10}]'::jsonb)),
  (select order_id from t_ctx), 'إعادة الإرسال بنفس المعرف لا تنشئ طلباً ثانياً');

select throws_ok($$ select public.place_order(gen_random_uuid(), app.riyadh_today() - 1,
    '[{"product_id":"c0000000-0000-0000-0000-00000000000c","quantity":1}]'::jsonb) $$,
  'P0001', 'ERR_DATE_IN_PAST', 'رفض تاريخ ماضٍ');

select throws_ok($$ select public.place_order(gen_random_uuid(), app.riyadh_today() + 2,
    '[{"product_id":"c0000000-0000-0000-0000-00000000000c","quantity":45}]'::jsonb) $$,
  'P0001', 'ERR_CAPACITY_EXCEEDED', 'رفض تجاوز الطاقة الإنتاجية');

select throws_ok($$ update public.orders set status = 'delivered' $$,
  '42501', null, 'لا تعديل مباشر على جدول الطلبات');

select throws_ok($$ update public.profiles set role = 'admin' where id = auth.uid() $$,
  '42501', null, 'المستخدم لا يغيّر دوره');

select throws_ok($$ select public.transition_order((select order_id from t_ctx), 'awaiting_kitchen') $$,
  'P0001', 'ERR_TRANSITION_NOT_ALLOWED', 'العميل لا يعتمد طلبه');

-- ---------- 3. العميل ب لا يرى طلبات أ ----------
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*) from public.orders), 0::bigint, 'العميل ب لا يرى طلبات العميل أ');
select is((select count(*) from public.order_items), 0::bigint, 'ولا بنودها');
select throws_ok($$ select public.transition_order((select order_id from t_ctx), 'cancelled') $$,
  'P0001', 'ERR_NOT_FOUND', 'ولا يستطيع إلغاءها');

-- ---------- 4. المعمل لا يرى الطلب قبل الاعتماد ----------
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}';
select is((select count(*) from public.orders), 0::bigint, 'المعمل لا يرى الطلب قبل الاعتماد');

-- ---------- 5. المشرف يعتمد ----------
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}';
select throws_ok($$ select public.transition_order((select order_id from t_ctx), 'rejected') $$,
  'P0001', 'ERR_REASON_REQUIRED', 'الرفض يتطلب سبباً');
select lives_ok($$ select public.transition_order((select order_id from t_ctx), 'awaiting_kitchen') $$,
  'المشرف يعتمد الطلب');

-- ---------- 6. المعمل ----------
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}';
select is((select count(*) from public.orders), 1::bigint, 'المعمل يرى الطلب بعد الاعتماد');
select throws_ok($$ select public.transition_order((select order_id from t_ctx), 'ready') $$,
  'P0001', 'ERR_TRANSITION_NOT_ALLOWED', 'لا قفز من بانتظار المعمل إلى جاهز');
select lives_ok($$ select public.transition_order((select order_id from t_ctx), 'acknowledged') $$,
  'المعمل يؤكد الاستلام');

-- ---------- 7. تعديل طلب معتمد ينبّه المعمل ----------
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}';
select lives_ok($$ select public.update_order((select order_id from t_ctx), 1, app.riyadh_today() + 2,
    '[{"product_id":"c0000000-0000-0000-0000-00000000000c","quantity":12}]'::jsonb, null, null, 'زيادة الكمية بطلب العميل') $$,
  'المشرف يعدّل طلباً معتمداً مع ذكر السبب');

set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}';
select throws_ok($$ select public.transition_order((select order_id from t_ctx), 'in_production') $$,
  'P0001', 'ERR_CHANGE_NOT_ACKNOWLEDGED', 'لا يبدأ التجهيز قبل الاطلاع على التعديل');

-- ---------- 8. سجل التدقيق ----------
reset role;
select is((select count(*) from public.order_events where order_id = (select order_id from t_ctx) and actor_id is not null),
          4::bigint, 'كل عملية مسجلة باسم منفذها (إنشاء، اعتماد، استلام، تعديل)');

select * from finish();
rollback;
