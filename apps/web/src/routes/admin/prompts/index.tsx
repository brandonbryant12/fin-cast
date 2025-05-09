import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@repo/ui/components/card';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { trpc } from '@/router';
import Spinner from '@/routes/-components/common/spinner';

export const Route = createFileRoute('/admin/prompts/')({
  component: AdminPromptsPage,
});


function AdminPromptsPage() {
  const { data: promptsData, isLoading, isError, error } = useQuery(trpc.promptRegistry.listAll.queryOptions())
  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin - Prompt Management</CardTitle>
        <CardDescription>View and manage system AI prompts. Click a prompt to see details and versions.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <div className="flex justify-center p-8"><Spinner/></div>}
        {isError && <p className="text-destructive">Error loading prompts: {error?.message}</p>}
        
        {/* Handle case where data is loaded but no prompts exist */}
        {!isLoading && !isError && promptsData && promptsData.length === 0 && (
          <p className="text-muted-foreground">No prompts found.</p>
        )}

        {/* Map over promptsData if it exists and has items */}
        {!isLoading && !isError && promptsData && promptsData.length > 0 && promptsData.map((prompt) => (
          <Link
            key={prompt.promptKey}
            to="/admin/prompts/$promptKey"
            params={{ promptKey: prompt.promptKey }}
            className="block hover:bg-muted/50 transition-colors rounded-lg"
          >
            <Card className="bg-card hover:shadow-md">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-xl font-semibold">{prompt.promptKey}</CardTitle>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}