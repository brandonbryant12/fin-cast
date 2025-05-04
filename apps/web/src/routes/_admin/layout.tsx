import { Outlet, createFileRoute, useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';
import { authClient } from '@/clients/authClient';
import Spinner from '@/routes/-components/common/spinner';
import { Alert, AlertDescription, AlertTitle } from '@repo/ui/components/alert';
import { AlertCircle } from 'lucide-react';


function useIsAdminStatus() {
  const { data: session, isPending } = authClient.useSession();

  const isAdmin = session?.user?.isAdmin ?? false;

  return { isAdmin, isLoading: isPending, isAuthenticated: !!session?.user };
}

export const Route = createFileRoute('/_admin')({
  component: AdminLayout,
});

function AdminLayout() {
  const { isAdmin, isLoading, isAuthenticated } = useIsAdminStatus();
  const navigate = useNavigate({ from: Route.fullPath });
  const routerState = useRouterState();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        // If not authenticated, redirect to login
        navigate({ to: '/login', search: { redirect: routerState.location.pathname } });
      } else if (!isAdmin) {
        // If authenticated but not admin, redirect to home
        navigate({ to: '/home' });
      }
    }
  }, [isLoading, isAuthenticated, isAdmin, navigate, routerState.location.pathname]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-32">
        <Spinner /> Loading Admin Section...
      </div>
    );
  }

  // Only render Outlet if authenticated and admin check passed (or hasn't redirected yet)
  if (isAuthenticated && isAdmin) {
    return (
      <div className="admin-layout">
        <Outlet />
      </div>
    );
  }

  // Fallback while redirecting or if logic fails briefly
  return (
    <div className="flex justify-center items-center h-32">
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>
          You do not have permission to view this page. Redirecting...
        </AlertDescription>
      </Alert>
    </div>
  );
}