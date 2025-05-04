import { createFileRoute } from '@tanstack/react-router';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@repo/ui/components/card';

export const Route = createFileRoute('/_admin/reviews/')({
  component: AdminReviewsPage,
});

function AdminReviewsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin - Review Management</CardTitle>
        <CardDescription>View and manage user reviews.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Review management components go here...</p>
        {/* Placeholder for review list/management */}
      </CardContent>
    </Card>
  );
}