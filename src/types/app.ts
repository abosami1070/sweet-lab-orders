export const APP_ROLES = ['super_admin', 'admin', 'kitchen_staff', 'customer'] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const ORDER_STATUSES = [
  'pending_approval',
  'needs_review',
  'awaiting_kitchen',
  'acknowledged',
  'in_production',
  'ready',
  'delivered',
  'rejected',
  'cancelled'
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type Profile = {
  id: string;
  full_name: string;
  role: AppRole;
  customer_id: string | null;
  preferred_locale: 'ar' | 'en';
  is_active: boolean;
  customer: { name_ar: string; name_en: string } | null;
};

export const PRODUCT_UNITS = ['piece', 'box', 'tray', 'kg', 'cake'] as const;
export type ProductUnit = (typeof PRODUCT_UNITS)[number];
