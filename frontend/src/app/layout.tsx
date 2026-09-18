import type { Metadata } from 'next';
import { Inter, Outfit } from 'next/font/google';
import GovShell from '@/components/GovShell';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'NyayaSetu | न्यायसेतु — National Legal Aid Portal',
  description:
    'NyayaSetu is an AI-assisted legal aid intake portal by the Ministry of Law & Justice, Government of India. Find which statutory schemes you qualify for — with clause-level citations.',
  keywords: ['legal aid', 'nyaya setu', 'legal services', 'India', 'government'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body className="min-h-screen">
        <GovShell>{children}</GovShell>
      </body>
    </html>
  );
}
