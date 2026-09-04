import { Metadata, Viewport } from 'next';
import { DiagnosisProvider } from '@/context/DiagnosisContext';
import { Source_Code_Pro } from 'next/font/google';
import '@/styles/base.css';
import '@/styles/terminal.css';
import '@/styles/components.css';
import '@/styles/modal.css';
import '@/styles/upload.css';
import '@/styles/pages.css';
import '@/styles/responsive.css';
import { ViewportHeightProvider } from '@/components/layout/ViewportHeightProvider';

export const metadata: Metadata = {
  title: 'Plant Debugger',
  description:
    'Is your plant experiencing compilation issues? Upload photos and get an AI-powered diagnosis with treatment and care tips.',
  keywords: ['plant', 'diagnosis', 'health'],
  openGraph: {
    title: 'Plant Debugger',
    description:
      'Upload photos of your plant and get an AI-powered diagnosis with treatment and care tips.',
    type: 'website',
    siteName: 'Plant Debugger',
  },
  twitter: {
    card: 'summary',
    title: 'Plant Debugger',
    description:
      'Upload photos of your plant and get an AI-powered diagnosis with treatment and care tips.',
  },
};

export const viewport: Viewport = {
  themeColor: '#0d0d0d',
};

// Nonce-based CSP (src/middleware.ts) requires per-request rendering:
// statically prerendered HTML would ship without the nonce and
// 'strict-dynamic' would block every script.
export const dynamic = 'force-dynamic';

const sourceCodePro = Source_Code_Pro({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-family',
  display: 'swap',
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={sourceCodePro.variable}>
      <body className={sourceCodePro.className}>
        <ViewportHeightProvider />
        <DiagnosisProvider>
          <div id="root">{children}</div>
        </DiagnosisProvider>
      </body>
    </html>
  );
}
