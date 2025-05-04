import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_admin/')({
  beforeLoad: () => {
    // Redirect from the base admin route to the app management page by default
    throw redirect({
      to: '/admin/app',
      // You can add search params or state if needed
    });
  },
  // No component needed as it always redirects
});