import { Button } from '@repo/ui/components/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@repo/ui/components/card';
import { Dialog, DialogTrigger } from '@repo/ui/components/dialog';
import { useQuery } from '@tanstack/react-query'; // Import useQuery
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { GeneratePodcastModal } from './generate-podcast-modal';
import { trpc } from '@/router'; // Import trpc
import Spinner from '@/routes/-components/common/spinner'; // Import Spinner

export function GeneratePodcastCard() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const navigate = useNavigate();

    const availableVoicesQuery = useQuery(trpc.tts.getAvailablePersonalities.queryOptions(
        undefined,
        {
            staleTime: Infinity, 
        }
    ));

    const handleGenerationSuccess = () => {
        navigate({ to: '/podcasts' });
    };

    return (
        <Card className="w-full max-w-md border-border bg-card text-card-foreground">
            <CardHeader className="flex flex-row items-center gap-4">
                <span className="text-2xl">📰</span>
                <div>
                    <CardTitle className="text-card-foreground">
                        Generate Podcast from Article URL
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                        Paste a link to a financial article and we'll create an audio
                        summary podcast for you.
                    </CardDescription>
                </div>
            </CardHeader>
            <CardContent>
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogTrigger asChild>
                        <Button
                            size="lg"
                            className="mt-4 w-full bg-primary px-8 py-3 text-primary-foreground hover:bg-primary-hover"
                            // Optionally disable button while voices load/error
                            disabled={availableVoicesQuery.isLoading || availableVoicesQuery.isError}
                        >
                            {availableVoicesQuery.isLoading ? <Spinner className="mr-2" /> : null}
                            {availableVoicesQuery.isError ? 'Error loading voices' : 'Generate First Podcast'}
                        </Button>
                    </DialogTrigger>
                    {/* Pass the fetched query result and loading/error states down */}
                    <GeneratePodcastModal
                        open={isModalOpen}
                        setOpen={setIsModalOpen}
                        onSuccess={handleGenerationSuccess}
                        availableVoices={availableVoicesQuery.data} // Pass the prop
                        isLoadingVoices={availableVoicesQuery.isLoading} // Pass loading state
                        voicesError={availableVoicesQuery.error} // Pass error state
                    />
                </Dialog>
            </CardContent>
        </Card>
    );
}