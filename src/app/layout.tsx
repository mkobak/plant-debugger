import { Metadata } from 'next';
import { DiagnosisProvider } from '@/context/DiagnosisContext';
import '@/styles/global.css';

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
