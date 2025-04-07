import { Button } from '@repo/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card';
import { Dialog, DialogTrigger } from '@repo/ui/components/dialog';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { GeneratePodcastModal } from './generate-podcast-modal';

export function GeneratePodcastCard() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();

  const handleGenerationSuccess = () => {
    console.log('Podcast generated successfully from GeneratePodcastCard! Redirecting...');
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
            >
              Generate First Podcast
            </Button>
          </DialogTrigger>
          <GeneratePodcastModal
            open={isModalOpen}
            setOpen={setIsModalOpen}
            onSuccess={handleGenerationSuccess}
          />
        </Dialog>
      </CardContent>
    </Card>
  );
} 