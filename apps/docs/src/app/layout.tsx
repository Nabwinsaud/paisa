import { RootProvider } from 'fumadocs-ui/provider/next';
import './global.css';
import { Inter } from 'next/font/google';
import type { Metadata } from 'next';

const inter = Inter({
  subsets: ['latin'],
});

const baseUrl = new URL(
  process.env.NEXT_PUBLIC_BASE_URL ?? 'https://paisa.nabwin.com',
);

export const metadata: Metadata = {
  metadataBase: baseUrl,
  title: {
    default: '@nabwin/paisa — Nepali Payment Gateway SDK',
    template: '%s | @nabwin/paisa',
  },
  description:
    'A TypeScript SDK for integrating Nepali payment gateways like eSewa and Khalti into your applications.',
  openGraph: {
    title: '@nabwin/paisa — Nepali Payment Gateway SDK',
    description:
      'A TypeScript SDK for integrating Nepali payment gateways like eSewa and Khalti into your applications.',
    url: baseUrl.toString(),
    siteName: '@nabwin/paisa',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '@nabwin/paisa — Nepali Payment Gateway SDK',
    description:
      'A TypeScript SDK for integrating Nepali payment gateways like eSewa and Khalti into your applications.',
  },
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
