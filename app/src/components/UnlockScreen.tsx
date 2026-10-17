'use client';

import Gatekeeper from './Gatekeeper';

/** /unlock: after a correct PIN, a full navigation so the proxy sees the new lumos_auth cookie. */
export default function UnlockScreen({ next }: { next: string }) {
  return <Gatekeeper onUnlock={() => window.location.assign(next)} />;
}
