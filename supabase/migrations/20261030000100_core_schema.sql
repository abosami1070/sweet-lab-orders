-- =====================================================================
-- Sweet Lab Orders — 0001: المخطط الأساسي
-- الجداول والأنواع والعلاقات. لا توجد بيانات تشغيلية وهمية هنا.
-- =====================================================================

create schema if not exists app;   -- دوال داخلية غير مكشوفة عبر واجهة REST

-- ---------- الأنواع ----------
create type public.app_role as enum ('super_admin', 'admin', 'kitchen_staff', 'customer');
create type public.app_locale as enum ('ar', 'en');
create type public.product_unit as enum ('piece', 'box', 'tray', 'kg', 'cake');
create type public.order_status as enum (
  'pending_approval',  -- بانتظار اعتماد الإدارة
  'needs_review',      -- أعادته الإدارة للعميل للتعديل
  'awaiting_kitchen',  -- معتمد وبانتظار تأكيد المعمل
  'acknowledged',      -- أكد المعمل الاستلام
  'in_production',     -- قيد التجهيز
  'ready',             -- جاهز
  'delivered',         -- تم التسليم
  'rejected',          -- مرفوض
  'cancelled'          -- ملغى
);
create type public.order_event_type as enum (
  'created', 'status_changed', 'items_edited', 'change_acknowledged', 'note'
);

-- ---------- دالة تحديث updated_at ----------
create or replace function app.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- العملاء (المحلات والكافيهات) ----------
create table public.customers (
  id            uuid primary key default gen_random_uuid(),
  name_ar       text not null check (char_length(trim(name_ar)) between 2 and 120),
  name_en       text not null check (char_length(trim(name_en)) between 2 and 120),
  contact_name  text check (char_length(contact_name) <= 120),
  phone         text check (phone is null or phone ~ '^9665[0-9]{8}$'),  -- صيغة موحدة 9665XXXXXXXX
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger customers_updated_at before update on public.customers
  for each row execute function app.set_updated_at();

create table public.customer_branches (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers(id) on delete cascade,
  name_ar      text not null check (char_length(trim(name_ar)) between 2 and 120),
  name_en      text not null check (char_length(trim(name_en)) between 2 and 120),
  address      text check (char_length(address) <= 500),
  phone        text check (phone is null or phone ~ '^9665[0-9]{8}$'),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index customer_branches_customer_idx on public.customer_branches(customer_id);
create trigger customer_branches_updated_at before update on public.customer_branches
  for each row execute function app.set_updated_at();

-- ---------- ملفات المستخدمين ----------
create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  full_name         text not null default '' check (char_length(full_name) <= 120),
  role              public.app_role not null default 'customer',
  customer_id       uuid references public.customers(id) on delete restrict,
  preferred_locale  public.app_locale not null default 'ar',
  is_active         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- الموظفون لا يرتبطون بعميل
  constraint profiles_staff_no_customer check (role = 'customer' or customer_id is null),
  -- العميل المفعّل يجب أن يرتبط بمحل
  constraint profiles_active_customer_linked check (role <> 'customer' or not is_active or customer_id is not null)
);
create index profiles_customer_idx on public.profiles(customer_id);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function app.set_updated_at();

-- ---------- المنتجات ----------
create table public.product_categories (
  id          uuid primary key default gen_random_uuid(),
  name_ar     text not null check (char_length(trim(name_ar)) between 1 and 80),
  name_en     text not null check (char_length(trim(name_en)) between 1 and 80),
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.products (
  id              uuid primary key default gen_random_uuid(),
  category_id     uuid references public.product_categories(id) on delete set null,
  sku             text unique check (sku is null or sku ~ '^[A-Z0-9-]{2,30}$'),
  name_ar         text not null check (char_length(trim(name_ar)) between 2 and 120),
  name_en         text not null check (char_length(trim(name_en)) between 2 and 120),
  description_ar  text check (char_length(description_ar) <= 1000),
  description_en  text check (char_length(description_en) <= 1000),
  unit            public.product_unit not null default 'piece',
  min_quantity    numeric(10,2) not null default 1 check (min_quantity > 0),
  quantity_step   numeric(10,2) not null default 1 check (quantity_step > 0),
  prep_minutes    int not null default 0 check (prep_minutes between 0 and 10080),  -- زمن التجهيز
  lead_days       int not null default 0 check (lead_days between 0 and 30),       -- أقل عدد أيام قبل التسليم
  daily_capacity  numeric(12,2) check (daily_capacity is null or daily_capacity > 0), -- null = بلا حد
  image_path      text,
  sort_order      int not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index products_category_idx on public.products(category_id);
create trigger products_updated_at before update on public.products
  for each row execute function app.set_updated_at();

-- طاقة إنتاجية مختلفة ليوم محدد (مواسم، أعياد، صيانة)
create table public.product_capacity_overrides (
  product_id     uuid not null references public.products(id) on delete cascade,
  capacity_date  date not null,
  max_quantity   numeric(12,2) not null check (max_quantity >= 0),
  primary key (product_id, capacity_date)
);

-- أيام إغلاق المعمل
create table public.closed_dates (
  closed_date  date primary key,
  reason_ar    text,
  reason_en    text,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- فترات التسليم
create table public.delivery_windows (
  id          uuid primary key default gen_random_uuid(),
  label_ar    text not null,
  label_en    text not null,
  start_time  time not null,
  end_time    time not null,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  constraint delivery_windows_range check (end_time > start_time)
);

-- إعدادات التشغيل (صف واحد فقط)
create table public.app_settings (
  id               boolean primary key default true check (id),
  timezone         text not null default 'Asia/Riyadh' check (timezone = 'Asia/Riyadh'),
  same_day_cutoff  time not null default '10:00',   -- آخر وقت لطلبات نفس اليوم
  max_days_ahead   int not null default 30 check (max_days_ahead between 1 and 180),
  updated_by       uuid references public.profiles(id) on delete set null,
  updated_at       timestamptz not null default now()
);
create trigger app_settings_updated_at before update on public.app_settings
  for each row execute function app.set_updated_at();
insert into public.app_settings default values;   -- إعدادات افتراضية وليست بيانات تشغيلية

-- ---------- الطلبات ----------
create sequence public.order_number_seq start 1001;

create table public.orders (
  id                     uuid primary key default gen_random_uuid(),
  order_number           bigint not null unique default nextval('public.order_number_seq'),
  customer_id            uuid not null references public.customers(id) on delete restrict,
  branch_id              uuid references public.customer_branches(id) on delete set null,
  created_by             uuid not null references public.profiles(id),
  delivery_date          date not null,
  delivery_window_id     uuid references public.delivery_windows(id) on delete set null,
  status                 public.order_status not null default 'pending_approval',
  customer_notes         text check (char_length(customer_notes) <= 1000),
  admin_notes            text check (char_length(admin_notes) <= 1000),
  client_request_id      uuid not null,             -- يمنع إنشاء الطلب مرتين
  revision               int not null default 1,     -- يزيد مع كل تعديل (تحكم بالتزامن)
  kitchen_seen_revision  int not null default 0,     -- آخر نسخة اطّلع عليها المعمل
  approved_by            uuid references public.profiles(id),
  approved_at            timestamptz,
  acknowledged_by        uuid references public.profiles(id),
  acknowledged_at        timestamptz,
  production_started_at  timestamptz,
  ready_at               timestamptz,
  delivered_by           uuid references public.profiles(id),
  delivered_at           timestamptz,
  closed_reason          text check (char_length(closed_reason) <= 500),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint orders_idempotency unique (customer_id, client_request_id)
);
create index orders_customer_idx      on public.orders(customer_id, created_at desc);
create index orders_status_date_idx   on public.orders(status, delivery_date);
create index orders_delivery_date_idx on public.orders(delivery_date);
create trigger orders_updated_at before update on public.orders
  for each row execute function app.set_updated_at();

create table public.order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders(id) on delete cascade,
  product_id       uuid not null references public.products(id) on delete restrict,
  quantity         numeric(12,2) not null check (quantity > 0),
  item_notes       text check (char_length(item_notes) <= 300),
  -- لقطة من اسم المنتج ووحدته وقت الطلب، حتى لا يتغير الطلب إذا عُدّل المنتج لاحقاً
  product_name_ar  text not null,
  product_name_en  text not null,
  unit             public.product_unit not null,
  constraint order_items_unique_product unique (order_id, product_id)
);
create index order_items_product_idx on public.order_items(product_id);

-- سجل التدقيق: من فعل ماذا ومتى ولماذا
create table public.order_events (
  id           bigint generated always as identity primary key,
  order_id     uuid not null references public.orders(id) on delete cascade,
  actor_id     uuid references public.profiles(id) on delete set null,
  actor_role   public.app_role,
  event_type   public.order_event_type not null,
  from_status  public.order_status,
  to_status    public.order_status,
  reason       text check (char_length(reason) <= 500),
  changes      jsonb,
  revision     int not null,
  created_at   timestamptz not null default now()
);
create index order_events_order_idx on public.order_events(order_id, created_at);
