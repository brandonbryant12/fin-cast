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
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate, stripSearchParams, type SearchSchemaInput } from '@tanstack/react-router';
import { AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import * as v from 'valibot';
import { trpc } from '@/router';
import Spinner from '@/routes/-components/common/spinner';

// Define search schema for pagination

// Input Schema (raw URL params)
const adminUsersSearchInputSchema = v.object({
 page: v.optional(v.string()), // page=... as string, or missing
});
export type AdminUsersSearchInput = v.InferInput<typeof adminUsersSearchInputSchema>;

// Processed Schema (validated, defaulted, transformed type for component use)
const adminUsersSearchProcessedSchema = v.object({
 page: v.pipe(
  v.optional(v.string(), '1'), // Default '1' if missing
  v.transform(Number),
  v.number(),
  v.integer(),
  v.minValue(1),
 ),
});
export type AdminUsersSearchOutput = v.InferOutput<typeof adminUsersSearchProcessedSchema>;

// Define default values (matching Input Schema)
const adminUsersSearchDefaults: Required<AdminUsersSearchInput> = {
 page: '1', // Default is string '1'
};

export const Route = createFileRoute('/admin/users/')({
 // Validate the raw input against the Input Schema
 validateSearch: (input: SearchSchemaInput): AdminUsersSearchInput => {
  return v.parse(adminUsersSearchInputSchema, input);
 },
 search: {
  // Apply defaults matching the Input Schema before validation
  middlewares: [stripSearchParams(adminUsersSearchDefaults)],
 },
 component: AdminUsersPage,
});

function AdminUsersPage() {
 const navigate = useNavigate({ from: Route.fullPath });
 // useSearch provides the Processed/Output type after middleware/validation
 const { page }: AdminUsersSearchOutput = Route.useSearch();
 const pageSize = 10; // Or make this configurable

 const usersQuery = useQuery(
  trpc.admin.getUsersPaginated.queryOptions(
   { page, pageSize },
   {
    placeholderData: (prev) => prev, // Keep previous data while loading new page
    staleTime: 5 * 60 * 1000, // 5 minutes
   },
  ),
 );

 const handlePageChange = (newPage: number) => {
  // Ensure newPage is at least 1
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
        <TableHead className="text-right">Created At</TableHead>
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
          <TableCell className="text-right">{formatDate(user.createdAt)}</TableCell>
         </TableRow>
        ))
       ) : (
        <TableRow>
         <TableCell colSpan={5} className="h-24 text-center">
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