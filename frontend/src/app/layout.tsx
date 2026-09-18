import type { Metadata } from 'next';
import { Inter, Outfit } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'NyayaSetu — Legal Aid Triage',
  description:
    'Evidence-backed legal aid intake and triage platform. Find which statutory schemes you qualify for — with clause-level citations, not chatbot guesses.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body className="min-h-screen">
        {/* -------- Header / Nav -------- */}
        <header className="sticky top-0 z-50 border-b border-surface-200/60 bg-white/80 backdrop-blur-lg">
          <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
            <Link href="/upload" className="flex items-center gap-2.5 group">
              {/* Logo mark */}
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white font-heading font-bold text-base shadow-glow transition-transform duration-200 group-hover:scale-105">
                न्या
              </span>
              <span className="font-heading text-lg font-bold tracking-tight text-surface-900">
                NyayaSetu
              </span>
            </Link>

            <nav className="flex items-center gap-1">
              <Link
                href="/upload"
                className="rounded-lg px-3 py-2 text-sm font-medium text-surface-600 transition-colors hover:bg-surface-100 hover:text-surface-900"
              >
                New Request
              </Link>
            </nav>
          </div>
        </header>

        {/* -------- Main content -------- */}
        <main className="mx-auto max-w-5xl px-4 py-8 animate-fade-in">
          {children}
        </main>

        {/* -------- Footer -------- */}
        <footer className="border-t border-surface-200 bg-white/50 backdrop-blur-sm">
          <div className="mx-auto max-w-5xl px-4 py-6">
            <p className="text-xs text-surface-500 text-center">
              NyayaSetu helps you find which legal aid schemes you may qualify for.
              It does not give legal advice and is not a substitute for a lawyer.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
