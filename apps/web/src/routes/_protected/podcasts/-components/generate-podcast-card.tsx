import { Button } from '@repo/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card';

export function GeneratePodcastCard() {
  return (
    <Card className="w-full max-w-md border-border bg-card text-card-foreground">
      <CardHeader className="flex flex-row items-center gap-4">
        <span className="text-2xl">📰</span> {/* Updated Placeholder Icon */}
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
        {/* TODO: Add URL Input Field Here */}
        <Button
          size="lg"
          className="mt-4 w-full bg-primary px-8 py-3 text-primary-foreground hover:bg-primary-hover"
        >
          Generate First Podcast
        </Button>
      </CardContent>
    </Card>
  );
} 