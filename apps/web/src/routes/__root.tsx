import { Toaster } from '@repo/ui/components/sonner';
import { Outlet, createRootRoute } from '@tanstack/react-router';
import React from 'react';
import { authClient } from '@/clients/authClient';
import { Sidebar } from '@/components/layout/Sidebar';
import Spinner from '@/routes/-components/common/spinner';

export const Route = createRootRoute({
  component: RootComponent,
});

// https://tanstack.com/router/v1/docs/framework/react/devtools
const TanStackRouterDevtools = import.meta.env.PROD
  ? () => null
  : React.lazy(() =>
      import('@tanstack/router-devtools').then((res) => ({
        default: res.TanStackRouterDevtools,
      })),
    );

function RootComponent() {
  const { data: session, isPending: isSessionPending } = authClient.useSession();

  if (isSessionPending) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-900 text-white">
      <Toaster />
      {session?.user && <Sidebar session={session} />}
      <main className="flex-1 overflow-y-auto p-6 md:p-10">
        <Outlet />
      </main>
      <React.Suspense>
        <TanStackRouterDevtools position="bottom-right" />
      </React.Suspense>
    </div>
  );
}