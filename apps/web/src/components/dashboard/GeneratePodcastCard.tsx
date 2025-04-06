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
    <Card className="w-full max-w-md border-slate-700 bg-slate-800 text-white">
      <CardHeader className="flex flex-row items-center gap-4">
        <span className="text-2xl">📰</span> {/* Updated Placeholder Icon */}
        <div>
          <CardTitle className="text-white">
            Generate Podcast from Article URL
          </CardTitle>
          <CardDescription className="text-gray-300">
            Paste a link to a financial article and we'll create an audio
            summary podcast for you.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {/* TODO: Add URL Input Field Here */}
        <Button
          size="lg"
          className="mt-4 w-full bg-[#14B8A6] px-8 py-3 text-white hover:bg-[#0D9488]"
        >
          Generate First Podcast
        </Button>
      </CardContent>
    </Card>
  );
} 