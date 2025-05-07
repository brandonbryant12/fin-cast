import { Button } from '@repo/ui/components/button';
import { Sheet, SheetContent, SheetTrigger } from '@repo/ui/components/sheet';
import { Toaster } from '@repo/ui/components/sonner';
import { cn } from '@repo/ui/lib/utils';
import { Outlet, createRootRoute } from '@tanstack/react-router';
import { Menu, AlertTriangle } from 'lucide-react'; // Added AlertTriangle
import React, { useState } from 'react';
import { authClient } from '@/clients/authClient';
import { AudioProvider } from '@/contexts/audio-player-context';
import { VoicesProvider } from '@/contexts/voices-context';
import Spinner from '@/routes/-components/common/spinner';
import { Sidebar } from '@/routes/-components/layout/nav/side-bar';

export const Route = createRootRoute({
  component: RootComponent,
});

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
      <div className="flex h-screen items-center justify-center bg-background">
        <Spinner />
      </div>
    );
  }

  const pocWarningMessage = "This is a Proof of Concept (POC) application and is under active development. Please do not enter any Personally Identifiable Information (PII) or confidential data.";

  return (
    <AudioProvider>
      <VoicesProvider>
        <div className="flex h-screen bg-background text-foreground">
          <Toaster />
          {session?.user && (
            <div className="hidden lg:block">
              <Sidebar session={session} />
            </div>
          )}
          <main className="flex-1 overflow-y-auto p-6 md:p-10 relative">
            {session?.user && (
              <div className="lg:hidden absolute top-4 left-4 z-20">
                <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Open menu">
                      <Menu className="h-6 w-6" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="p-0 w-64 border-r border-sidebar-border">
                    <Sidebar session={session} onLinkClick={() => setIsMobileMenuOpen(false)} />
                  </SheetContent>
                </Sheet>
              </div>
            )}

            {/* POC Caution Banner */}
            <div className="mb-6 flex items-start gap-3 p-4 bg-caution border border-caution-border rounded-md text-sm">
              <AlertTriangle className="h-5 w-5 text-caution-foreground flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-caution-foreground font-medium">
                {pocWarningMessage}
              </p>
            </div>

            <div className={cn("pt-12 lg:pt-0")}> {/* Adjusted padding if banner is outside this div */}
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