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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@repo/ui/components/tooltip';
 import { useQuery } from '@tanstack/react-query';
 import { createFileRoute, useNavigate, stripSearchParams, type SearchSchemaInput } from '@tanstack/react-router';
import { AlertCircle, ChevronLeft, ChevronRight, Podcast, Smartphone } from 'lucide-react';
 import * as v from 'valibot';
 import { trpc } from '@/router';
 import Spinner from '@/routes/-components/common/spinner';
 import { StarRatingDisplay } from '@/routes/-components/common/star-rating-display';

const adminReviewsSearchInputSchema = v.object({
 page: v.optional(v.string()),
});
export type AdminReviewsSearchInput = v.InferInput<typeof adminReviewsSearchInputSchema>;

const adminReviewsSearchProcessedSchema = v.object({
 page: v.pipe(
  v.optional(v.string(), '1'),
  v.transform(Number),
  v.number(),
  v.integer(),
  v.minValue(1),
 ),
});
export type AdminReviewsSearchOutput = v.InferOutput<typeof adminReviewsSearchProcessedSchema>;

const adminReviewsSearchDefaults: Required<AdminReviewsSearchInput> = {
 page: '1',
};

export const Route = createFileRoute('/admin/reviews/')({
 validateSearch: (input: SearchSchemaInput): AdminReviewsSearchInput => {
  return v.parse(adminReviewsSearchInputSchema, input);
 },
 search: {
  middlewares: [stripSearchParams(adminReviewsSearchDefaults)],
 },
 component: AdminReviewsPage,
});

function AdminReviewsPage() {
 const navigate = useNavigate({ from: Route.fullPath });
 const { page }: AdminReviewsSearchOutput = Route.useSearch();
 const pageSize = 10;

 const statsQuery = useQuery(trpc.admin.getReviewStats.queryOptions());

 const reviewsQuery = useQuery(
  trpc.admin.getReviewsPaginated.queryOptions(
   { page, pageSize },
   {
    placeholderData: (prev) => prev,
    staleTime: 5 * 60 * 1000,
   },
  ),
 );

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
    <CardTitle>Admin - Review Management</CardTitle>
    <CardDescription>View and manage user reviews for the app and podcasts.</CardDescription>
   </CardHeader>
   <CardContent>
    {/* Stats Section */}
    <div className="mb-6 grid gap-4 md:grid-cols-2">
     <Card className="bg-card/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
       <CardTitle className="text-sm font-medium">App Reviews</CardTitle>
       <Smartphone className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
       {statsQuery.isLoading && <Spinner/>}
       {statsQuery.isError && <span className="text-xs text-destructive">Error loading stats</span>}
       {statsQuery.data && (
        <>
         <div className="text-2xl font-bold">{statsQuery.data.appReviewCount}</div>
         <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <StarRatingDisplay rating={statsQuery.data.appAvgRating} size={12} showText={true}/> avg
         </div>
        </>
       )}
      </CardContent>
     </Card>
     <Card className="bg-card/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
       <CardTitle className="text-sm font-medium">Podcast Reviews</CardTitle>
       <Podcast className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
       {statsQuery.isLoading && <Spinner/>}
       {statsQuery.isError && <span className="text-xs text-destructive">Error loading stats</span>}
       {statsQuery.data && (
         <>
          <div className="text-2xl font-bold">{statsQuery.data.podcastReviewCount}</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
           <StarRatingDisplay rating={statsQuery.data.podcastAvgRating} size={12} showText={true} /> avg
          </div>
         </>
       )}
      </CardContent>
     </Card>
    </div>

    {/* Table Section */}
    {reviewsQuery.isPending && (
     <div className="flex justify-center items-center h-40">
      <Spinner /> Loading reviews...
     </div>
    )}
    {reviewsQuery.isError && (
     <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error Loading Reviews</AlertTitle>
      <AlertDescription>
       {reviewsQuery.error.message || 'Could not fetch reviews.'}
      </AlertDescription>
     </Alert>
    )}
    {reviewsQuery.data && (
     <TooltipProvider>
      <Table>
       <TableHeader>
        <TableRow>
         <TableHead>User</TableHead>
         <TableHead className="text-center">Type</TableHead>
         <TableHead className="text-center">Rating</TableHead>
         <TableHead>Feedback</TableHead>
         <TableHead className="text-right">Date</TableHead>
        </TableRow>
       </TableHeader>
       <TableBody>
        {reviewsQuery.data.reviews.length > 0 ? (
         reviewsQuery.data.reviews.map((review) => (
          <TableRow key={review.id}>
           <TableCell className="font-medium">
            <div className="text-sm">{review.user?.name ?? 'Unknown User'}</div>
            <div className="text-xs text-muted-foreground">{review.user?.email}</div>
           </TableCell>
           <TableCell className="text-center">
            <Badge variant={review.contentType === 'app' ? 'default' : 'secondary'}>
             {review.contentType === 'app' ? 'App' : 'Podcast'}
            </Badge>
            {review.contentType === 'podcast' && (
             <div className="text-xs text-muted-foreground mt-1 truncate" title={review.entityId}>
              ID: {review.entityId.substring(0, 8)}...
             </div>
            )}
           </TableCell>
           <TableCell className="text-center">
             <div className="flex justify-center items-center">
                <StarRatingDisplay rating={review.stars} size={14} showText={false} />
             </div>
           </TableCell>
           <TableCell className="max-w-xs">
            {review.feedback ? (
             <Tooltip>
              <TooltipTrigger asChild>
               <p className="truncate cursor-help">{review.feedback}</p>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-sm whitespace-normal break-words">
               {review.feedback}
              </TooltipContent>
             </Tooltip>
            ) : (
             <span className="text-muted-foreground italic">No feedback</span>
            )}
           </TableCell>
           <TableCell className="text-right">{formatDate(review.createdAt)}</TableCell>
          </TableRow>
         ))
        ) : (
         <TableRow>
          <TableCell colSpan={5} className="h-24 text-center">
           No reviews found.
          </TableCell>
         </TableRow>
        )}
       </TableBody>
      </Table>
     </TooltipProvider>
    )}
   </CardContent>
   {reviewsQuery.data && reviewsQuery.data.pagination.totalPages > 1 && (
    <CardFooter className="flex items-center justify-between pt-4">
     <span className="text-sm text-muted-foreground">
      Page {reviewsQuery.data.pagination.currentPage} of {reviewsQuery.data.pagination.totalPages}
     </span>
     <div className="flex items-center space-x-2">
      <Button
       variant="outline"
       size="sm"
       onClick={() => handlePageChange(page - 1)}
       disabled={page <= 1 || reviewsQuery.isFetching}
      >
       <ChevronLeft className="h-4 w-4 mr-1" />
       Previous
      </Button>
      <Button
       variant="outline"
       size="sm"
       onClick={() => handlePageChange(page + 1)}
       disabled={page >= reviewsQuery.data.pagination.totalPages || reviewsQuery.isFetching}
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