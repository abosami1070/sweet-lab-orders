// شعار بسيط: قبة كب كيك فوق صحن — يعمل في الوضعين الفاتح والداكن
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <rect width="48" height="48" rx="12" fill="var(--color-primary)" />
      <path d="M12 26c0-7 5.4-12 12-12s12 5 12 12z" fill="var(--color-on-primary)" />
      <circle cx="24" cy="12" r="2.6" fill="var(--color-on-primary)" />
      <path d="M14 29h20l-2.4 8.2a2 2 0 0 1-1.9 1.4H18.3a2 2 0 0 1-1.9-1.4z" fill="var(--color-on-primary)" opacity=".55" />
    </svg>
  );
}
