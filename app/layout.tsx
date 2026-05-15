import type { Metadata } from 'next';
import { Roboto } from 'next/font/google'; // Changed from Geist
import './globals.css';
import Navbar from '../components/Navbar';
import { PHProvider } from './providers';
import CookieBanner from '@/components/CookieBanner';
import Footer from '@/components/Footer';

// Configure Roboto font
const roboto = Roboto({
  weight: ['300', '400', '500', '700', '900'],
  subsets: ['latin'],
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'Professional Quoting Engine for Contractors and Businesses',
  description:
    'Precision estimates for contractors and businesses. Create, manage, and send detailed project quotes with ease.'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <PHProvider>
        {/* Added roboto.className here */}
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
