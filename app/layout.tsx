import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Navbar from '../components/Navbar';
import { PHProvider } from './providers';
import CookieBanner from '@/components/CookieBanner';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin']
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin']
});

export const metadata: Metadata = {
  title: 'Professional Quoting Engine for Contractors and Businesses',
  description:
    'Precision estimates for contractors and businesses. Create, manage, and send detailed project quotes with ease. Streamline your workflow and impress clients with professional estimates.'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <PHProvider>
        <body
          className={`${geistSans.variable} ${geistMono.variable} font-sans`}
        >
          <Navbar />

          {children}

          <CookieBanner />
        </body>
      </PHProvider>
    </html>
  );
}
