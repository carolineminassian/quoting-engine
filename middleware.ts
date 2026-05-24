import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { geolocation } from '@vercel/functions';

export function middleware(request: NextRequest) {
  // Use @vercel/functions geolocation (request.geo was removed in Next.js 15)
  const { country: geoCountry } = geolocation(request);
  const country = geoCountry || 'US';
  const isFr = country === 'FR' || country === 'BE' || country === 'CH';

  // Add custom headers that layout.tsx reads to serve correct metadata
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
  matcher: ['/((?!_next/static|_next/image|favicon|api).*)']
};
