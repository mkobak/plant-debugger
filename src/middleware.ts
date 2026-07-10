import { NextRequest, NextResponse } from 'next/server';

/**
 * Per-request nonce-based CSP. Next.js reads the Content-Security-Policy
 * header from the *request* and applies the nonce to its own inline
 * bootstrap scripts, which lets us drop 'unsafe-inline' from script-src.
 * Dev builds still need 'unsafe-eval' for HMR/react-refresh.
 */
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV === 'development';

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
    "img-src 'self' blob: data:",
    "font-src 'self' fonts.gstatic.com",
    "connect-src 'self' https://*.googleapis.com https://generativelanguage.googleapis.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    // Pages only: API routes, static assets, and images don't need CSP nonces
    {
      source:
        '/((?!api|_next/static|_next/image|favicon.ico|images|sample-images|ascii).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
