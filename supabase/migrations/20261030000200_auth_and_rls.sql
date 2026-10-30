-- =====================================================================
-- Sweet Lab Orders — 0002: الهوية والصلاحيات وسياسات RLS
-- المبدأ: القراءة عبر RLS، والكتابة الحساسة (الطلبات والأدوار) عبر دوال
-- خلفية فقط تتحقق من الدور والحالة وتسجل الحدث.
-- =====================================================================

grant usage on schema app to authenticated;

-- ---------- دوال مساعدة (SECURITY DEFINER لتفادي تكرار RLS على profiles) ----------
create or replace function app.user_role()
returns public.app_role language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.is_active
$$;

create or replace function app.user_customer_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select p.customer_id from public.profiles p
  where p.id = auth.uid() and p.is_active and p.role = 'customer'
$$;

create or replace function app.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(app.user_role() in ('admin', 'super_admin'), false)
$$;

create or replace function app.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(app.user_role() in ('admin', 'super_admin', 'kitchen_staff'), false)
$$;

create or replace function app.is_active_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select app.user_role() is not null
$$;

-- الحالات التي يراها المعمل
create or replace function app.kitchen_visible(p_status public.order_status, p_approved_at timestamptz)
returns boolean language sql immutable set search_path = '' as $$
  select p_status in ('awaiting_kitchen', 'acknowledged', 'in_production', 'ready', 'delivered')
      or (p_status = 'cancelled' and p_approved_at is not null)
$$;

revoke all on all functions in schema app from public;
grant execute on function
  app.user_role(), app.user_customer_id(), app.is_admin(), app.is_staff(),
  app.is_active_user(), app.kitchen_visible(public.order_status, timestamptz)
to authenticated;

-- ---------- إنشاء الملف الشخصي تلقائياً ----------
-- الدور والعميل يُقرآن من app_metadata فقط (لا يستطيع المستخدم تعديلها؛ تُضبط بمفتاح الخدمة).
-- أي حساب بلا app_metadata صحيح يُنشأ كعميل غير مفعّل.
create or replace function app.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_role     public.app_role := coalesce(nullif(new.raw_app_meta_data->>'role', '')::public.app_role, 'customer');
  v_customer uuid := nullif(new.raw_app_meta_data->>'customer_id', '')::uuid;
  v_locale   public.app_locale := coalesce(nullif(new.raw_user_meta_data->>'preferred_locale', '')::public.app_locale, 'ar');
begin
  if v_role <> 'customer' then v_customer := null; end if;
  insert into public.profiles (id, full_name, role, customer_id, preferred_locale, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    v_role, v_customer, v_locale,
    coalesce((new.raw_app_meta_data->>'is_active')::boolean, false)
      and (v_role <> 'customer' or v_customer is not null)
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

-- ---------- تفعيل RLS ----------
alter table public.customers                 enable row level security;
alter table public.customer_branches         enable row level security;
alter table public.profiles                  enable row level security;
alter table public.product_categories        enable row level security;
alter table public.products                  enable row level security;
alter table public.product_capacity_overrides enable row level security;
alter table public.closed_dates              enable row level security;
alter table public.delivery_windows          enable row level security;
alter table public.app_settings              enable row level security;
alter table public.orders                    enable row level security;
alter table public.order_items               enable row level security;
alter table public.order_events              enable row level security;

-- ---------- الصلاحيات على مستوى الجداول ----------
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;

-- الطلبات وسجلها والأدوار: لا كتابة مباشرة إطلاقاً، فقط عبر الدوال الخلفية
revoke insert, update, delete on public.orders, public.order_items, public.order_events from authenticated;
revoke insert, delete on public.profiles from authenticated;
revoke update on public.profiles from authenticated;
grant  update (full_name, preferred_locale) on public.profiles to authenticated;
revoke insert, delete on public.app_settings from authenticated;
revoke usage on sequence public.order_number_seq from authenticated;

-- ---------- السياسات ----------
-- العملاء
create policy customers_select on public.customers for select to authenticated
  using (app.is_staff() or id = app.user_customer_id());
create policy customers_admin_insert on public.customers for insert to authenticated
  with check (app.is_admin());
create policy customers_admin_update on public.customers for update to authenticated
  using (app.is_admin()) with check (app.is_admin());

-- الفروع
create policy branches_select on public.customer_branches for select to authenticated
  using (app.is_staff() or customer_id = app.user_customer_id());
create policy branches_admin_insert on public.customer_branches for insert to authenticated
  with check (app.is_admin());
create policy branches_admin_update on public.customer_branches for update to authenticated
  using (app.is_admin()) with check (app.is_admin());

-- الملفات الشخصية: المستخدم يرى نفسه، والموظفون يرون الجميع (لأسماء المنفذين في السجل)
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or app.is_staff());
-- تعديل الاسم واللغة فقط (الأعمدة مقيدة بالـ GRANT أعلاه)
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- الكتالوج والإعدادات: يقرؤها كل مستخدم مفعّل، ويعدلها المشرف
do $$
declare t text;
begin
  foreach t in array array['product_categories','products','product_capacity_overrides','closed_dates','delivery_windows']
  loop
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (app.is_active_user())', t);
    execute format('create policy %1$s_admin_insert on public.%1$s for insert to authenticated with check (app.is_admin())', t);
    execute format('create policy %1$s_admin_update on public.%1$s for update to authenticated using (app.is_admin()) with check (app.is_admin())', t);
    execute format('create policy %1$s_admin_delete on public.%1$s for delete to authenticated using (app.is_admin())', t);
  end loop;
end $$;

create policy app_settings_select on public.app_settings for select to authenticated
  using (app.is_active_user());
create policy app_settings_admin_update on public.app_settings for update to authenticated
  using (app.is_admin()) with check (app.is_admin());

-- الطلبات: المشرف يرى الكل، العميل يرى طلبات محله فقط، المعمل يرى المعتمد فقط
create policy orders_select on public.orders for select to authenticated
  using (
    app.is_admin()
    or (customer_id = app.user_customer_id())
    or (app.user_role() = 'kitchen_staff' and app.kitchen_visible(status, approved_at))
  );

-- البنود والسجل تتبع صلاحية الطلب (RLS على orders تُطبق داخل الاستعلام الفرعي)
create policy order_items_select on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));
create policy order_events_select on public.order_events for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));

-- ---------- إدارة المستخدمين (خلفية) ----------
-- المشرف العام فقط يغيّر الأدوار. المشرف يستطيع ربط عميل بمحل وتفعيله.
create or replace function public.admin_update_profile(
  p_user_id     uuid,
  p_role        public.app_role,
  p_customer_id uuid,
  p_is_active   boolean,
  p_full_name   text default null
) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  v_actor_role public.app_role := app.user_role();
  v_target     public.profiles;
  v_result     public.profiles;
begin
  if v_actor_role is null or v_actor_role not in ('admin', 'super_admin') then
    raise exception 'ERR_FORBIDDEN';
  end if;

  select * into v_target from public.profiles where id = p_user_id for update;
  if not found then raise exception 'ERR_NOT_FOUND'; end if;

  if v_actor_role = 'admin' and (
       p_role <> 'customer' or v_target.role <> 'customer'
  ) then
    raise exception 'ERR_FORBIDDEN';   -- المشرف لا يدير حسابات الموظفين
  end if;

  if p_user_id = auth.uid() and (p_role <> v_target.role or not p_is_active) then
    raise exception 'ERR_CANNOT_CHANGE_OWN_ROLE';
  end if;

  if v_target.role = 'super_admin' and (p_role <> 'super_admin' or not p_is_active)
     and (select count(*) from public.profiles where role = 'super_admin' and is_active) <= 1 then
    raise exception 'ERR_LAST_SUPER_ADMIN';
  end if;

  if p_role = 'customer' and p_is_active and p_customer_id is null then
    raise exception 'ERR_CUSTOMER_REQUIRED';
  end if;

  update public.profiles set
    role        = p_role,
    customer_id = case when p_role = 'customer' then p_customer_id end,
    is_active   = p_is_active,
    full_name   = coalesce(nullif(trim(p_full_name), ''), full_name)
  where id = p_user_id
  returning * into v_result;

  return v_result;
end $$;

revoke all on function public.admin_update_profile(uuid, public.app_role, uuid, boolean, text) from public, anon;
grant execute on function public.admin_update_profile(uuid, public.app_role, uuid, boolean, text) to authenticated;
