import { Alert, AlertDescription, AlertTitle } from '@repo/ui/components/alert';
import { Button } from '@repo/ui/components/button';
import {
 Card,
 CardHeader,
 CardTitle,
 CardDescription,
 CardContent,
 CardFooter,
} from '@repo/ui/components/card';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate, stripSearchParams, type SearchSchemaInput } from '@tanstack/react-router';
import { AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import * as v from 'valibot';
import { useAudioPlayer } from '@/contexts/audio-player-context';
import { trpc } from '@/router';
import Spinner from '@/routes/-components/common/spinner';
import { PodcastListItem } from '@/routes/_protected/podcasts/-components/podcast-list-item';

const adminPodcastsSearchInputSchema = v.object({
 page: v.optional(v.string()),
});
export type AdminPodcastsSearchInput = v.InferInput<typeof adminPodcastsSearchInputSchema>;

const adminPodcastsSearchProcessedSchema = v.object({
 page: v.pipe(
  v.optional(v.string(), '1'),
  v.transform(Number),
  v.number(),
  v.integer(),
  v.minValue(1),
 ),
});
export type AdminPodcastsSearchOutput = v.InferOutput<typeof adminPodcastsSearchProcessedSchema>;

const adminPodcastsSearchDefaults: Required<AdminPodcastsSearchInput> = {
 page: '1',
};


export const Route = createFileRoute('/admin/podcasts/')({
  validateSearch: (input: SearchSchemaInput): AdminPodcastsSearchInput => {
   return v.parse(adminPodcastsSearchInputSchema, input);
  },
  search: {
   middlewares: [stripSearchParams(adminPodcastsSearchDefaults)],
  },
 component: AdminPodcastsPage,
});

function AdminPodcastsPage() {
 const navigate = useNavigate({ from: Route.fullPath });
 const { page }: AdminPodcastsSearchOutput = Route.useSearch();
 const pageSize = 10;
 const queryClient = useQueryClient();
 const { activePodcast, closePlayer } = useAudioPlayer();

 const podcastsQuery = useQuery(
  trpc.admin.getAllPodcastsPaginated.queryOptions(
   { page, pageSize },
   {
    placeholderData: (prev) => prev,
    staleTime: 5 * 60 * 1000, // 5 minutes
   },
  ),
 );

 const deletePodcastMutation = useMutation({
   ...trpc.admin.deletePodcast.mutationOptions(),
  onSuccess: async (_data, variables) => {
   toast.success('Podcast deleted successfully.');
   if (activePodcast?.id === variables.id) {
       await closePlayer();
   }
   queryClient.invalidateQueries({ queryKey: trpc.admin.getAllPodcastsPaginated.queryKey() });
  },
  onError: (error) => {
   toast.error('Failed to delete podcast', {
    description: error.message || 'An unexpected error occurred.',
   });
  },
 });

 const handleDelete = (id: string) => {
  // Optional: Add a confirmation dialog here
  deletePodcastMutation.mutate({ id });
 };

 const handlePageChange = (newPage: number) => {
  const validNewPage = Math.max(1, newPage);
  navigate({ search: (prev) => ({ ...prev, page: validNewPage }) });
 };


 return (
  <Card>
   <CardHeader>
    <CardTitle>Admin - All Podcasts</CardTitle>
    <CardDescription>View and manage all podcasts generated in the system.</CardDescription>
   </CardHeader>
   <CardContent>
    {podcastsQuery.isPending && (
     <div className="flex justify-center items-center h-40">
      <Spinner /> Loading podcasts...
     </div>
    )}
    {podcastsQuery.isError && (
     <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error Loading Podcasts</AlertTitle>
      <AlertDescription>
       {podcastsQuery.error.message || 'Could not fetch podcasts.'}
      </AlertDescription>
     </Alert>
    )}
    {podcastsQuery.data && (
     podcastsQuery.data.podcasts.length === 0 ? (
        <div className="text-center py-10 px-4">
          <h2 className="text-lg md:text-xl font-semibold text-white mb-2">No Podcasts Found</h2>
          <p className="text-gray-300 text-sm md:text-base">
              There are currently no podcasts in the system.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {podcastsQuery.data.podcasts.map((podcast) => (
            <PodcastListItem
              key={podcast.id}
              podcast={podcast}
              onDelete={handleDelete}
              isAdminView={true}
            />
          ))}
        </div>
      )
    )}
   </CardContent>
   {podcastsQuery.data && podcastsQuery.data.pagination.totalPages > 1 && (
    <CardFooter className="flex items-center justify-between pt-4">
     <span className="text-sm text-muted-foreground">
      Page {podcastsQuery.data.pagination.currentPage} of {podcastsQuery.data.pagination.totalPages} ({podcastsQuery.data.pagination.totalCount} total)
     </span>
     <div className="flex items-center space-x-2">
      <Button
       variant="outline"
       size="sm"
       onClick={() => handlePageChange(page - 1)}
       disabled={page <= 1 || podcastsQuery.isFetching || deletePodcastMutation.isPending}
      >
       <ChevronLeft className="h-4 w-4 mr-1" />
       Previous
      </Button>
      <Button
       variant="outline"
       size="sm"
       onClick={() => handlePageChange(page + 1)}
       disabled={page >= podcastsQuery.data.pagination.totalPages || podcastsQuery.isFetching || deletePodcastMutation.isPending}
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