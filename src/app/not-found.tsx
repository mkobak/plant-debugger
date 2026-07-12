import Link from 'next/link';
import TerminalLayout from '@/components/layout/TerminalLayout';
import SharedHeader from '@/components/layout/SharedHeader';

export default function NotFound() {
  return (
    <TerminalLayout title="Plant Debugger">
      <SharedHeader showNavigation={false} />
      <div className="terminal-text">
        <p>404: route not found.</p>
        <p>This path failed to compile. Try rebuilding from the start.</p>
        <p>
          <Link href="/" className="text-action">
            cd ~/home
          </Link>
        </p>
      </div>
    </TerminalLayout>
  );
}
