import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import GlobalBhsFormatter from './components/GlobalBhsFormatter';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Pilana ERP — Sistem za Upravljanje Proizvodnjom',
  description: 'Napredni ERP sistem za pilanu, proizvodnju, lager, komercijalu i HR.',
  manifest: '/manifest.json',
  themeColor: '#2563eb',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Pilana ERP',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="bs" suppressHydrationWarning>
      <body className={inter.className}>
        <GlobalBhsFormatter />
        {children}
      </body>
    </html>
  );
}
