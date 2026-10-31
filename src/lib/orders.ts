import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { OrderStatus, ProductUnit } from '@/types/app';

// ===== أنواع مشتركة لشاشات الطلبات =====

export type OrderItem = {
  product_id: string;
  quantity: number;
  item_notes: string | null;
  product_name_ar: string;
  product_name_en: string;
  unit: ProductUnit;
};

export type OrderRow = {
  id: string;
  order_number: number;
  customer_id: string;
  branch_id: string | null;
  delivery_date: string;
  delivery_window_id: string | null;
  status: OrderStatus;
  customer_notes: string | null;
  closed_reason: string | null;
  revision: number;
  kitchen_seen_revision: number;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  customer: { name_ar: string; name_en: string } | null;
  branch: { name_ar: string; name_en: string } | null;
  window: { label_ar: string; label_en: string; start_time: string; end_time: string } | null;
  order_items: OrderItem[];
};

export type OrderEvent = {
  id: number;
  actor_role: string | null;
  event_type: 'created' | 'status_changed' | 'items_edited' | 'change_acknowledged' | 'note';
  from_status: OrderStatus | null;
  to_status: OrderStatus | null;
  reason: string | null;
  changes: Record<string, unknown> | null;
  revision: number;
  created_at: string;
};

export const ORDER_SELECT = `
  id, order_number, customer_id, branch_id, delivery_date, delivery_window_id, status,
  customer_notes, closed_reason, revision, kitchen_seen_revision, approved_at, created_at, updated_at,
  customer:customers(name_ar, name_en),
  branch:customer_branches(name_ar, name_en),
  window:delivery_windows(label_ar, label_en, start_time, end_time),
  order_items(product_id, quantity, item_notes, product_name_ar, product_name_en, unit)
`;

// الطلب الواحد مع سجله. RLS تحدد إن كان المستخدم يراه أصلاً
export async function getOrder(id: string) {
  const supabase = await createClient();
  const [{ data: order }, { data: events }] = await Promise.all([
    supabase.from('orders').select(ORDER_SELECT).eq('id', id).maybeSingle(),
    supabase
      .from('order_events')
      .select('id, actor_role, event_type, from_status, to_status, reason, changes, revision, created_at')
      .eq('order_id', id)
      .order('created_at', { ascending: false })
  ]);
  return { order: (order as unknown as OrderRow) ?? null, events: (events ?? []) as OrderEvent[] };
}

// ===== بيانات نموذج الطلب =====

export type CatalogProduct = {
  id: string;
  category_id: string | null;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  unit: ProductUnit;
  min_quantity: number;
  quantity_step: number;
  lead_days: number;
  daily_capacity: number | null;
};

export type OrderFormData = {
  products: CatalogProduct[];
  categories: { id: string; name_ar: string; name_en: string }[];
  windows: { id: string; label_ar: string; label_en: string; start_time: string; end_time: string }[];
  branches: { id: string; name_ar: string; name_en: string }[];
  closedDates: { date: string; reason_ar: string | null; reason_en: string | null }[];
  cutoff: string;
  maxDaysAhead: number;
};

export async function getOrderFormData(customerId: string): Promise<OrderFormData> {
  const supabase = await createClient();
  const [products, categories, windows, branches, closed, settings] = await Promise.all([
    supabase
      .from('products')
      .select('id, category_id, name_ar, name_en, description_ar, description_en, unit, min_quantity, quantity_step, lead_days, daily_capacity')
      .eq('is_active', true)
      .order('sort_order')
      .order('name_ar'),
    supabase.from('product_categories').select('id, name_ar, name_en').eq('is_active', true).order('sort_order'),
    supabase.from('delivery_windows').select('id, label_ar, label_en, start_time, end_time').eq('is_active', true).order('sort_order').order('start_time'),
    supabase.from('customer_branches').select('id, name_ar, name_en').eq('customer_id', customerId).eq('is_active', true).order('name_ar'),
    supabase.from('closed_dates').select('closed_date, reason_ar, reason_en').order('closed_date'),
    supabase.from('app_settings').select('same_day_cutoff, max_days_ahead').maybeSingle()
  ]);
  return {
    products: (products.data ?? []).map((p: CatalogProduct) => ({
      ...p,
      min_quantity: Number(p.min_quantity),
      quantity_step: Number(p.quantity_step),
      daily_capacity: p.daily_capacity === null ? null : Number(p.daily_capacity)
    })),
    categories: categories.data ?? [],
    windows: windows.data ?? [],
    branches: branches.data ?? [],
    closedDates: (closed.data ?? []).map((c: { closed_date: string; reason_ar: string | null; reason_en: string | null }) => ({
      date: c.closed_date,
      reason_ar: c.reason_ar,
      reason_en: c.reason_en
    })),
    cutoff: (settings.data?.same_day_cutoff as string | undefined)?.slice(0, 5) ?? '10:00',
    maxDaysAhead: (settings.data?.max_days_ahead as number | undefined) ?? 30
  };
}
