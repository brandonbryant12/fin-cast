import { createFileRoute } from '@tanstack/react-router';
import { UnlinkedUserHome } from '@/routes/_protected/home/-components/unlinked-user-home';

export const Route = createFileRoute('/_protected/home/')({
  component: HomeIndexComponent,
});

export function HomeIndexComponent() {
  return <UnlinkedUserHome />;
} 