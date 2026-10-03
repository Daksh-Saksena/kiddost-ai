import type { Viewport } from 'next';
import './globals.css';
import './mobile-styles.css';

export const metadata = {
  title: "Kiddost Support",
  description: "Agent messaging dashboard",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#008069',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>

      <body>{children}</body>
    </html>
  );
}