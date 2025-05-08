import { Alert, AlertDescription, AlertTitle } from '@repo/ui/components/alert'
import { Button } from '@repo/ui/components/button'
import { Label } from '@repo/ui/components/label'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { AlertCircle } from 'lucide-react'
import { useEffect } from 'react'
import { trpc } from '@/router'
import Spinner from '@/routes/-components/common/spinner'

export const Route = createFileRoute('/admin/prompts/$promptKey/')({
  component: PromptKeyRedirectPage,
})

function MetadataItem({ label, value }: { label: string; value: string | undefined | null }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <span className="text-base text-foreground">{value ?? 'N/A'}</span>
    </div>
  )
}

function PromptKeyRedirectPage() {
  const { promptKey } = Route.useParams()
  const navigate = useNavigate()

  const versionsQueryOptions = trpc.promptRegistry.getByPromptByKey.queryOptions({ promptKey })
  const {
    data: versionsData,
    isLoading,
    isError,
    error,
    isSuccess,
  } = useQuery(versionsQueryOptions)

  useEffect(() => {
    if (isSuccess && versionsData) {
      const activeVersion = versionsData.find((v) => v.isActive)
      if (activeVersion) {
        navigate({
          to: '/admin/prompts/$promptKey/$version',
          params: { promptKey, version: activeVersion.version.toString() },
          replace: true, // Replace history entry so back button doesn't lead here
        })
      }
    }
  }, [isSuccess, versionsData, promptKey, navigate])

  if (isLoading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <Spinner />
        <p className="ml-2 text-muted-foreground">Finding active version for "{promptKey}"...</p>
      </div>
    )
  }

  if (isError) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error Loading Prompt Versions</AlertTitle>
        <AlertDescription>
          {error?.message || 'Could not fetch available versions for this prompt.'}
        </AlertDescription>
        <Button variant="outline" onClick={() => navigate({ to: '/admin/prompts' })} className="mt-4">
          Back to Prompts List
        </Button>
      </Alert>
    )
  }

  if (isSuccess && (!versionsData || versionsData.length === 0)) {
    return (
      <Alert variant="default" className="m-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No Versions Found</AlertTitle>
        <AlertDescription>
          There are no versions available for the prompt key "{promptKey}".
        </AlertDescription>
        <Button variant="outline" onClick={() => navigate({ to: '/admin/prompts' })} className="mt-4">
          Back to Prompts List
        </Button>
      </Alert>
    )
  }
  
  if (isSuccess && versionsData && !versionsData.find((v) => v.isActive)) {
    return (
      <Alert variant="default" className="m-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No Active Version</AlertTitle>
        <AlertDescription>
          The prompt "{promptKey}" does not have an active version set.
          You can set an active version by navigating to one of its specific versions.
          {/* TODO: Optionally, list versions here with links if that's desired user flow */}
        </AlertDescription>
        <Button variant="outline" onClick={() => navigate({ to: '/admin/prompts' })} className="mt-4">
          Back to Prompts List
        </Button>
        {/* A button to go to the latest version might be helpful too */} 
        {versionsData && versionsData.length > 0 && (() => {
            const latestVersion = versionsData.sort((a,b) => b.version - a.version)[0];
            if (!latestVersion) return null; // Guard against undefined latestVersion
            return (
                <Button 
                    variant="secondary" 
                    onClick={() => {
                        navigate({ 
                            to: '/admin/prompts/$promptKey/$version',
                            params: { promptKey, version: latestVersion.version.toString() }
                        });
                    }}
                    className="mt-2 ml-2"
                >
                    Go to Latest Version (v{latestVersion.version})
                </Button>
            );
        })()}
      </Alert>
    )
  }

  return (
    <div className="flex h-64 w-full items-center justify-center">
      <p className="text-muted-foreground">Processing prompt "{promptKey}"...</p>
    </div>
  )
}