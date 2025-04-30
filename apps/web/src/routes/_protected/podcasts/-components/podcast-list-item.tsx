import { Button } from '@repo/ui/components/button';
import { cn } from '@repo/ui/lib/utils';
import { Link } from '@tanstack/react-router';
import {
    Loader2,
    AlertTriangle,
    Play,
    Pause,
    Trash2,
    Info,
} from 'lucide-react';
import type { AppRouter } from '@repo/api/server';
import type { inferRouterOutputs } from '@trpc/server';
import { useAudioPlayer } from '@/contexts/audio-player-context';


type PodcastListOutput = inferRouterOutputs<AppRouter>['podcasts']['myPodcasts'];

export type Podcast = PodcastListOutput[number];

interface PodcastListItemProps {
    podcast: Podcast;
    onDelete: (id: string) => void;
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

export function PodcastListItem({ podcast, onDelete }: PodcastListItemProps) {
    // Removed isExpanded state

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
        description,
        sourceType,
        sourceDetail,
        createdAt,
        audioUrl,
        durationSeconds,
        errorMessage,
    } = podcast;

    const isActive = activePodcast?.id === id;
    const shouldShowPauseIcon = isActive && isContextPlaying;
    const isProcessing = status === 'processing';

    // Removed podcastByIdQuery

    const formattedDate = formatDate(createdAt);
    const formattedDuration = formatDuration(durationSeconds);

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

    const renderSecondaryContent = () => {
        if (sourceType === 'url' && sourceDetail) {
            const looksLikeUrl = sourceDetail.startsWith('http://') || sourceDetail.startsWith('https://');
            if (looksLikeUrl) {
                 return (
                    <a
                        href={sourceDetail}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-400 hover:text-sky-300 hover:underline truncate"
                        title={sourceDetail}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {sourceDetail}
                    </a>
                );
            } else {
                return <span className="block truncate" title={sourceDetail}>{sourceDetail}</span>;
            }
        } else if (description) {
            return <span className="block truncate" title={description}>{description}</span>;
        } else if (sourceType) {
             return <span className="block truncate" title={sourceType}>{`${sourceType}${sourceDetail ? `: ${sourceDetail}` : ''}`}</span>;
        } else {
            return <span className="text-gray-500">No details</span>;
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
            className={cn(
                'flex flex-col p-4 rounded-md border transition-colors duration-150',
                status === 'failed' ? 'border-red-500/30 bg-red-900/10' : 'border-slate-700',
                isActive ? 'bg-slate-700/70' : 'bg-slate-800/50'
            )}
        >
            <div className="flex items-center justify-between w-full">
                <div className="flex items-center space-x-4 flex-1 min-w-0">
                    <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">{getStatusIndicator()}</div>
                    <div className="flex-1 min-w-0">
                        <p className="text-base font-medium text-white truncate" title={title || 'Untitled Podcast'}>
                            {title || 'Untitled Podcast'}
                        </p>
                        <p className="text-sm text-gray-400 min-w-0 overflow-hidden">
                           {renderSecondaryContent()}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            {formattedDate} {formattedDuration ? `| ${formattedDuration}` : ''}
                        </p>
                        {status === 'failed' && errorMessage && (
                            <p className="text-xs text-red-400 mt-1 truncate" title={errorMessage}>{errorMessage}</p>
                        )}
                    </div>
                </div>
                <div className="flex items-center space-x-1 ml-2 flex-shrink-0">
                     {status === 'success' && (
                        <Button
                            variant="ghost" size="icon"
                            onClick={handlePlayPauseClick}
                            className={cn(
                                'text-gray-300 hover:text-white hover:bg-slate-700',
                            )}
                            aria-label={shouldShowPauseIcon ? 'Pause Podcast' : 'Play Podcast'}
                        >
                            {shouldShowPauseIcon ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                    )}
                    <Link
                        to="/podcasts/$podcastId"
                        params={{ podcastId: id }}
                        onClick={(e) => e.stopPropagation()}
                        aria-label="View Details" // Changed label
                        aria-disabled={isProcessing}
                        className={cn(isProcessing && 'pointer-events-none')}
                    >
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-gray-400 hover:text-gray-200 hover:bg-slate-700"
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
                         className="text-red-500 hover:text-red-400 hover:bg-red-900/30" aria-label="Delete Podcast">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}