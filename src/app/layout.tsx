import { Metadata } from 'next';
import { DiagnosisProvider } from '@/context/DiagnosisContext';
import '@/styles/base.css';
import '@/styles/terminal.css';
import '@/styles/components.css';
import '@/styles/modal.css';
import '@/styles/upload.css';
import '@/styles/pages.css';
import '@/styles/responsive.css';

export const metadata: Metadata = {
  title: 'Plant Debugger',
  description: 'AI-powered plant health diagnostic tool',
  keywords: ['plant', 'diagnosis', 'AI', 'health', 'gardening'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <DiagnosisProvider>
          <div id="root">{children}</div>
        </DiagnosisProvider>
      </body>
    </html>
  );
}
