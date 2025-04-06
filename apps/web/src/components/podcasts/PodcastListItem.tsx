import { Button } from '@repo/ui/components/button';
import { cn } from '@repo/ui/lib/utils';
import {
    Loader2, // Spinner Icon
    AlertTriangle, // Warning Icon
    Play, // Play Icon
    Trash2, // Delete/Trash Icon
    // Optional Icons:
    // FileText, // Summary/Text Icon
    // Download, // Download Icon
} from 'lucide-react';

// Define the possible statuses for a podcast
type PodcastStatus = 'processing' | 'failed' | 'success';

// Define the structure of the podcast data this component expects
interface Podcast {
    id: string;
    status: PodcastStatus;
    title: string;
    sourceType: string; // e.g., "Generated from URL", "Weekly Briefing"
    sourceDetail?: string; // e.g., "example.com", null
    generatedDate: string; // e.g., "Apr 6, 2025"
    duration?: string; // e.g., "5:32"
    errorMessage?: string; // Only present if status is 'failed'
}

interface PodcastListItemProps {
    podcast: Podcast;
    onPlay: (id: string) => void;
    onDelete: (id: string) => void;
    // Optional action handlers
    // onViewSummary?: (id: string) => void;
    // onDownload?: (id: string) => void;
}

export function PodcastListItem({ podcast, onPlay, onDelete }: PodcastListItemProps) {
    const { id, status, title, sourceType, sourceDetail, generatedDate, duration, errorMessage } =
        podcast;

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
                return null; // No icon for success
        }
    };

    return (
        <div
            className={cn(
                'flex items-center justify-between p-4 rounded-md border border-slate-700 bg-slate-800/50',
                status === 'failed' ? 'border-red-500/30' : 'border-slate-700',
            )}
        >
            <div className="flex items-center space-x-4 flex-1 min-w-0">
                <div className="flex-shrink-0 w-5">{getStatusIndicator()}</div>
                <div className="flex-1 min-w-0">
                    <p className="text-base font-medium text-white truncate" title={title}>
                        {title || 'Untitled Podcast'}
                    </p>
                    <p className="text-sm text-gray-400 truncate">
                        {sourceType}
                        {sourceDetail ? `: ${sourceDetail}` : ''}
                    </p>
                    <p className="text-xs text-gray-500">
                        {generatedDate} {duration ? `| ${duration}` : ''}
                    </p>
                    {status === 'failed' && errorMessage && (
                        <p className="text-xs text-red-400 mt-1 truncate" title={errorMessage}>{errorMessage}</p>
                    )}
                </div>
            </div>
            <div className="flex items-center space-x-2 ml-4">
                {status === 'success' && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-300 hover:text-white hover:bg-slate-700"
                        onClick={() => onPlay(id)}
                        aria-label="Play Podcast"
                    >
                        <Play className="h-4 w-4" />
                    </Button>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-500 hover:text-red-400 hover:bg-red-900/30"
                    onClick={() => onDelete(id)}
                    aria-label="Delete Podcast"
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
} 