import { NextResponse, type NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { routing } from './i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);
const PUBLIC_PATHS = ['/login'];

export async function middleware(request: NextRequest) {
  // 1) اللغة: يضيف /ar أو /en ويحترم الكوكي NEXT_LOCALE
  const response = intlMiddleware(request);
  if (response.headers.get('location')) return response;

  // 2) تحديث جلسة Supabase في الكوكيز
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    }
  );
  const {
    data: { user }
  } = await supabase.auth.getUser();

  // 3) حماية المسارات (التحقق من الدور يتم في الخادم داخل كل layout)
  const [, first, ...rest] = request.nextUrl.pathname.split('/');
  const locale = (routing.locales as readonly string[]).includes(first) ? first : routing.defaultLocale;
  const path = '/' + rest.join('/');
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  const redirectTo = (pathname: string, params?: Record<string, string>) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = '';
    Object.entries(params ?? {}).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  if (!user && !isPublic) {
    return redirectTo(`/${locale}/login`, path !== '/' ? { next: path } : undefined);
  }
  if (user && isPublic && !request.nextUrl.searchParams.has('error')) {
    return redirectTo(`/${locale}`);
  }
  return response;
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
