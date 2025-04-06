import { Toaster } from '@repo/ui/components/sonner';
import { Outlet, createRootRoute } from '@tanstack/react-router';
import React from 'react';
import { authClient } from '@/clients/authClient';
import { Sidebar } from '@/components/layout/Sidebar';
import Spinner from '@/routes/-components/common/spinner';
import NavContainer from '@/routes/-components/layout/nav/nav-container';
import { Navbar } from '@/routes/-components/layout/nav/navbar';

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
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <NavContainer>
        <Spinner />
      </NavContainer>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-slate-900 text-white">
      <Navbar session={session} />
      <Toaster />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6 md:p-10">
          <Outlet />
        </main>
      </div>
      <React.Suspense>
        <TanStackRouterDevtools position="bottom-right" />
      </React.Suspense>
    </div>
  );
}