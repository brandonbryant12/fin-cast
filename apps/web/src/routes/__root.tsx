import { Button } from '@repo/ui/components/button';
import { Sheet, SheetContent, SheetTrigger } from '@repo/ui/components/sheet';
import { Toaster } from '@repo/ui/components/sonner';
import { cn } from '@repo/ui/lib/utils';
import { Outlet, createRootRoute } from '@tanstack/react-router';
import { Menu } from 'lucide-react';
import React, { useState } from 'react';
import { authClient } from '@/clients/authClient';
import { AudioProvider } from '@/contexts/audio-player-context';
import { VoicesProvider } from '@/contexts/voices-context';
import Spinner from '@/routes/-components/common/spinner';
import { Sidebar } from '@/routes/-components/layout/nav/side-bar';

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (isSessionPending) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <Spinner />
      </div>
    );
  }

  return (
    <AudioProvider>
      <VoicesProvider>
        <div className="flex h-screen bg-slate-900 text-white">
          <Toaster />
          {/* Sidebar for large screens */}
          {session?.user && (
            <div className="hidden lg:block">
              <Sidebar session={session} />
            </div>
          )}
          {/* Main content area */}
          <main className="flex-1 overflow-y-auto p-6 md:p-10 relative">
            {/* Mobile Menu Trigger */}
            {session?.user && (
              <div className="lg:hidden absolute top-4 left-4 z-20">
                <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Open menu">
                      <Menu className="h-6 w-6" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="p-0 w-64 border-r border-sidebar-border bg-sidebar">
                    {/* Pass a function to close the menu on link click */}
                    <Sidebar session={session} onLinkClick={() => setIsMobileMenuOpen(false)} />
                  </SheetContent>
                </Sheet>
              </div>
            )}
            {/* Offset content for the mobile menu trigger */}
            <div className={cn("pt-12 lg:pt-0")}>
               <Outlet />
            </div>
          </main>
          <React.Suspense>
            <TanStackRouterDevtools position="bottom-right" />
          </React.Suspense>
        </div>
      </VoicesProvider>
    </AudioProvider>
  );
}