import { Alert, AlertDescription, AlertTitle } from '@repo/ui/components/alert';
import { useQuery } from '@tanstack/react-query';
import { Outlet, createFileRoute, useNavigate, useRouterState } from '@tanstack/react-router';
import { AlertCircle, Construction } from 'lucide-react';
import { useEffect } from 'react';
import { authClient } from '@/clients/authClient';
import { trpc } from '@/router';
import Spinner from '@/routes/-components/common/spinner';


function useIsAdminStatus() {
 const { data: session, isPending: isSessionPending } = authClient.useSession();
 const isAuthenticated = !!session?.user;

 const { data: adminStatus, isLoading: isAdminLoading } = useQuery(
  trpc.auth.isAdminStatus.queryOptions(undefined, {
   enabled: isAuthenticated,
   staleTime: 5 * 60 * 1000,
   gcTime: 10 * 60 * 1000,
  })
 );

 const isAdmin = adminStatus?.isAdmin ?? false;
 const isLoading = isSessionPending || (isAuthenticated && isAdminLoading);

 return { isAdmin, isLoading, isAuthenticated };
}

export const Route = createFileRoute('/admin')({
 component: AdminLayout,
});

function AdminLayout() {
 const { isAdmin, isLoading, isAuthenticated } = useIsAdminStatus();
 const navigate = useNavigate({ from: Route.fullPath });
 const routerState = useRouterState();

 useEffect(() => {
  if (!isLoading) {
   if (!isAuthenticated) {
    navigate({ to: '/login', search: { redirect: routerState.location.pathname } });
   } else if (!isAdmin) {
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

 if (isAuthenticated && isAdmin) {
    return (
     <div className="space-y-6">
      <div className="flex items-center gap-2 p-4 bg-caution border border-caution-border rounded-md">
       <Construction className="h-6 w-6 text-caution-foreground"/>
       <p className="text-caution-foreground text-sm font-medium">
        Admin Area: Features under development. Proceed with caution.
       </p>
      </div>
      <Outlet />
     </div>
    );
   }

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