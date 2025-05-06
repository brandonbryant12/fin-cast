import { Button } from '@repo/ui/components/button';
import { Dialog, DialogTrigger } from '@repo/ui/components/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAudioPlayer } from '@/contexts/audio-player-context';
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

    const {
        activePodcast,
        closePlayer
    } = useAudioPlayer();

    const podcastsQuery = useQuery(trpc.podcasts.myPodcasts.queryOptions());
    const deletePodcastMutation = useMutation({
        ...(trpc.podcasts.delete.mutationOptions()),
        onSuccess: async (_data, variables) => {
            toast.success('Podcast deleted successfully.');
            if (activePodcast?.id === variables.id) {
                await closePlayer();
            }
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

    const handleGenerationSuccess = () => {
        podcastsQuery.refetch();
    };

    return (
        <div className="space-y-8 pb-24">
            <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
                <h1 className="text-2xl font-bold text-foreground md:text-3xl">My Podcasts</h1>
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogTrigger asChild>
                        <Button
                            size="default"
                            className="w-full md:w-auto bg-primary text-primary-foreground hover:bg-primary-hover font-semibold rounded-lg px-4 py-2 md:px-6 md:py-3 md:text-base"
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

            <div className="rounded-lg border border-border bg-card p-4 md:p-6">
                {podcastsQuery.isLoading ? (
                    <div className="flex justify-center items-center h-40">
                        <Spinner aria-label="Loading podcasts" />
                    </div>
                ) : podcastsQuery.isError ? (
                    <div className="text-center py-10 text-destructive">
                        <h2 className="text-xl font-semibold mb-2">Error Loading Podcasts</h2>
                        <p>{podcastsQuery.error.message || 'Could not fetch your podcasts.'}</p>
                    </div>
                ) : podcastsQuery.data && podcastsQuery.data.length === 0 ? (
                    <div className="text-center py-10 px-4">
                        <h2 className="text-lg md:text-xl font-semibold text-foreground mb-2">No Podcasts Yet</h2>
                        <p className="text-muted-foreground mb-6 text-sm md:text-base">
                            Your generated podcasts will appear here. Click 'Generate New Podcast' to create one.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {podcastsQuery.data?.map((podcast) => (
                            <PodcastListItem
                                key={podcast.id}
                                podcast={podcast}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
