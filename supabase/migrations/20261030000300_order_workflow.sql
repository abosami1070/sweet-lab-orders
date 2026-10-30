-- =====================================================================
-- Sweet Lab Orders — 0003: دورة الطلب والجدولة (منطق خلفي)
-- كل الأخطاء ترجع رسالة بمفتاح ثابت ERR_* تترجمه الواجهة.
-- =====================================================================

-- ---------- الوقت بتوقيت الرياض ----------
create or replace function app.riyadh_now()
returns timestamp language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Riyadh')
$$;

create or replace function app.riyadh_today()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Riyadh')::date
$$;

-- ---------- مصفوفة الانتقالات المسموحة ----------
create or replace function app.allowed_transition(
  p_role public.app_role, p_from public.order_status, p_to public.order_status, p_is_owner boolean
) returns boolean language sql immutable set search_path = '' as $$
  select case
    when p_role = 'super_admin' then (p_from::text || '>' || p_to::text) = any (array[
      'pending_approval>awaiting_kitchen', 'pending_approval>rejected', 'pending_approval>needs_review',
      'pending_approval>cancelled', 'needs_review>rejected', 'needs_review>cancelled',
      'awaiting_kitchen>needs_review', 'awaiting_kitchen>cancelled', 'acknowledged>cancelled', 'in_production>cancelled',
      'awaiting_kitchen>acknowledged', 'acknowledged>in_production', 'in_production>ready', 'ready>delivered'])
    when p_role = 'admin' then (p_from::text || '>' || p_to::text) = any (array[
      'pending_approval>awaiting_kitchen', 'pending_approval>rejected', 'pending_approval>needs_review',
      'pending_approval>cancelled', 'needs_review>rejected', 'needs_review>cancelled',
      'awaiting_kitchen>needs_review', 'awaiting_kitchen>cancelled', 'acknowledged>cancelled', 'in_production>cancelled',
      'ready>delivered'])
    when p_role = 'kitchen_staff' then (p_from::text || '>' || p_to::text) = any (array[
      'awaiting_kitchen>acknowledged', 'acknowledged>in_production', 'in_production>ready', 'ready>delivered'])
    when p_role = 'customer' and p_is_owner then (p_from::text || '>' || p_to::text) = any (array[
      'pending_approval>cancelled', 'needs_review>cancelled', 'needs_review>pending_approval'])
    else false
  end
$$;

-- انتقالات تتطلب ذكر السبب
create or replace function app.transition_requires_reason(p_to public.order_status, p_from public.order_status)
returns boolean language sql immutable set search_path = '' as $$
  select p_to in ('rejected', 'needs_review')
      or (p_to = 'cancelled' and p_from not in ('pending_approval', 'needs_review'))
$$;

-- ---------- التحقق من الموعد والكميات والطاقة ----------
-- p_items: [{ "product_id": uuid, "quantity": number, "notes": text }]
create or replace function app.assert_deliverable(
  p_delivery_date date, p_items jsonb, p_exclude_order uuid default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_settings public.app_settings;
  v_today    date := app.riyadh_today();
  v_item     jsonb;
  v_product  public.products;
  v_qty      numeric;
  v_capacity numeric;
  v_booked   numeric;
begin
  select * into v_settings from public.app_settings where id;

  if p_delivery_date is null then raise exception 'ERR_DATE_REQUIRED'; end if;
  if p_delivery_date < v_today then raise exception 'ERR_DATE_IN_PAST'; end if;
  if p_delivery_date > v_today + v_settings.max_days_ahead then raise exception 'ERR_DATE_TOO_FAR'; end if;
  if exists (select 1 from public.closed_dates where closed_date = p_delivery_date) then
    raise exception 'ERR_DATE_CLOSED';
  end if;
  if p_delivery_date = v_today and app.riyadh_now()::time >= v_settings.same_day_cutoff then
    raise exception 'ERR_CUTOFF_PASSED';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'ERR_ITEMS_REQUIRED';
  end if;
  if jsonb_array_length(p_items) > 100 then raise exception 'ERR_TOO_MANY_ITEMS'; end if;
  if (select count(distinct e->>'product_id') from jsonb_array_elements(p_items) e) <> jsonb_array_length(p_items) then
    raise exception 'ERR_DUPLICATE_PRODUCT';
  end if;

  -- قفل على مستوى اليوم يمنع تجاوز الطاقة عند وصول طلبين في نفس اللحظة
  perform pg_advisory_xact_lock(hashtext('sweetlab:capacity:' || p_delivery_date::text));

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products
      where id = (v_item->>'product_id')::uuid and is_active;
    if not found then raise exception 'ERR_PRODUCT_UNAVAILABLE' using detail = v_item->>'product_id'; end if;

    v_qty := (v_item->>'quantity')::numeric;
    if v_qty is null or v_qty < v_product.min_quantity then
      raise exception 'ERR_QUANTITY_BELOW_MIN' using detail = v_product.id::text;
    end if;
    if mod(v_qty, v_product.quantity_step) <> 0 then
      raise exception 'ERR_QUANTITY_STEP' using detail = v_product.id::text;
    end if;
    if p_delivery_date < v_today + v_product.lead_days then
      raise exception 'ERR_LEAD_TIME' using detail = v_product.id::text;
    end if;

    select coalesce(
      (select max_quantity from public.product_capacity_overrides
        where product_id = v_product.id and capacity_date = p_delivery_date),
      v_product.daily_capacity
    ) into v_capacity;

    if v_capacity is not null then
      select coalesce(sum(oi.quantity), 0) into v_booked
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.product_id = v_product.id
        and o.delivery_date = p_delivery_date
        and o.status not in ('rejected', 'cancelled')
        and (p_exclude_order is null or o.id <> p_exclude_order);
      if v_booked + v_qty > v_capacity then
        raise exception 'ERR_CAPACITY_EXCEEDED' using detail = v_product.id::text;
      end if;
    end if;
  end loop;
end $$;

-- كتابة البنود مع لقطة الاسم والوحدة
create or replace function app.write_items(p_order_id uuid, p_items jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.order_items where order_id = p_order_id;
  insert into public.order_items (order_id, product_id, quantity, item_notes, product_name_ar, product_name_en, unit)
  select p_order_id, p.id, (e->>'quantity')::numeric, nullif(trim(e->>'notes'), ''), p.name_ar, p.name_en, p.unit
  from jsonb_array_elements(p_items) e
  join public.products p on p.id = (e->>'product_id')::uuid;
end $$;

create or replace function app.items_snapshot(p_order_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'product_id', product_id, 'name_ar', product_name_ar, 'name_en', product_name_en,
    'quantity', quantity, 'notes', item_notes) order by product_name_en), '[]'::jsonb)
  from public.order_items where order_id = p_order_id
$$;

-- ---------- إنشاء الطلب ----------
create or replace function public.place_order(
  p_client_request_id  uuid,
  p_delivery_date      date,
  p_items              jsonb,
  p_delivery_window_id uuid default null,
  p_branch_id          uuid default null,
  p_notes              text default null,
  p_customer_id        uuid default null   -- للمشرف عند الطلب نيابة عن عميل
) returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  v_role     public.app_role := app.user_role();
  v_customer uuid;
  v_order    public.orders;
begin
  if v_role is null then raise exception 'ERR_FORBIDDEN'; end if;
  if p_client_request_id is null then raise exception 'ERR_REQUEST_ID_REQUIRED'; end if;

  if v_role = 'customer' then
    v_customer := app.user_customer_id();
    if p_customer_id is not null and p_customer_id <> v_customer then raise exception 'ERR_FORBIDDEN'; end if;
  elsif v_role in ('admin', 'super_admin') then
    v_customer := p_customer_id;
    if v_customer is null then raise exception 'ERR_CUSTOMER_REQUIRED'; end if;
  else
    raise exception 'ERR_FORBIDDEN';
  end if;

  if not exists (select 1 from public.customers where id = v_customer and is_active) then
    raise exception 'ERR_CUSTOMER_INACTIVE';
  end if;

  -- طلب مكرر بنفس المعرف؟ أعد الطلب الأصلي بدل إنشاء نسخة ثانية
  select * into v_order from public.orders
    where customer_id = v_customer and client_request_id = p_client_request_id;
  if found then return v_order; end if;

  if p_branch_id is not null and not exists (
    select 1 from public.customer_branches where id = p_branch_id and customer_id = v_customer and is_active
  ) then raise exception 'ERR_BRANCH_INVALID'; end if;

  if p_delivery_window_id is not null and not exists (
    select 1 from public.delivery_windows where id = p_delivery_window_id and is_active
  ) then raise exception 'ERR_WINDOW_INVALID'; end if;

  perform app.assert_deliverable(p_delivery_date, p_items, null);

  insert into public.orders (customer_id, branch_id, created_by, delivery_date, delivery_window_id,
                             customer_notes, client_request_id)
  values (v_customer, p_branch_id, auth.uid(), p_delivery_date, p_delivery_window_id,
          nullif(trim(p_notes), ''), p_client_request_id)
  on conflict on constraint orders_idempotency do nothing
  returning * into v_order;

  if v_order.id is null then   -- سباق نادر بين طلبين متطابقين
    select * into v_order from public.orders
      where customer_id = v_customer and client_request_id = p_client_request_id;
    return v_order;
  end if;

  perform app.write_items(v_order.id, p_items);

  insert into public.order_events (order_id, actor_id, actor_role, event_type, to_status, changes, revision)
  values (v_order.id, auth.uid(), v_role, 'created', v_order.status,
          jsonb_build_object('items', app.items_snapshot(v_order.id)), v_order.revision);

  return v_order;
end $$;

-- ---------- تعديل الطلب ----------
create or replace function public.update_order(
  p_order_id           uuid,
  p_expected_revision  int,
  p_delivery_date      date,
  p_items              jsonb,
  p_delivery_window_id uuid default null,
  p_notes              text default null,
  p_reason             text default null
) returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  v_role    public.app_role := app.user_role();
  v_order   public.orders;
  v_before  jsonb;
  v_after   jsonb;
  v_new_status public.order_status;
  v_old_status public.order_status;
begin
  if v_role is null then raise exception 'ERR_FORBIDDEN'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ERR_NOT_FOUND'; end if;

  if v_role = 'customer' then
    if v_order.customer_id is distinct from app.user_customer_id() then raise exception 'ERR_NOT_FOUND'; end if;
    if v_order.status not in ('pending_approval', 'needs_review') then raise exception 'ERR_ORDER_LOCKED'; end if;
  elsif v_role in ('admin', 'super_admin') then
    if v_order.status not in ('pending_approval', 'needs_review', 'awaiting_kitchen', 'acknowledged', 'in_production') then
      raise exception 'ERR_ORDER_LOCKED';
    end if;
  else
    raise exception 'ERR_FORBIDDEN';
  end if;

  if v_order.revision <> p_expected_revision then raise exception 'ERR_STALE_REVISION'; end if;

  -- تعديل طلب معتمد يتطلب سبباً لأنه سيُنبَّه المعمل
  if v_order.approved_at is not null and coalesce(trim(p_reason), '') = '' then
    raise exception 'ERR_REASON_REQUIRED';
  end if;

  if p_delivery_window_id is not null and not exists (
    select 1 from public.delivery_windows where id = p_delivery_window_id and is_active
  ) then raise exception 'ERR_WINDOW_INVALID'; end if;

  perform app.assert_deliverable(p_delivery_date, p_items, v_order.id);

  v_old_status := v_order.status;
  v_before := jsonb_build_object('delivery_date', v_order.delivery_date,
    'delivery_window_id', v_order.delivery_window_id, 'notes', v_order.customer_notes,
    'items', app.items_snapshot(v_order.id));

  perform app.write_items(v_order.id, p_items);

  -- العميل يعدل بعد "يحتاج مراجعة" → يعود للاعتماد
  v_new_status := case when v_role = 'customer' and v_order.status = 'needs_review'
                       then 'pending_approval'::public.order_status else v_order.status end;

  update public.orders set
    delivery_date      = p_delivery_date,
    delivery_window_id = p_delivery_window_id,
    customer_notes     = nullif(trim(p_notes), ''),
    status             = v_new_status,
    revision           = revision + 1
  where id = v_order.id
  returning * into v_order;

  v_after := jsonb_build_object('delivery_date', v_order.delivery_date,
    'delivery_window_id', v_order.delivery_window_id, 'notes', v_order.customer_notes,
    'items', app.items_snapshot(v_order.id));

  insert into public.order_events (order_id, actor_id, actor_role, event_type, from_status, to_status, reason, changes, revision)
  values (v_order.id, auth.uid(), v_role, 'items_edited', v_old_status, v_new_status,
          nullif(trim(p_reason), ''), jsonb_build_object('before', v_before, 'after', v_after), v_order.revision);

  return v_order;
end $$;

-- ---------- نقل الطلب بين الحالات ----------
create or replace function public.transition_order(
  p_order_id          uuid,
  p_to                public.order_status,
  p_reason            text default null,
  p_expected_revision int  default null
) returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  v_role     public.app_role := app.user_role();
  v_order    public.orders;
  v_from     public.order_status;
  v_is_owner boolean;
begin
  if v_role is null then raise exception 'ERR_FORBIDDEN'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ERR_NOT_FOUND'; end if;

  v_is_owner := v_role = 'customer' and v_order.customer_id = app.user_customer_id();

  -- لا يكشف وجود طلب لا يحق للمستخدم رؤيته
  if v_role = 'customer' and not v_is_owner then raise exception 'ERR_NOT_FOUND'; end if;
  if v_role = 'kitchen_staff' and not app.kitchen_visible(v_order.status, v_order.approved_at) then
    raise exception 'ERR_NOT_FOUND';
  end if;

  if p_expected_revision is not null and v_order.revision <> p_expected_revision then
    raise exception 'ERR_STALE_REVISION';
  end if;

  v_from := v_order.status;
  if not app.allowed_transition(v_role, v_from, p_to, v_is_owner) then
    raise exception 'ERR_TRANSITION_NOT_ALLOWED';
  end if;

  if app.transition_requires_reason(p_to, v_from) and coalesce(trim(p_reason), '') = '' then
    raise exception 'ERR_REASON_REQUIRED';
  end if;

  -- المعمل لا يتقدم بطلب عُدّل بعد استلامه قبل أن يؤكد اطلاعه على التعديل
  if v_role in ('kitchen_staff', 'super_admin')
     and v_from in ('acknowledged', 'in_production', 'ready')
     and v_order.revision > v_order.kitchen_seen_revision
     and p_to <> 'cancelled' then
    raise exception 'ERR_CHANGE_NOT_ACKNOWLEDGED';
  end if;

  update public.orders set
    status                = p_to,
    approved_by           = case when p_to = 'awaiting_kitchen' then auth.uid() else approved_by end,
    approved_at           = case when p_to = 'awaiting_kitchen' then now() else approved_at end,
    acknowledged_by       = case when p_to = 'acknowledged' then auth.uid() else acknowledged_by end,
    acknowledged_at       = case when p_to = 'acknowledged' then now() else acknowledged_at end,
    kitchen_seen_revision = case when p_to = 'acknowledged' then revision else kitchen_seen_revision end,
    production_started_at = case when p_to = 'in_production' then now() else production_started_at end,
    ready_at              = case when p_to = 'ready' then now() else ready_at end,
    delivered_by          = case when p_to = 'delivered' then auth.uid() else delivered_by end,
    delivered_at          = case when p_to = 'delivered' then now() else delivered_at end,
    closed_reason         = case when p_to in ('rejected', 'cancelled', 'needs_review')
                                 then nullif(trim(p_reason), '') else closed_reason end
  where id = v_order.id
  returning * into v_order;

  insert into public.order_events (order_id, actor_id, actor_role, event_type, from_status, to_status, reason, revision)
  values (v_order.id, auth.uid(), v_role, 'status_changed', v_from, p_to, nullif(trim(p_reason), ''), v_order.revision);

  return v_order;
end $$;

-- ---------- تأكيد المعمل للاطلاع على تعديل ----------
create or replace function public.acknowledge_order_change(p_order_id uuid)
returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  v_role  public.app_role := app.user_role();
  v_order public.orders;
begin
  if v_role is null or v_role not in ('kitchen_staff', 'super_admin') then raise exception 'ERR_FORBIDDEN'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found or not app.kitchen_visible(v_order.status, v_order.approved_at) then
    raise exception 'ERR_NOT_FOUND';
  end if;
  if v_order.revision <= v_order.kitchen_seen_revision then return v_order; end if;

  update public.orders set kitchen_seen_revision = revision where id = v_order.id returning * into v_order;

  insert into public.order_events (order_id, actor_id, actor_role, event_type, revision)
  values (v_order.id, auth.uid(), v_role, 'change_acknowledged', v_order.revision);

  return v_order;
end $$;

-- ---------- عروض (Views) تحترم RLS ----------
-- عداد الحالات: كل مستخدم يرى أعداد ما يحق له فقط
create view public.order_status_counts with (security_invoker = true) as
  select status, count(*)::int as total
  from public.orders
  group by status;

-- جدول الإنتاج: مجموع الكميات لكل صنف ويوم، مع بقاء تفاصيل الطلبات في order_items
create view public.production_plan with (security_invoker = true) as
  select o.delivery_date,
         oi.product_id,
         oi.product_name_ar,
         oi.product_name_en,
         oi.unit,
         sum(oi.quantity) filter (where o.status in ('awaiting_kitchen','acknowledged','in_production','ready','delivered')) as approved_quantity,
         sum(oi.quantity) filter (where o.status in ('pending_approval','needs_review'))                                   as pending_quantity,
         count(distinct o.id) filter (where o.status not in ('rejected','cancelled'))                                     as order_count
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.status not in ('rejected', 'cancelled')
  group by o.delivery_date, oi.product_id, oi.product_name_ar, oi.product_name_en, oi.unit;

revoke all on public.order_status_counts, public.production_plan from anon;
grant select on public.order_status_counts, public.production_plan to authenticated;

-- ---------- صلاحيات الدوال ----------
revoke all on function public.place_order(uuid, date, jsonb, uuid, uuid, text, uuid) from public, anon;
revoke all on function public.update_order(uuid, int, date, jsonb, uuid, text, text) from public, anon;
revoke all on function public.transition_order(uuid, public.order_status, text, int) from public, anon;
revoke all on function public.acknowledge_order_change(uuid) from public, anon;
grant execute on function public.place_order(uuid, date, jsonb, uuid, uuid, text, uuid) to authenticated;
grant execute on function public.update_order(uuid, int, date, jsonb, uuid, text, text) to authenticated;
grant execute on function public.transition_order(uuid, public.order_status, text, int) to authenticated;
grant execute on function public.acknowledge_order_change(uuid) to authenticated;

revoke all on all functions in schema app from public;
grant execute on function
  app.user_role(), app.user_customer_id(), app.is_admin(), app.is_staff(),
  app.is_active_user(), app.kitchen_visible(public.order_status, timestamptz),
  app.riyadh_today(), app.riyadh_now()
to authenticated;

-- ---------- التحديث الفوري ----------
-- Realtime يطبق سياسات RLS نفسها: كل مستخدم يستقبل تغييرات ما يحق له رؤيته فقط
alter publication supabase_realtime add table public.orders, public.order_events;
