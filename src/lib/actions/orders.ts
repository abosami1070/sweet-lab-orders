'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth';
import { dbErrorKey, isUuid, DATE_RE } from '@/lib/forms';
import { ORDER_STATUSES, type OrderStatus } from '@/types/app';

// نتيجة موحدة لإجراءات الطلبات: مفتاح خطأ مترجم، أو معرّف الطلب عند النجاح
export type OrderResult = { ok: true; orderId: string; revision: number } | { ok: false; error: string; detail?: string };

export type OrderInput = {
  requestId?: string;
  orderId?: string;
  expectedRevision?: number;
  deliveryDate: string;
  windowId: string | null;
  branchId: string | null;
  notes: string;
  reason?: string;
  customerId?: string;
  items: { product_id: string; quantity: number; notes?: string }[];
};

const fail = (error: { code?: string; message?: string; details?: string | null } | null): OrderResult => ({
  ok: false,
  error: dbErrorKey(error),
  // بعض أخطاء القاعدة تحمل معرّف المنتج المعني في detail لتمييزه في النموذج
  detail: error?.details && isUuid(error.details) ? error.details : undefined
});

const refresh = () => revalidatePath('/', 'layout');

// تحقق بنيوي سريع قبل الوصول للقاعدة. القواعد الفعلية (التاريخ، الطاقة، الحد الأدنى…) في place_order/update_order
function cleanInput(input: OrderInput) {
  if (!input || !DATE_RE.test(input.deliveryDate ?? '')) return { error: 'errors.ERR_DATE_REQUIRED' } as const;
  const items = (input.items ?? [])
    .filter((i) => isUuid(i.product_id) && Number.isFinite(i.quantity) && i.quantity > 0)
    .map((i) => ({ product_id: i.product_id, quantity: i.quantity, notes: (i.notes ?? '').trim().slice(0, 300) }));
  if (items.length === 0) return { error: 'errors.ERR_ITEMS_REQUIRED' } as const;
  return {
    items,
    windowId: input.windowId && isUuid(input.windowId) ? input.windowId : null,
    branchId: input.branchId && isUuid(input.branchId) ? input.branchId : null,
    notes: (input.notes ?? '').trim().slice(0, 1000)
  } as const;
}

export async function placeOrder(input: OrderInput): Promise<OrderResult> {
  const profile = await getCurrentProfile();
  if (!profile?.is_active) return { ok: false, error: 'errors.ERR_FORBIDDEN' };
  if (!input.requestId || !isUuid(input.requestId)) return { ok: false, error: 'errors.ERR_REQUEST_ID_REQUIRED' };
  const c = cleanInput(input);
  if ('error' in c) return { ok: false, error: c.error as string };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('place_order', {
    p_client_request_id: input.requestId,
    p_delivery_date: input.deliveryDate,
    p_items: c.items,
    p_delivery_window_id: c.windowId,
    p_branch_id: c.branchId,
    p_notes: c.notes || null,
    p_customer_id: profile.role === 'customer' ? null : input.customerId ?? null
  });
  if (error || !data) return fail(error);
  refresh();
  return { ok: true, orderId: data.id, revision: data.revision };
}

export async function updateOrder(input: OrderInput): Promise<OrderResult> {
  const profile = await getCurrentProfile();
  if (!profile?.is_active) return { ok: false, error: 'errors.ERR_FORBIDDEN' };
  if (!input.orderId || !isUuid(input.orderId) || typeof input.expectedRevision !== 'number') {
    return { ok: false, error: 'errors.ERR_NOT_FOUND' };
  }
  const c = cleanInput(input);
  if ('error' in c) return { ok: false, error: c.error as string };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('update_order', {
    p_order_id: input.orderId,
    p_expected_revision: input.expectedRevision,
    p_delivery_date: input.deliveryDate,
    p_items: c.items,
    p_delivery_window_id: c.windowId,
    p_notes: c.notes || null,
    p_reason: (input.reason ?? '').trim().slice(0, 500) || null
  });
  if (error || !data) return fail(error);
  refresh();
  return { ok: true, orderId: data.id, revision: data.revision };
}

export async function transitionOrder(orderId: string, to: OrderStatus, reason: string | null, expectedRevision: number): Promise<OrderResult> {
  const profile = await getCurrentProfile();
  if (!profile?.is_active) return { ok: false, error: 'errors.ERR_FORBIDDEN' };
  if (!isUuid(orderId) || !ORDER_STATUSES.includes(to)) return { ok: false, error: 'errors.ERR_NOT_FOUND' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('transition_order', {
    p_order_id: orderId,
    p_to: to,
    p_reason: (reason ?? '').trim().slice(0, 500) || null,
    p_expected_revision: expectedRevision
  });
  if (error || !data) return fail(error);
  refresh();
  return { ok: true, orderId: data.id, revision: data.revision };
}

export async function acknowledgeChange(orderId: string): Promise<OrderResult> {
  const profile = await getCurrentProfile();
  if (!profile?.is_active) return { ok: false, error: 'errors.ERR_FORBIDDEN' };
  if (!isUuid(orderId)) return { ok: false, error: 'errors.ERR_NOT_FOUND' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('acknowledge_order_change', { p_order_id: orderId });
  if (error || !data) return fail(error);
  refresh();
  return { ok: true, orderId: data.id, revision: data.revision };
}
