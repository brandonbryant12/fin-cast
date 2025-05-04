import { createFileRoute } from '@tanstack/react-router';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@repo/ui/components/card';

export const Route = createFileRoute('/admin/prompts/')({
  component: AdminPromptsPage,
});

function AdminPromptsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin - Prompt Management</CardTitle>
        <CardDescription>Manage AI prompts and configurations.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Prompt management components go here...</p>
        {/* Placeholder for prompt list/management */}
      </CardContent>
    </Card>
  );
}