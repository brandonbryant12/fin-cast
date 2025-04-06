import { Button } from '@repo/ui/components/button'; // Assuming shadcn button path
import { createLazyFileRoute } from '@tanstack/react-router';
import { Plus } from 'lucide-react';

// Placeholder for PodcastListItem component (to be created)
// import { PodcastListItem } from '@/components/podcasts/PodcastListItem';

// Placeholder for data fetching/state management
const isLoading = false;
const podcasts: any[] = [];

export const Route = createLazyFileRoute('/podcasts')({
    component: PodcastsPage,
});

function PodcastsPage() {
    const handleGenerateClick = () => {
        console.log('Generate New Podcast clicked');
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-white">My Podcasts</h1>
                <Button
                    size="lg"
                    className="bg-teal-500 text-white hover:bg-teal-600 font-semibold rounded-lg px-6 py-3" // Adjusted padding slightly
                    onClick={handleGenerateClick}
                >
                    <Plus className="mr-2 h-5 w-5" />
                    Generate New Podcast
                </Button>
            </div>

            {/* Content Area */}
            <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
                {isLoading ? (
                    <div className="flex justify-center items-center h-40">
                        {/* Add a proper spinner component here */}
                        <p className="text-gray-300">Loading podcasts...</p>
                    </div>
                ) : podcasts.length === 0 ? (
                    <div className="text-center py-10">
                        <h2 className="text-xl font-semibold text-white mb-2">
                            No Podcasts Yet
                        </h2>
                        <p className="text-gray-300 mb-6">
                            Your generated podcasts will appear here. Click 'Generate New
                            Podcast' to create your first audio summary from an article URL.
                        </p>
                        {/* Optionally repeat the button here or visually guide user to top-right button */}
                        {/* <Button size="lg" className="bg-teal-500 ...">Generate New Podcast</Button> */}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Placeholder: Podcast list items will go here */}
                        <p className="text-gray-400">
                            Podcast list items will be displayed here.
                        </p>
                        {/* Example usage (once component exists):
                        {podcasts.map((podcast) => (
                            <PodcastListItem key={podcast.id} podcast={podcast} />
                        ))} */}
                    </div>
                )}
            </div>
        </div>
    );
} 