import { NextRequest, NextResponse } from 'next/server';

/**
 * Per-request nonce-based CSP. Next.js reads the Content-Security-Policy
 * header from the *request* and applies the nonce to its own inline
 * bootstrap scripts, which lets us drop 'unsafe-inline' from script-src.
 *
 * Development is exempt entirely: next dev injects react-refresh/HMR inline
 * scripts without the nonce, and 'strict-dynamic' then blocks hydration.
 */
export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.next();
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  // No third-party origins: fonts are self-hosted by next/font and the
  // browser only ever talks to this app's own API routes.
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
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
