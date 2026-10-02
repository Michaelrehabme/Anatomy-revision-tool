import { lazy, Suspense, type CSSProperties } from 'react';
import type { UseEntitlement } from '../../anatomy-revision/hooks/useEntitlement';

/**
 * The Account screen's "Offline" section, heading included — shared by Account
 * and MobileAccount, which are two separate render trees.
 *
 * NOTHING AT ALL IN THE PUBLIC DEMO. That build has no service worker
 * (vite.config.demo.ts), so a download would fill storage with pictures
 * nothing ever serves, and the demo is an educator's dashboard that nobody
 * revises from. The heading goes too: a section that says only "not
 * available" on a sales asset reads as something broken.
 *
 * LAZY, because the entry chunk is within a few percent of the 2 MiB a
 * service worker will precache, and this is a screen most sessions never
 * open. The downloader, the controller and the list arrive together the first
 * time the Account screen is shown.
 */

const PUBLIC_DEMO = import.meta.env.VITE_PUBLIC_DEMO === '1';

const OfflineSection = PUBLIC_DEMO ? null : lazy(() => import('./OfflineSection'));

interface OfflineDownloadsProps {
  access: UseEntitlement;
  compact?: boolean;
  /** The host screen's own section-heading style, so this reads as one of its sections. */
  headingStyle: CSSProperties;
  className?: string;
}

export function OfflineDownloads({ access, compact = false, headingStyle, className = '' }: OfflineDownloadsProps) {
  if (!OfflineSection) return null;

  return (
    <section className={className} style={compact ? undefined : { maxWidth: 620 }}>
      <h3 style={headingStyle}>Offline</h3>
      <Suspense fallback={null}>
        <OfflineSection access={access} compact={compact} />
      </Suspense>
    </section>
  );
}
