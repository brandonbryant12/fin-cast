import { createFileRoute } from '@tanstack/react-router';
import { authClient } from '@/clients/authClient';
import { HomeIndexComponent } from '@/routes/_protected/home/index';
import { FeaturesSection } from '@/routes/_public/-components/landing/feature-section';
import { HeroSection } from '@/routes/_public/-components/landing/hero-section';


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
    <HomeIndexComponent />
  );
};