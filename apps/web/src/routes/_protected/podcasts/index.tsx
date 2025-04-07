import { Button } from '@repo/ui/components/button';
import { Dialog, DialogTrigger } from '@repo/ui/components/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/router';
import Spinner from '@/routes/-components/common/spinner';
import { GeneratePodcastModal } from '@/routes/_protected/podcasts/-components/generate-podcast-modal';
import { PodcastListItem } from '@/routes/_protected/podcasts/-components/podcast-list-item';

export const Route = createFileRoute('/_protected/podcasts/')({
    component: PodcastsPage,
});

function PodcastsPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const queryClient = useQueryClient();

    const podcastsQuery = useQuery(trpc.podcasts.myPodcasts.queryOptions());

    const deletePodcastMutation = useMutation({
        ...(trpc.podcasts.delete.mutationOptions()),
        onSuccess: () => {
            toast.success('Podcast deleted successfully.');
            queryClient.invalidateQueries({
                queryKey: trpc.podcasts.myPodcasts.queryOptions().queryKey,
            });
        },
        onError: (error) => {
            toast.error('Failed to delete podcast', {
                description: error.message || 'An unexpected error occurred.',
            });
        },
    });

    const handleDelete = (id: string) => {
        deletePodcastMutation.mutate({ id });
    };

    const handlePlay = (id: string) => {
        console.log('Play clicked for', id);
        toast.info('Playback functionality not yet implemented.');
    };

    const handleGenerationSuccess = () => {
        podcastsQuery.refetch();
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-white">My Podcasts</h1>
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogTrigger asChild>
                        <Button
                            size="lg"
                            className="bg-teal-500 text-white hover:bg-teal-600 font-semibold rounded-lg px-6 py-3"
                        >
                            <Plus className="mr-2 h-5 w-5" />
                            Generate New Podcast
                        </Button>
                    </DialogTrigger>
                    <GeneratePodcastModal
                        open={isModalOpen}
                        setOpen={setIsModalOpen}
                        onSuccess={handleGenerationSuccess}
                    />
                </Dialog>
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
                {podcastsQuery.isLoading ? (
                    <div className="flex justify-center items-center h-40">
                        <Spinner aria-label="Loading podcasts" />
                    </div>
                ) : podcastsQuery.isError ? (
                    <div className="text-center py-10 text-red-400">
                        <h2 className="text-xl font-semibold mb-2">Error Loading Podcasts</h2>
                        <p>{podcastsQuery.error.message || 'Could not fetch your podcasts.'}</p>
                    </div>
                ) : podcastsQuery.data && podcastsQuery.data.length === 0 ? (
                    <div className="text-center py-10">
                        <h2 className="text-xl font-semibold text-white mb-2">No Podcasts Yet</h2>
                        <p className="text-gray-300 mb-6">
                            Your generated podcasts will appear here. Click 'Generate New Podcast' to create one.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {podcastsQuery.data?.map((podcast) => (
                            <PodcastListItem
                                key={podcast.id}
                                podcast={podcast as any}
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