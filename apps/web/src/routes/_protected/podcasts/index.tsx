import { Button } from '@repo/ui/components/button';
import { createFileRoute } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
// Removed authClient, queryClient, redirect imports as auth is handled by layout
import { PodcastListItem, type Podcast } from '@/routes/_protected/podcasts/-components/podcast-list-item'; // Adjusted import path

// Mock data - replace with actual data fetching later
const isLoading = false;
// Using the exported Podcast type
const podcasts: Podcast[] = [
  {
    id: '1', status: 'success', title: 'My First Generated Podcast',
    sourceType: 'Generated from URL', sourceDetail: 'example-finance.com',
    generatedDate: 'Apr 6, 2025', duration: '3:15'
  },
  {
    id: '2', status: 'processing', title: 'Processing Article...',
    sourceType: 'Generated from URL', sourceDetail: 'another-site.com',
    generatedDate: 'Apr 6, 2025'
  },
  {
    id: '3', status: 'failed', title: 'Failed Generation',
    sourceType: 'Generated from URL', sourceDetail: 'broken-link.com',
    generatedDate: 'Apr 5, 2025', errorMessage: 'Could not fetch content.'
  },
];
const handlePlay = (id: string) => console.log('Play clicked for', id);
const handleDelete = (id: string) => console.log('Delete clicked for', id);

// Define the route within the protected layout
export const Route = createFileRoute('/_protected/podcasts/')({
  component: PodcastsPage,
  // Removed beforeLoad - auth is handled by _protected/layout.tsx
});

// Note: Component function name remains PascalCase
function PodcastsPage() {
  const handleGenerateClick = () => {
    console.log('Generate New Podcast clicked');
    // TODO: Implement logic (e.g., open modal or navigate to generate page)
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">My Podcasts</h1>
        <Button
          size="lg"
          className="bg-teal-500 text-white hover:bg-teal-600 font-semibold rounded-lg px-6 py-3"
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
            {/* Ideally use your Spinner component */}
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
            {/* Button is already in header */}
          </div>
        ) : (
          <div className="space-y-4">
            {podcasts.map((podcast) => (
              <PodcastListItem
                key={podcast.id}
                podcast={podcast}
                onPlay={handlePlay}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}