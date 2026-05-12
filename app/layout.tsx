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
        {/* Updated to use the Geist fonts you defined instead of Inter */}
        <body
          className={`${geistSans.variable} ${geistMono.variable} font-sans`}
        >
          {/* If you want the Navbar on every page, you would place <Navbar /> here */}

          {children}

          {/* The Cookie Banner sits at the bottom of the body */}
          <CookieBanner />
        </body>
      </PHProvider>
    </html>
  );
}
