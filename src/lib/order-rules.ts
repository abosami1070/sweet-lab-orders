import type { OrderStatus } from '@/types/app';

// قواعد عرض مشتركة بين الخادم والمتصفح (بدون أي وصول للبيانات)

// الإجراءات المتاحة في الواجهة لكل دور وحالة. القاعدة تفرض نفس المصفوفة (app.allowed_transition)،
// فهذه القائمة لإظهار الأزرار المناسبة فقط وليست خط الحماية.
export type StaffAction = 'approve' | 'needsReview' | 'reject' | 'cancel' | 'acknowledge' | 'start' | 'ready' | 'deliver';

export const ACTION_TARGET: Record<StaffAction, OrderStatus> = {
  approve: 'awaiting_kitchen',
  needsReview: 'needs_review',
  reject: 'rejected',
  cancel: 'cancelled',
  acknowledge: 'acknowledged',
  start: 'in_production',
  ready: 'ready',
  deliver: 'delivered'
};

export function adminActions(status: OrderStatus): StaffAction[] {
  switch (status) {
    case 'pending_approval':
      return ['approve', 'needsReview', 'reject', 'cancel'];
    case 'needs_review':
      return ['reject', 'cancel'];
    case 'awaiting_kitchen':
      return ['needsReview', 'cancel'];
    case 'acknowledged':
    case 'in_production':
      return ['cancel'];
    case 'ready':
      return ['deliver'];
    default:
      return [];
  }
}

export function kitchenNextAction(status: OrderStatus): StaffAction | null {
  switch (status) {
    case 'awaiting_kitchen':
      return 'acknowledge';
    case 'acknowledged':
      return 'start';
    case 'in_production':
      return 'ready';
    case 'ready':
      return 'deliver';
    default:
      return null;
  }
}

// السبب إلزامي في القاعدة لهذه الانتقالات (app.transition_requires_reason)
export const needsReason = (to: OrderStatus, from: OrderStatus) =>
  to === 'rejected' || to === 'needs_review' || (to === 'cancelled' && from !== 'pending_approval' && from !== 'needs_review');

export const EDITABLE_BY_CUSTOMER: OrderStatus[] = ['pending_approval', 'needs_review'];
export const EDITABLE_BY_ADMIN: OrderStatus[] = ['pending_approval', 'needs_review', 'awaiting_kitchen', 'acknowledged', 'in_production'];
export const OPEN_STATUSES: OrderStatus[] = ['pending_approval', 'needs_review', 'awaiting_kitchen', 'acknowledged', 'in_production', 'ready'];
