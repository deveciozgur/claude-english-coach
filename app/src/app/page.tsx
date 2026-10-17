import CoachApp from '@/components/CoachApp';

// The coaching studio. The proxy has already checked the lumos_auth cookie; all data comes
// from the /api/state routes, so no file access happens in this tree.
export const dynamic = 'force-dynamic';

export default function Home() {
  return <CoachApp />;
}
