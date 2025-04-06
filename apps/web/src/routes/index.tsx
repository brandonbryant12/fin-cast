import { Button } from '@repo/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@repo/ui/components/dialog';
import { createFileRoute } from '@tanstack/react-router';
import { authClient } from '@/clients/authClient';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { HeroSection } from '@/components/landing/HeroSection';

export const Route = createFileRoute('/')({
  component: RouteComponent,
});

function RouteComponent() {
  const { data: session } = authClient.useSession();

  return !session?.user ? (
    <>
      <HeroSection />
      <FeaturesSection />
    </>
  ) : (
    <div className="container mx-auto flex flex-col items-center px-4 py-16 md:py-24">
      <h1 className="mb-2 text-center text-4xl font-bold text-white md:text-5xl lg:text-6xl">
        Welcome to Fincast!
      </h1>
      <p className="mb-12 text-center text-lg text-gray-300 md:text-xl">
        Let's get your financial audio experience started.
      </p>

      {/* Section 1: Available Action */}
      <Card className="w-full max-w-md border-slate-700 bg-slate-800 text-white">
        <CardHeader className="flex flex-row items-center gap-4">
          <span className="text-2xl">🎤</span> {/* Placeholder Icon */}
          <div>
            <CardTitle className="text-white">
              Create a Manual Financial Note
            </CardTitle>
            <CardDescription className="text-gray-300">
              Record a quick audio update about your financial thoughts, goals,
              or market observations.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Button
            size="lg"
            className="w-full bg-[#14B8A6] px-8 py-3 text-white hover:bg-[#0D9488]"
          >
            Create Your First Note
          </Button>
        </CardContent>
      </Card>

      {/* Section 2: Teaser & Call to Action for Linking Accounts */}
      <div className="mt-16 w-full max-w-4xl text-center">
        <h2 className="mb-2 text-3xl font-bold text-white md:text-4xl">
          Unlock Personalized Insights & Automation
        </h2>
        <p className="mb-8 text-lg text-gray-300 md:text-xl">
          Connect your accounts securely to access these powerful features:
        </p>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Locked Card 1 */}
          <Card className="border-slate-700 bg-slate-800 text-white opacity-75">
            <CardHeader>
              <div className="mb-2 text-2xl">🎧🔒</div> {/* Placeholder Icons */}
              <CardTitle className="text-base text-white">
                Smart Financial Podcasts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm text-gray-400">
                Get personalized audio reports generated automatically from your
                connected brokerage accounts.
              </CardDescription>
            </CardContent>
          </Card>

          {/* Locked Card 2 */}
          <Card className="border-slate-700 bg-slate-800 text-white opacity-75">
            <CardHeader>
              <div className="mb-2 text-2xl">📊🔒</div> {/* Placeholder Icons */}
              <CardTitle className="text-base text-white">
                Weekly Audio Briefings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm text-gray-400">
                Receive automated audio summaries of your portfolio's weekly
                performance once accounts are linked.
              </CardDescription>
            </CardContent>
          </Card>

          {/* Locked Card 3 */}
          <Card className="border-slate-700 bg-slate-800 text-white opacity-75">
            <CardHeader>
              <div className="mb-2 text-2xl">💬🔒</div> {/* Placeholder Icons */}
              <CardTitle className="text-base text-white">
                Conversational AI
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm text-gray-400">
                Ask questions like "How's my portfolio doing?" and get answers
                based on your connected data.
              </CardDescription>
            </CardContent>
          </Card>

          {/* Locked Card 4 */}
          <Card className="border-slate-700 bg-slate-800 text-white opacity-75">
            <CardHeader>
              <div className="mb-2 text-2xl">🔊🔒</div> {/* Placeholder Icons */}
              <CardTitle className="text-base text-white">
                Voice-First Dashboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm text-gray-400">
                Navigate and manage your linked finances using simple voice
                commands.
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Primary Call to Action */}
        <div className="mt-12">
          <p className="mb-4 text-lg text-gray-300">
            Ready to unlock the full experience?
          </p>
          <Dialog>
            <DialogTrigger asChild>
              <Button
                size="lg"
                className="bg-[#14B8A6] px-10 py-4 text-lg font-semibold text-white hover:bg-[#0D9488]"
              >
                Connect Your Accounts Securely
              </Button>
            </DialogTrigger>
            <DialogContent className="border-slate-700 bg-slate-800 text-white">
              <DialogHeader>
                <DialogTitle className="text-center text-2xl text-white">
                  Coming Soon! 🚧🛠️
                </DialogTitle>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
