import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Vercel provides geo data on their edge network
  const country = request.geo?.country || 'US';
  const isFr = country === 'FR' || country === 'BE' || country === 'CH';

  // Clone the request headers and add a custom header
  // that our layout.tsx can read to serve correct metadata
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-country', country);
  requestHeaders.set('x-user-is-fr', isFr ? 'true' : 'false');

  return NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
}

export const config = {
  // Run on all routes except static files and API routes
  matcher: ['/((?!_next/static|_next/image|favicon|api).*)']
};
