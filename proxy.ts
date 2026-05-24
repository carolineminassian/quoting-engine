import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { geolocation } from '@vercel/functions';

export function proxy(request: NextRequest) {
  const { country: geoCountry } = geolocation(request);
  const country = geoCountry || 'US';
  const isFr = country === 'FR' || country === 'BE' || country === 'CH';

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
