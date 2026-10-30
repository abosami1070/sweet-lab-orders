// صيغ موحدة: أرقام لاتينية في العربية، وتوقيت الرياض دائماً
export const TIME_ZONE = 'Asia/Riyadh';

export const intlLocale = (locale: string) => (locale === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB');

export const formatNumber = (locale: string, value: number) =>
  new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 2 }).format(value);

export const formatDate = (
  locale: string,
  value: Date | string,
  opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }
) => new Intl.DateTimeFormat(intlLocale(locale), { timeZone: TIME_ZONE, ...opts }).format(new Date(value));
