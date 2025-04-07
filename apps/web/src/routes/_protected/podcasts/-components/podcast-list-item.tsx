import { Button } from '@repo/ui/components/button';
import { cn } from '@repo/ui/lib/utils';
import { useQuery } from '@tanstack/react-query'; // Import useQuery
import {
    Loader2, // Spinner Icon
    AlertTriangle, // Warning Icon
    Play, // Play Icon
    Trash2, // Delete/Trash Icon
    ChevronDown, // Icon for expand
    ChevronUp,   // Icon for collapse
} from 'lucide-react';
import { useState } from 'react'; // Import useState
import { trpc } from '@/router';

export type PodcastStatus = 'processing' | 'failed' | 'success';

export interface Podcast {
    id: string;
    userId: string;
    title: string;
    description: string | null;
    status: PodcastStatus;
    sourceType: string | null;
    sourceDetail: string | null;
    audioUrl: string | null;
    durationSeconds: number | null;
    errorMessage: string | null;
    generatedAt: Date | string | null;
    createdAt: Date | string; // Might be Date or string
    updatedAt?: Date | string; // Optional, might not be selected in query
}

interface PodcastListItemProps {
    podcast: Podcast;
    onPlay: (id: string) => void;
    onDelete: (id: string) => void;
}

// Helper function to format date (basic example)
const formatDate = (dateInput: Date | string | null): string => {
    if (!dateInput) return 'N/A';
    try {
        const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
        return 'Invalid Date';
    }
};

// Helper function to format duration from seconds
const formatDuration = (seconds: number | null): string | null => {
    if (seconds === null || seconds === undefined || seconds <= 0) return null;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export function PodcastListItem({ podcast, onPlay, onDelete }: PodcastListItemProps) {
    const [isExpanded, setIsExpanded] = useState(false); // Add state for expansion

    const {
        id,
        status,
        title,
        description,
        sourceType,
        sourceDetail,
        createdAt,
        durationSeconds,
        errorMessage,
    } = podcast;

    // Fetch podcast details including transcript when expanded
    const podcastByIdQuery = useQuery(trpc.podcasts.byId.queryOptions(
        { id: id },
        {
            enabled: isExpanded, // Only fetch when the item is expanded
            staleTime: Infinity, // Data likely won't change unless page is refreshed
            refetchOnWindowFocus: false, // Don't refetch just because window focus changes
        }
    ));

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
                return null;
        }
    };

    // Determine the secondary content (link or text)
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
                        title={`Open source URL: ${sourceDetail}`}
                        onClick={(e) => e.stopPropagation()} // Prevent card click if nested
                    >
                        {sourceDetail} {/* Display the URL directly */}
                    </a>
                );
            } else {
                 return <span className="truncate" title={sourceDetail}>{sourceDetail}</span>;
            }
        } else if (description) {
            return <span className="truncate" title={description}>{description}</span>;
        } else if (sourceType) {
             return <span className="truncate" title={sourceType}>{`${sourceType}${sourceDetail ? `: ${sourceDetail}` : ''}`}</span>;
        } else {
            return <span className="text-gray-500">No details</span>;
        }
    };

    return (
        <div
            className={cn(
                'flex flex-col p-4 rounded-md border', // Use flex-col
                status === 'failed' ? 'border-red-500/30 bg-red-900/10' : 'border-slate-700 bg-slate-800/50',
            )}
        >
            {/* Main row: Icon, Details, Actions */}
            <div className="flex items-center justify-between w-full">
                <div className="flex items-center space-x-4 flex-1 min-w-0">
                    <div className="flex-shrink-0 w-5">{getStatusIndicator()}</div>
                    <div className="flex-1 min-w-0">
                        <p className="text-base font-medium text-white truncate" title={title || 'Untitled Podcast'}>
                            {title || 'Untitled Podcast'}
                        </p>
                        <p className="text-sm text-gray-400 min-w-0">
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
                {/* Action Buttons + Expand/Collapse */}
                <div className="flex items-center space-x-1 ml-2"> {/* Reduced space for tighter buttons */}
                     {status === 'success' && (
                        <Button /* Play Button */
                            variant="ghost" size="icon" onClick={() => onPlay(id)}
                            className="text-gray-300 hover:text-white hover:bg-slate-700" aria-label="Play Podcast" >
                            <Play className="h-4 w-4" />
                        </Button>
                    )}
                    {/* Expand/Collapse Toggle - Show if status is success */}
                    {status === 'success' && ( // Only show expand if podcast generation succeeded
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="text-gray-400 hover:text-gray-200 hover:bg-slate-700"
                            aria-label={isExpanded ? "Collapse details" : "Expand details"}
                        >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                    )}
                    <Button /* Delete Button */
                         variant="ghost" size="icon" onClick={() => onDelete(id)}
                         className="text-red-500 hover:text-red-400 hover:bg-red-900/30" aria-label="Delete Podcast">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Expanded Content Area - Fetches data on demand */}
            {isExpanded && (
                <div className="mt-3 pt-3 border-t border-slate-700 text-sm text-gray-300">
                    {podcastByIdQuery.isLoading && (
                        <div className="flex items-center space-x-2 text-gray-400">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Loading transcript...</span>
                        </div>
                    )}
                    {podcastByIdQuery.isError && (
                         <div className="flex items-center space-x-2 text-red-400">
                            <AlertTriangle className="h-4 w-4" />
                            <span>Error loading transcript: {podcastByIdQuery.error.message}</span>
                        </div>
                    )}
                    {podcastByIdQuery.data && (
                        <>
                            <h4 className="font-semibold text-gray-200 mb-1">Transcript:</h4>
                            {podcastByIdQuery.data.transcript?.content ? (
                                <pre className="whitespace-pre-wrap font-sans"> {/* Use pre for formatting, override font if needed */}
                                    {podcastByIdQuery.data.transcript.content}
                                 </pre>
                            ) : (
                                <p className="text-gray-500">No transcript available for this podcast.</p>
                            )}
                        </>
                    )}
                 </div>
            )}
        </div>
    );
}