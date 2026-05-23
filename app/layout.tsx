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
    description: isFr
      ? 'Créez, gérez et envoyez des devis professionnels en quelques minutes. Solution simple et efficace pour les artisans et entreprises.'
      : 'Precision estimates for contractors and businesses. Create, manage, and send detailed project quotes with ease.',
    keywords: isFr
      ? 'devis professionnel, logiciel devis, devis artisan, devis entrepreneur, créer devis'
      : 'estimate software, professional estimates, contractor quotes, business estimates, quote builder',
    openGraph: {
      title: isFr
        ? 'PactEstim | Logiciel de Devis Professionnel'
        : 'PactEstim | Professional Estimate Software',
      description: isFr
        ? 'Créez des devis professionnels en quelques minutes.'
        : 'Create professional estimates in minutes.',
      siteName: 'PactEstim',
      locale: isFr ? 'fr_FR' : 'en_US',
      type: 'website'
    },
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
    <html lang={isFr ? 'fr' : 'en'}>
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
      </head>
      <PHProvider>
        <body
          className={`${roboto.className} font-sans flex flex-col min-h-screen`}
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
