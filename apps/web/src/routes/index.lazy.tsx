import { createLazyFileRoute } from '@tanstack/react-router';
import { authClient } from '@/clients/authClient';
import { UnlinkedUserDashboard } from '@/components/dashboard/UnlinkedUserDashboard';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { HeroSection } from '@/components/landing/HeroSection';

// Define the lazy route, providing the component logic here
export const Route = createLazyFileRoute('/')({
  component: IndexComponent, // Use the component defined below
});

// This component now contains the logic originally in index.tsx
function IndexComponent() {
  // Fetch session data within the lazy component
  const { data: session } = authClient.useSession();

  // Render based on session state
  return !session?.user ? (
    <>
      <HeroSection />
      <FeaturesSection />
    </>
  ) : (
    // If logged in, show the dashboard (or relevant logged-in view)
    <UnlinkedUserDashboard />
    // You might eventually replace UnlinkedUserDashboard with a
    // component that shows the actual dashboard for linked users.
  );
}