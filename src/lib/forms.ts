// أدوات مشتركة لنماذج الإدارة: قراءة الحقول، التحقق، وترجمة أخطاء القاعدة إلى مفاتيح رسائل
// كل رسالة خطأ هي مفتاح ترجمة كامل (مثل forms.errors.required) تعرضه الواجهة باللغة الحالية

export type FieldErrors = Record<string, string>;

export type FormState = {
  status: 'idle' | 'ok' | 'error';
  error?: string;
  fields?: FieldErrors;
  // يتغير مع كل رد حتى تتعرف الواجهة على نجاح جديد (لإعادة ضبط النموذج مثلاً)
  at?: number;
  // بيانات تُعرض مرة واحدة بعد النجاح (كلمة مرور مؤقتة مثلاً)
  data?: Record<string, string>;
};

export const idle: FormState = { status: 'idle' };
export const ok = (data?: Record<string, string>): FormState => ({ status: 'ok', at: Date.now(), data });
export const fail = (error: string, fields?: FieldErrors): FormState => ({ status: 'error', error, fields, at: Date.now() });
export const invalid = (fields: FieldErrors): FormState => fail('forms.errors.checkFields', fields);

export const str = (fd: FormData, key: string) => String(fd.get(key) ?? '').trim();
export const optStr = (fd: FormData, key: string) => str(fd, key) || null;
export const bool = (fd: FormData, key: string) => fd.get(key) === 'on' || fd.get(key) === 'true';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string) => UUID_RE.test(v);

// يقبل الأرقام العربية-الهندية أيضاً لأن لوحة المفاتيح العربية قد تكتبها
export function toLatinDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٫]/g, '.');
}

export function num(fd: FormData, key: string): number | null {
  const raw = toLatinDigits(str(fd, key)).replace(/,/g, '');
  if (raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

// الجوال السعودي: يقبل 05XXXXXXXX أو 5XXXXXXXX أو +9665XXXXXXXX ويخزن 9665XXXXXXXX
export function normalizeSaudiPhone(input: string): string | null | 'invalid' {
  const digits = toLatinDigits(input).replace(/[\s\-()+]/g, '');
  if (!digits) return null;
  let local = digits;
  if (local.startsWith('00966')) local = local.slice(5);
  else if (local.startsWith('966')) local = local.slice(3);
  if (local.startsWith('0')) local = local.slice(1);
  return /^5[0-9]{8}$/.test(local) ? `966${local}` : 'invalid';
}

// عرض الرقم المخزن بصيغة محلية مألوفة 05XXXXXXXX
export const displayPhone = (stored: string | null) => (stored ? `0${stored.slice(3)}` : '');

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const TIME_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// نص بطول محدد؛ يرجع مفتاح الخطأ أو null
export function checkText(value: string, { min = 0, max }: { min?: number; max: number }) {
  if (min > 0 && !value) return 'forms.errors.required';
  if (value.length < min) return 'forms.errors.tooShort';
  if (value.length > max) return 'forms.errors.tooLong';
  return null;
}

type DbError = { code?: string; message?: string; details?: string | null } | null | undefined;

// يحول خطأ Supabase/PostgREST إلى مفتاح رسالة مفهوم للمستخدم
export function dbErrorKey(error: DbError, uniqueKeys: Record<string, string> = {}): string {
  if (!error) return 'errors.unknown';
  const message = error.message ?? '';
  const code = message.match(/ERR_[A-Z_]+/)?.[0];
  // كل رموز ERR_* في القاعدة مترجمة (يتحقق منها scripts/check-i18n.mjs)
  if (code) return `errors.${code}`;

  switch (error.code) {
    case '23505': {
      const hit = Object.entries(uniqueKeys).find(([constraint]) => message.includes(constraint));
      return hit ? hit[1] : 'forms.errors.duplicate';
    }
    case '23503':
      return 'forms.errors.inUse';
    case '23514':
    case '22P02':
    case '22007':
    case '22008':
      return 'forms.errors.invalidValue';
    case '42501':
      return 'errors.ERR_FORBIDDEN';
    case 'PGRST116': // لم يرجع صف: إما غير موجود أو RLS منعت التعديل
      return 'errors.ERR_NOT_FOUND';
    default:
      return 'errors.unknown';
  }
}
