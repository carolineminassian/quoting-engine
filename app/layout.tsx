import type { Metadata } from 'next';
import { Roboto } from 'next/font/google';
import { headers } from 'next/headers';
import './globals.css';
import Navbar from '../components/Navbar';
import { PHProvider } from './providers';
import CookieBanner from '@/components/CookieBanner';
import Footer from '@/components/Footer';
import ChunkErrorHandler from '@/components/ChunkErrorHandler';

const roboto = Roboto({
  weight: ['300', '400', '500', '700', '900'],
  subsets: ['latin'],
  display: 'swap'
});

async function detectFrench(): Promise<boolean> {
  try {
    const headersList = await headers();

    // Primary: use Vercel geo-based header set by middleware (most accurate)
    const geoIsFr = headersList.get('x-user-is-fr');
    if (geoIsFr !== null) {
      return geoIsFr === 'true';
    }

    // Fallback: use Accept-Language if middleware header not available
    // (e.g. local dev environment)
    const acceptLanguage = headersList.get('accept-language') || '';
    return (
      acceptLanguage.toLowerCase().startsWith('fr') ||
      acceptLanguage.toLowerCase().includes('fr-fr') ||
      acceptLanguage.toLowerCase().includes('fr-be') ||
      acceptLanguage.toLowerCase().includes('fr-ch') ||
      acceptLanguage.toLowerCase().includes('fr-ca')
    );
  } catch {
    return false;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const isFr = await detectFrench();

  return {
    title: isFr
      ? 'PactEstim | Logiciel de Devis Professionnel'
      : 'PactEstim | Professional Estimate Software',
    openGraph: {
      title: isFr
        ? 'PactEstim | Logiciel de Devis & Facturation'
        : 'PactEstim | Estimates & Invoicing for Contractors',
      description: isFr
        ? 'Devis professionnels, approbation client en ligne, facturation automatique. Bilingue FR/EN.'
        : 'Professional estimates, online client approval, automatic invoicing. Bilingual FR/EN.',
      siteName: 'PactEstim',
      locale: isFr ? 'fr_FR' : 'en_US',
      type: 'website',
      url: 'https://pactestim.com',
      images: [
        {
          url: 'https://pactestim.com/og-image.png',
          width: 1200,
          height: 630,
          alt: isFr
            ? 'PactEstim — Logiciel de Devis et Facturation'
            : 'PactEstim — Estimates & Invoicing Software'
        }
      ]
    },
    twitter: {
      card: 'summary_large_image',
      title: isFr
        ? 'PactEstim | Logiciel de Devis & Facturation'
        : 'PactEstim | Estimates & Invoicing for Contractors',
      description: isFr
        ? 'Devis professionnels, approbation client en ligne, facturation automatique.'
        : 'Professional estimates, online client approval, automatic invoicing.',
      images: ['https://pactestim.com/og-image.png']
    },
    keywords: isFr
      ? 'devis professionnel, devis gratuit, logiciel devis, devis artisan, devis entrepreneur, créer devis, création devis gratuit, facturation automatique, approbation client en ligne, logiciel pour artisans, logiciel pour entrepreneurs, logiciel de facturation'
      : 'estimate software, free quoting software, free estimate generator, professional estimates, contractor quotes, business estimates, quote builder, automatic invoicing, online client approval, artisan software, freelancer software, small business software, entrepreneur software, billing software',

    alternates: {
      languages: {
        'en-US': 'https://pactestim.com',
        'fr-FR': 'https://pactestim.com'
      }
    },
    icons: {
      icon: isFr ? '/favicon-fr.svg?v=2' : '/favicon-us.svg?v=2',
      shortcut: isFr ? '/favicon-fr.svg?v=2' : '/favicon-us.svg?v=2',
      apple: '/apple-touch-icon.png?v=2'
    }
  };
}

export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const isFr = await detectFrench();

  return (
    <html lang={isFr ? 'fr' : 'en'} suppressHydrationWarning>
      <head>
        <link
          rel="icon"
          type="image/svg+xml"
          href={isFr ? '/favicon-fr.svg?v=2' : '/favicon-us.svg?v=2'}
        />
        <link
          rel="shortcut icon"
          type="image/svg+xml"
          href={isFr ? '/favicon-fr.svg?v=2' : '/favicon-us.svg?v=2'}
        />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2" />
        <link rel="alternate" hrefLang="en" href="https://pactestim.com" />
        <link rel="alternate" hrefLang="fr" href="https://pactestim.com" />
        <link
          rel="alternate"
          hrefLang="x-default"
          href="https://pactestim.com"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // Detect active authenticated session markers
                  let hasAuthSession = false;
                  try {
                    // Check cookies (common for SSR/auth)
                    if (document.cookie.includes('sb-') || document.cookie.includes('supabase-')) {
                      hasAuthSession = true;
                    }
                    // Check localStorage keys (common for client-side supabase-js SDK)
                    for (let i = 0; i < localStorage.length; i++) {
                      const key = localStorage.key(i);
                      if (key && (key.startsWith('sb-') || key.includes('supabase.auth.token'))) {
                        hasAuthSession = true;
                        break;
                      }
                    }
                  } catch (e) {}

                  // If they are not logged in, they are a guest client — force Light Mode
                  if (!hasAuthSession) {
                    document.documentElement.classList.remove('dark');
                    return;
                  }

                  const stored = localStorage.getItem('pactestim_theme');
                  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (stored === 'dark' || (!stored && systemDark)) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `
          }}
        />
      </head>
      <PHProvider>
        <body
          className={`${roboto.className} font-sans flex flex-col min-h-screen bg-white dark:bg-gray-950 text-black dark:text-gray-100 transition-colors duration-200`}
        >
          <ChunkErrorHandler />
          <Navbar />
          <div className="flex-1 flex flex-col">{children}</div>
          <Footer />
          <CookieBanner />
        </body>
      </PHProvider>
    </html>
  );
}
