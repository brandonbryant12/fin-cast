import { createFileRoute } from '@tanstack/react-router';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@repo/ui/components/card';

export const Route = createFileRoute('/_admin/users/')({
  component: AdminUsersPage,
});

function AdminUsersPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin - User Management</CardTitle>
        <CardDescription>View and manage application users.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>User management table or components go here...</p>
        {/* Placeholder for user list/management */}
      </CardContent>
    </Card>
  );
}