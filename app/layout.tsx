import type { Metadata } from 'next';
import { Roboto } from 'next/font/google';
import './globals.css';
import Navbar from '../components/Navbar';
import { PHProvider } from './providers';
import CookieBanner from '@/components/CookieBanner';
import Footer from '@/components/Footer';

const roboto = Roboto({
  weight: ['300', '400', '500', '700', '900'],
  subsets: ['latin'],
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'PactEstim | Professional Estimate Software',
  description:
    'Precision estimates for contractors and businesses. Create, manage, and send detailed project quotes with ease.',
  icons: {
    icon: '/favicon-us.svg?v=2',
    shortcut: '/favicon-us.svg?v=2',
    apple: '/apple-touch-icon.png?v=2'
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon-us.svg?v=2" />
        <link
          rel="shortcut icon"
          type="image/svg+xml"
          href="/favicon-us.svg?v=2"
        />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2" />
      </head>
      <PHProvider>
        <body
          className={`${roboto.className} font-sans flex flex-col min-h-screen`}
        >
          <Navbar />
          <div className="flex-1 flex flex-col">{children}</div>
          <Footer />
          <CookieBanner />
        </body>
      </PHProvider>
    </html>
  );
}
