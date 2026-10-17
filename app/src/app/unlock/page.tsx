import type { Metadata } from 'next';
import UnlockScreen from '@/components/UnlockScreen';

export const metadata: Metadata = { title: 'Unlock | Lumos AI English Coach' };

export default async function Unlock({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  // Only same-site paths are allowed as a redirect target.
  const target = next?.startsWith('/') && !next.startsWith('//') ? next : '/';
  return <UnlockScreen next={target} />;
}
