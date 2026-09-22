import type { Metadata } from 'next';
import { Fira_Sans_Condensed, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import '@bestech/tokens/tokens.css';
import '@bestech/ui-kit/ui.css';
import './globals.css';

const heading = Fira_Sans_Condensed({
  subsets: ['cyrillic-ext', 'cyrillic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-heading',
  display: 'swap',
});

const body = IBM_Plex_Sans({
  subsets: ['cyrillic-ext', 'cyrillic', 'latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['cyrillic-ext', 'cyrillic', 'latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'BESTECH — кабинет и цифровой двойник',
  description: 'Информационная модель объекта на всех стадиях: проектирование, строительство, эксплуатация.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" data-theme="paper" data-density="comfortable" className={`${heading.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
