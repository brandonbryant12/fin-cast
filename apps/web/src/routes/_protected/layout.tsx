import { Navigate, Outlet, createFileRoute } from '@tanstack/react-router';
import { authClient } from '@/clients/authClient';
import { AudioProvider } from '@/contexts/audio-player-context';
import Spinner from '@/routes/-components/common/spinner';

import { AudioPlayer } from '@/routes/_protected/podcasts/-components/audio-player';

export const Route = createFileRoute('/_protected')({
  component: Layout,
});

function Layout() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <Spinner />;
  }

  if (!session?.user) {
    return <Navigate to="/" />;
  }

  return (
    <>
      <Outlet />
      {/* AudioPlayer UI remains, it will get context from __root.tsx */}
      {session?.user && <AudioPlayer />}
    </>
  );
}