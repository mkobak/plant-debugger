import { Metadata } from 'next';
import { DiagnosisProvider } from '@/context/DiagnosisContext';
import { Source_Code_Pro } from 'next/font/google';
import '@/styles/base.css';
import '@/styles/terminal.css';
import '@/styles/components.css';
import '@/styles/modal.css';
import '@/styles/upload.css';
import '@/styles/pages.css';
import '@/styles/responsive.css';

export const metadata: Metadata = {
  title: 'Plant Debugger',
  description: 'Debug your plants',
  keywords: ['plant', 'diagnosis', 'health'],
};

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
        <DiagnosisProvider>
          <div id="root">{children}</div>
        </DiagnosisProvider>
      </body>
    </html>
  );
}
