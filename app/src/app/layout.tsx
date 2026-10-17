import type { Metadata, Viewport } from 'next';
import './globals.css';

// Neutral title and no description: the lock screen must not reveal what the site is.
// CoachApp sets the full title once the PIN has been accepted.
export const metadata: Metadata = {
  title: 'Giriş',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f4f5' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0b' },
  ],
};

// Runs before first paint so the page never flashes the wrong theme:
// stored choice (lumos.theme) first, then the system setting, otherwise dark.
const THEME_SCRIPT = `try{var t=localStorage.getItem('lumos.theme');if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='dark'}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
