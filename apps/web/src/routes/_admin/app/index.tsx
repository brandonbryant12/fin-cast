import { createFileRoute } from '@tanstack/react-router';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@repo/ui/components/card';

export const Route = createFileRoute('/_admin/app/')({
  component: AdminAppPage,
});

function AdminAppPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin - App Management</CardTitle>
        <CardDescription>Manage application-wide settings and configurations.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>App management content goes here...</p>
        {/* Placeholder for future settings */}
      </CardContent>
    </Card>
  );
}