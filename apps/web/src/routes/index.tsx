import { Link2Icon } from '@radix-ui/react-icons';
import { createFileRoute, Link } from '@tanstack/react-router';
import { authClient } from '@/clients/authClient';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { HeroSection } from '@/components/landing/HeroSection';
import { postsLinkOptions } from '@/validations/posts-link-options';

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
    <div className="flex flex-col">
      <div>
        Welcome, <span className="font-bold">{session.user.name}</span>!
      </div>
      <div className="mt-3 flex gap-x-1.5">
        Click{' '}
        <Link
          {...postsLinkOptions}
          className="flex items-center gap-x-1 text-blue-500 underline"
        >
          here <Link2Icon className="mt-0.5" />
        </Link>{' '}
        to view your posts.
      </div>
      <div className="mt-3">
        For the source code, see{' '}
        <a
          className="text-blue-500 underline"
          target="_blank"
          href="https://github.com/nktnet1/rt-stack"
          rel="noreferrer"
        >
          RT Stack on GitHub
        </a>
        .
      </div>
    </div>
  );
}
