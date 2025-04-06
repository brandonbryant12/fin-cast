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
    </div>
  );
}
