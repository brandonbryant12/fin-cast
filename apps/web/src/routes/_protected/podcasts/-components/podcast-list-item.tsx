import { Button } from '@repo/ui/components/button';
import { cn } from '@repo/ui/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  Loader2,
  AlertTriangle,
  Play,
  Pause,
  Trash2,
  Info,
  LinkIcon,
} from 'lucide-react';
import { useMemo } from 'react';
import type { AppRouter } from '@repo/api/server';
import type { inferRouterOutputs } from '@trpc/server';
import { useAudioPlayer } from '@/contexts/audio-player-context';
import { trpc } from '@/router';
import { PodcastTags } from '@/routes/-components/common/podcast-tags';
import { StarRatingDisplay } from '@/routes/-components/common/star-rating-display';


type PodcastListOutput = inferRouterOutputs<AppRouter>['podcasts']['myPodcasts'];
type AdminPodcastListOutput = inferRouterOutputs<AppRouter>['admin']['getAllPodcastsPaginated']['podcasts'];

// Combine types to represent a podcast from either source
export type Podcast = PodcastListOutput[number] & Partial<AdminPodcastListOutput[number]>;


interface PodcastListItemProps {
    podcast: Podcast;
    onDelete: (id: string) => void;
    isAdminView?: boolean; // Flag to indicate if it's used in admin context
}

const formatDate = (dateInput: Date | string | null): string => {
    if (!dateInput) return 'N/A';
    try {
        const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
        return 'Invalid Date';
    }
};

const formatDuration = (seconds: number | null): string | null => {
    if (seconds === null || seconds === undefined || seconds <= 0) return null;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export function PodcastListItem({ podcast, onDelete, isAdminView }: PodcastListItemProps) {
    const {
        activePodcast,
        isPlaying: isContextPlaying,
        loadTrack,
        play,
        pause
    } = useAudioPlayer();

    const {
        id,
        status,
        title,
        sourceType,
        sourceDetail,
        createdAt,
        audioUrl,
        durationSeconds,
        errorMessage,
        user
    } = podcast;

    const reviewsQueryOptions = trpc.reviews.byEntityId.queryOptions({ entityId: id, contentType: 'podcast' });
    const { data: reviews, isLoading: isLoadingReviews } = useQuery(reviewsQueryOptions);

    const { averageRating, totalReviews } = useMemo(() => {
      if (!reviews || reviews.length === 0) {
          return { averageRating: 0, totalReviews: 0 };
        }
        const totalStars = reviews.reduce((sum, review) => sum + review.stars, 0);
        const avg = totalStars / reviews.length;
        return { averageRating: avg, totalReviews: reviews.length };
     }, [reviews]);


    const isActive = activePodcast?.id === id;
    const shouldShowPauseIcon = isActive && isContextPlaying;
    const isProcessing = status === 'processing';

    const formattedDate = formatDate(createdAt);
    const formattedDuration = formatDuration(durationSeconds);

    // Determine the hover title based on source type
    const hoverTitle = sourceType === 'url' && sourceDetail ? `Source: ${sourceDetail}` : undefined;

    const getStatusIndicator = () => {
        switch (status) {
            case 'processing':
                return <Loader2 className="h-5 w-5 animate-spin text-blue-400" aria-label="Processing" />;
            case 'failed':
                return (
                    <AlertTriangle
                        className="h-5 w-5 text-red-500"
                        aria-label={`Failed: ${errorMessage || 'Generation failed'}`}
                    />
                );
            case 'success':
            default:
                return <div className="h-5 w-5" />;
        }
    };


    const handlePlayPauseClick = (e: React.MouseEvent) => {
        e.stopPropagation();

        if (status !== 'success' || !audioUrl) {
            console.warn('Cannot play podcast: Invalid status or missing audioUrl');
            return;
        }

        if (isActive) {
            if (isContextPlaying) {
                pause();
            } else {
                play();
            }
        } else {
            loadTrack({ id, title: title || 'Untitled Podcast', audioUrl });
        }
    };

    return (
        <div
            title={hoverTitle}
            className={cn(
                'flex flex-col p-4 rounded-md border transition-colors duration-150',
                status === 'failed' ? 'border-destructive/30 bg-destructive/10' : 'border-border',
                isActive ? 'bg-card/70' : 'bg-card'
            )}
        >
            <div className="flex items-start justify-between w-full">
                <div className="flex items-center space-x-4 flex-1 min-w-0">
                    <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center pt-1">{getStatusIndicator()}</div>
                    <div className="flex-1 min-w-0">
                        <p className="text-base font-medium text-foreground truncate" title={title || 'Untitled Podcast'}>
                            {title || 'Untitled Podcast'}
                        </p>
                                {isAdminView && user && (
                                  <p className="text-xs text-muted-foreground mt-1" title={user.email ?? ''}>
                                      Created by: {user.name ?? 'Unknown'} ({user.email ?? 'No Email'})
                                  </p>
                                )}
                        <div className="mt-1.5">
                           <PodcastTags tags={podcast.tags} />
                         </div>
                        {!isLoadingReviews && totalReviews > 0 && (
                            <div className="mt-1.5 flex items-center">
                             <StarRatingDisplay
                                rating={averageRating}
                                totalReviews={totalReviews}
                                showText={true}
                                size={14}
                              />
                            </div>
                        )}
                        {status === 'failed' && errorMessage && (
                            <p className="text-xs text-destructive mt-1 truncate" title={errorMessage}>{errorMessage}</p>
                        )}
                    </div>
                </div>
                <div className="flex flex-col items-end space-y-1 ml-2 flex-shrink-0">
                  <div className="flex items-center space-x-1">
                      {status === 'success' && (
                          <Button
                              variant="ghost" size="icon"
                              onClick={handlePlayPauseClick}
                              className={cn(
                                  'text-muted-foreground hover:text-foreground hover:bg-muted/20',
                              )}
                              aria-label={shouldShowPauseIcon ? 'Pause Podcast' : 'Play Podcast'}
                          >
                              {shouldShowPauseIcon ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </Button>
                      )}
                      {sourceType === 'url' && sourceDetail && (sourceDetail.startsWith('http://') || sourceDetail.startsWith('https://')) && (
                         <Button
                              variant="ghost"
                              size="icon"
                              asChild
                              className="text-info hover:text-info/80 hover:bg-muted/20"
                              onClick={(e) => e.stopPropagation()}
                              aria-label="View Source URL"
                          >
                             <a href={sourceDetail} target="_blank" rel="noopener noreferrer">
                               <LinkIcon className="h-4 w-4" />
                             </a>
                         </Button>
                      )}
                      <Link
                          to="/podcasts/$podcastId"
                          params={{ podcastId: id }}
                          onClick={(e) => e.stopPropagation()}
                          aria-label="View Details"
                          aria-disabled={isProcessing}
                          className={cn(isProcessing && 'pointer-events-none')}
                      >
                          <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-foreground hover:bg-muted/20"
                              disabled={isProcessing}
                              aria-hidden="true"
                          >
                              <Info className="h-4 w-4" />
                          </Button>
                      </Link>
                      <Button
                           variant="ghost" size="icon"
                           onClick={(e) => {
                               e.stopPropagation();
                                onDelete(id);
                           }}
                           className="text-destructive hover:text-destructive/80 hover:bg-destructive/10" aria-label="Delete Podcast">
                          <Trash2 className="h-4 w-4" />
                      </Button>
                  </div>
                  <p className="text-xs text-muted-foreground text-right pr-1">
                       {formattedDate} {formattedDuration ? `| ${formattedDuration}` : ''}
                  </p>
                </div>
            </div>
        </div>
    );
}