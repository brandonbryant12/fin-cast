import { Alert, AlertDescription, AlertTitle } from '@repo/ui/components/alert';
import { Badge } from '@repo/ui/components/badge';
import { Button } from '@repo/ui/components/button';
import {
 Card,
 CardHeader,
 CardTitle,
 CardDescription,
 CardContent,
 CardFooter,
} from '@repo/ui/components/card';
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from '@repo/ui/components/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate, stripSearchParams, type SearchSchemaInput } from '@tanstack/react-router';
import { AlertCircle, ChevronLeft, ChevronRight, ShieldCheck, ShieldOff } from 'lucide-react';
import * as v from 'valibot';
import { authClient } from '@/clients/authClient';
import { trpc } from '@/router';
import Spinner from '@/routes/-components/common/spinner';
import { StarRatingDisplay } from '@/routes/-components/common/star-rating-display';

const adminUsersSearchInputSchema = v.object({
 page: v.optional(v.string()),
});
export type AdminUsersSearchInput = v.InferInput<typeof adminUsersSearchInputSchema>;

const adminUsersSearchProcessedSchema = v.object({
 page: v.pipe(
  v.optional(v.string(), '1'),
  v.transform(Number),
  v.number(),
  v.integer(),
  v.minValue(1),
 ),
});
export type AdminUsersSearchOutput = v.InferOutput<typeof adminUsersSearchProcessedSchema>;

const adminUsersSearchDefaults: Required<AdminUsersSearchInput> = {
 page: '1',
};

export const Route = createFileRoute('/admin/users/')({
 validateSearch: (input: SearchSchemaInput): AdminUsersSearchInput => {
  return v.parse(adminUsersSearchInputSchema, input);
 },
 search: {
  middlewares: [stripSearchParams(adminUsersSearchDefaults)],
 },
 component: AdminUsersPage,
});

function AdminUsersPage() {
 const navigate = useNavigate({ from: Route.fullPath });
 const { page }: AdminUsersSearchOutput = Route.useSearch();
 const pageSize = 10;
 const queryClient = useQueryClient();
 const { data: session } = authClient.useSession();

 const usersQuery = useQuery(
  trpc.admin.getUsersPaginated.queryOptions(
   { page, pageSize },
   {
    placeholderData: (prev) => prev,
    staleTime: 5 * 60 * 1000,
   },
   ),
 );

 const setUserAdminStatusMutation = useMutation({
    ...trpc.admin.setUserAdminStatus.mutationOptions(),
   onSuccess: () => {
     queryClient.invalidateQueries(trpc.admin.getUsersPaginated.queryOptions({ page, pageSize }));
   },
   onError: (error) => {
     console.error("Failed to update admin status:", error);
     alert(`Error: ${error.message}`);
   },
 });

 const handlePageChange = (newPage: number) => {
  const validNewPage = Math.max(1, newPage);
  navigate({ search: (prev) => ({ ...prev, page: validNewPage }) });
 };

 const formatDate = (dateInput: Date | string | null): string => {
  if (!dateInput) return 'N/A';
  try {
   const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
   return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
   });
  } catch {
   return 'Invalid Date';
  }
 };

 return (
  <Card>
   <CardHeader>
    <CardTitle>Admin - User Management</CardTitle>
    <CardDescription>View and manage application users.</CardDescription>
   </CardHeader>
   <CardContent>
    {usersQuery.isPending && (
     <div className="flex justify-center items-center h-40">
      <Spinner /> Loading users...
     </div>
    )}
    {usersQuery.isError && (
     <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error Loading Users</AlertTitle>
      <AlertDescription>
       {usersQuery.error.message || 'Could not fetch users.'}
      </AlertDescription>
     </Alert>
    )}
    {usersQuery.data && (
     <Table>
      <TableHeader>
       <TableRow>
        <TableHead>Name</TableHead>
        <TableHead>Email</TableHead>
        <TableHead className="text-center">Admin</TableHead>
        <TableHead className="text-center">Podcasts</TableHead>
         <TableHead className="text-center">App Rating</TableHead>
         <TableHead className="text-right">Created At</TableHead>
         <TableHead className="text-center">Actions</TableHead>
       </TableRow>
     </TableHeader>
     <TableBody>
       {usersQuery.data.users.length > 0 ? (
        usersQuery.data.users.map((user) => (
         <TableRow key={user.id}>
          <TableCell className="font-medium">{user.name}</TableCell>
          <TableCell>{user.email}</TableCell>
          <TableCell className="text-center">
           {user.isAdmin ? (
            <Badge variant="default">Yes</Badge>
           ) : (
            <Badge variant="secondary">No</Badge>
           )}
          </TableCell>
          <TableCell className="text-center">{user.successfulPodcastCount}</TableCell>
          <TableCell className="flex justify-center">
             <StarRatingDisplay rating={user.appReviewStars} size={14} showText={false} />
           </TableCell>
           <TableCell className="text-right">{formatDate(user.createdAt)}</TableCell>
           <TableCell className="text-center">
             {session?.user?.id !== user.id && (
               <Button
                 variant={user.isAdmin ? "destructive" : "outline"}
                 size="sm"
                 onClick={() => setUserAdminStatusMutation.mutate({ userId: user.id, isAdmin: !user.isAdmin })}
                 disabled={setUserAdminStatusMutation.isPending}
                 title={user.isAdmin ? "Remove Admin Privileges" : "Grant Admin Privileges"}
               >
                 {setUserAdminStatusMutation.isPending && setUserAdminStatusMutation.variables?.userId === user.id ? (
                   <Spinner className="mr-2 h-4 w-4 animate-spin" />
                 ) : user.isAdmin ? (
                   <ShieldOff className="mr-2 h-4 w-4" />
                 ) : (
                   <ShieldCheck className="mr-2 h-4 w-4" />
                 )}
                 {user.isAdmin ? 'Revoke Admin' : 'Make Admin'}
               </Button>
             )}
           </TableCell>
         </TableRow>
       ))
     ) : (
       <TableRow>
         <TableCell colSpan={7} className="h-24 text-center">
           No users found.
         </TableCell>
       </TableRow>
       )}
      </TableBody>
     </Table>
    )}
   </CardContent>
   {usersQuery.data && usersQuery.data.pagination.totalPages > 1 && (
    <CardFooter className="flex items-center justify-between pt-4">
     <span className="text-sm text-muted-foreground">
      Page {usersQuery.data.pagination.currentPage} of {usersQuery.data.pagination.totalPages}
     </span>
     <div className="flex items-center space-x-2">
      <Button
       variant="outline"
       size="sm"
       onClick={() => handlePageChange(page - 1)}
       disabled={page <= 1 || usersQuery.isFetching}
      >
       <ChevronLeft className="h-4 w-4 mr-1" />
       Previous
      </Button>
      <Button
       variant="outline"
       size="sm"
       onClick={() => handlePageChange(page + 1)}
       disabled={page >= usersQuery.data.pagination.totalPages || usersQuery.isFetching}
      >
       Next
       <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
     </div>
    </CardFooter>
   )}
  </Card>
 );
}