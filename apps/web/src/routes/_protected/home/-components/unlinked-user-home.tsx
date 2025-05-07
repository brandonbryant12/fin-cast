import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card';
// Removed Lucide icon imports as we are using emojis
import { GeneratePodcastCard } from './generate-podcast-card';
import { env } from '@/env';


 export function UnlinkedUserHome() {

  // Helper component for the themed diagonal banner
  const ComingSoonBanner = () => (
    <div
        className="absolute top-0 right-0 w-24 h-24 overflow-hidden pointer-events-none" // Container for rotation pivot
        aria-hidden="true"
     >
        {/* Adjusted top/right values to shift text slightly from corner */}
        <div
          className="absolute -right-[25px] top-[30px] w-[150px] transform rotate-45
                     bg-caution text-caution-foreground
                     py-1 px-1 text-center shadow-md"
        >
          <span className="text-[10px] font-bold uppercase tracking-wider block">
              Coming Soon
          </span>
        </div>
      </div>
  );

    return (
     <div className="container mx-auto flex flex-col items-center px-4 py-16 md:py-24">
      <h1 className="mb-2 text-center text-4xl font-bold text-foreground md:text-5xl lg:text-6xl">
       Welcome to {env.PUBLIC_APP_NAME}!
      </h1>
      <p className="mb-12 text-center text-lg text-muted-foreground md:text-xl">
       Transform financial articles into engaging audio podcasts.
      </p>

      {/* Section 1: Available Action - Generate Podcast */}
      <div className="flex justify-center w-full mb-16">
        <GeneratePodcastCard />
      </div>


      {/* Section 2: Key Features (1 Active, 3 Coming Soon) */}
      <div className="w-full max-w-5xl text-center">
        <h2 className="mb-8 text-3xl font-bold text-foreground md:text-4xl">
          Key Features
        </h2>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Smart Financial Podcasts (ACTIVE) */}
          <Card className="border-border bg-card text-card-foreground h-full flex flex-col">
            <CardHeader className="flex-shrink-0">
              {/* Using emoji as per original code */}
              <div className="mb-2 text-3xl mx-auto">🎧</div>
              <CardTitle className="text-base text-card-foreground">
                Smart Financial Podcasts
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-grow">
              <CardDescription className="text-sm text-muted-foreground">
                Generate personalized audio reports automatically from article URLs. Use the card above to start!
              </CardDescription>
            </CardContent>
          </Card>

          {/* Card 2: Weekly Audio Briefings (Coming Soon) */}
          <Card className="relative border-border bg-card text-card-foreground overflow-hidden h-full flex flex-col">
             <ComingSoonBanner />
             {/* Muted content appearance */}
             <div className="opacity-60 flex-grow flex flex-col">
                <CardHeader className="flex-shrink-0">
                   {/* Using emoji as per original code */}
                  <div className="mb-2 text-3xl mx-auto">📊</div>
                  <CardTitle className="text-base text-card-foreground">
                    Weekly Audio Briefings
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-grow">
                  <CardDescription className="text-sm text-muted-foreground">
                    Receive automated audio summaries of your portfolio's weekly performance
                  </CardDescription>
                </CardContent>
            </div>
          </Card>

          {/* Card 3: Conversational AI (Coming Soon) */}
          <Card className="relative border-border bg-card text-card-foreground overflow-hidden h-full flex flex-col">
            <ComingSoonBanner />
            <div className="opacity-60 flex-grow flex flex-col">
                <CardHeader className="flex-shrink-0">
                   {/* Using emoji as per original code */}
                  <div className="mb-2 text-3xl mx-auto">💬</div>
                  <CardTitle className="text-base text-card-foreground">
                    Conversational AI
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-grow">
                  <CardDescription className="text-sm text-muted-foreground">
                    Ask questions about your connected financial data and get intelligent audio responses.
                  </CardDescription>
                </CardContent>
            </div>
          </Card>

          {/* Card 4: Voice-First Dashboard (Coming Soon) */}
          <Card className="relative border-border bg-card text-card-foreground overflow-hidden h-full flex flex-col">
            <ComingSoonBanner />
             <div className="opacity-60 flex-grow flex flex-col">
                <CardHeader className="flex-shrink-0">
                   {/* Using emoji as per original code */}
                  <div className="mb-2 text-3xl mx-auto">🔊</div>
                  <CardTitle className="text-base text-card-foreground">
                    Voice-First Dashboard
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-grow">
                  <CardDescription className="text-sm text-muted-foreground">
                    Navigate and manage your linked finances using simple voice commands.
                  </CardDescription>
                </CardContent>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
 }