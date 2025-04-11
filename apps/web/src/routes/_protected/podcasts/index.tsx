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
        isPlaying,
        loadTrack,
        play,
        pause,
        closePlayer
    } = useAudioPlayer();

    const podcastsQuery = useQuery(trpc.podcasts.myPodcasts.queryOptions());
    const availableVoicesQuery = useQuery(trpc.tts.getAvailablePersonalities.queryOptions());
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

    const handlePlay = (id: string) => {
        const podcast = podcastsQuery.data?.find(p => p.id === id);

        if (!podcast || podcast.status !== 'success' || !podcast.audioUrl) {
            let description = 'Audio is unavailable or data is missing.';
            if (podcast?.status === 'processing') {
                description = 'Podcast is still processing.';
            } else if (podcast?.status === 'failed') {
                description = 'Podcast generation failed.';
            }
            toast.error('Cannot play podcast', { description });
            console.warn('Attempted to play invalid podcast:', podcast);
            return;
        }

        if (!podcast.audioUrl.startsWith('data:audio/')) {
            toast.error('Invalid audio format.', {
                description: 'The audio data for this podcast is not in a playable format.',
            });
            console.warn('Attempted to play podcast with non-data URL:', podcast);
            return;
        }

        if (activePodcast?.id === id) {
            if (isPlaying) {
                pause();
            } else {
                play();
            }
        } else {
            loadTrack({
                id: podcast.id,
                audioUrl: podcast.audioUrl,
                title: podcast.title || 'Untitled Podcast',
            });
        }
    };

    const handleGenerationSuccess = () => {
        podcastsQuery.refetch();
    };

    return (
        <div className="space-y-8 pb-24">
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
                        availableVoices={availableVoicesQuery.data}
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
                                podcast={podcast}
                                onPlay={handlePlay}
                                onDelete={handleDelete}
                                isPlaying={isPlaying && activePodcast?.id === podcast.id}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}