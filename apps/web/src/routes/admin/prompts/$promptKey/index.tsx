import { Alert, AlertDescription, AlertTitle } from '@repo/ui/components/alert'
import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@repo/ui/components/card'
import { Label } from '@repo/ui/components/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/select'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { AlertCircle } from 'lucide-react'
import { useState, useMemo } from 'react'
import { trpc } from '@/router'
import Spinner from '@/routes/-components/common/spinner'

export const Route = createFileRoute('/admin/prompts/$promptKey/')({
  component: PromptByKeyPage,
})

function MetadataItem({ label, value }: { label: string; value: string | undefined | null }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <span className="text-base text-foreground">{value ?? 'N/A'}</span>
    </div>
  )
}

function PromptByKeyPage() {
  const { promptKey } = Route.useParams()
  const navigate = useNavigate()

  const [selectedVersionNumber, setSelectedVersionNumber] = useState<number | undefined>(undefined)

  const versionsQueryOptions = trpc.promptRegistry.getByPromptByKey.queryOptions({ promptKey })
  const {
    data: versionsData,
    isLoading: isLoadingVersions,
    isError: isErrorVersions,
    error: versionsError,
    isSuccess: versionsAreSuccess,
  } = useQuery(versionsQueryOptions)

  const activeVersion = useMemo(
    () => versionsData?.find((v) => v.isActive)?.version,
    [versionsData],
  )

  const versionForApiCall = selectedVersionNumber

  const detailsQueryOptions = trpc.promptRegistry.getDetails.queryOptions(
    { promptKey, version: versionForApiCall || 1},
    {
      enabled: versionsAreSuccess && versionsData !== undefined && versionsData.length > 0,
      staleTime: 5 * 60 * 1000,
    },
  )

  const {
    data: promptDetails,
    isLoading: isLoadingDetails,
    isError: isErrorDetails,
    error: detailsError,
  } = useQuery(detailsQueryOptions)

  const versionOptions = useMemo(
    () => versionsData?.map((v) => v.version).sort((a, b) => b - a) ?? [],
    [versionsData],
  )

  const handleVersionSelect = (value: string) => {
    const num = parseInt(value, 10)
    if (!isNaN(num)) {
      setSelectedVersionNumber(num === activeVersion ? undefined : num)
    }
  }

  const isLoading = isLoadingVersions || (detailsQueryOptions.enabled && isLoadingDetails)

  if (isLoading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (isErrorVersions) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error Loading Prompt Versions</AlertTitle>
        <AlertDescription>
          {versionsError?.message || 'Could not fetch available versions for this prompt.'}
        </AlertDescription>
      </Alert>
    )
  }

  if (!versionsData || versionsData.length === 0) {
    return (
      <Alert variant="default" className="m-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No Versions Found</AlertTitle>
        <AlertDescription>
          There are no versions available for the prompt key "{promptKey}".
        </AlertDescription>
      </Alert>
    )
  }

  if (isErrorDetails) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error Loading Prompt Details</AlertTitle>
        <AlertDescription>
          {detailsError?.message || 'Could not fetch details for the selected prompt version.'}
        </AlertDescription>
      </Alert>
    )
  }

  if (!promptDetails) {
    return (
      <Alert variant="default" className="m-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Prompt Details Not Found</AlertTitle>
        <AlertDescription>
          The details for the selected prompt version could not be found. It might be that no version is active
          or the selected version does not exist.
        </AlertDescription>
      </Alert>
    )
  }

  const displayedVersion = promptDetails.version
  const isViewingActive = promptDetails.isActive

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{promptKey}</h1>
          <p className="text-muted-foreground">
            Viewing Version {displayedVersion} {isViewingActive && `(Active - v${activeVersion})`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isViewingActive && <Badge variant="default">Active</Badge>}
          {versionOptions.length > 1 && (
            <Select
              value={(selectedVersionNumber ?? activeVersion)?.toString() ?? ''}
              onValueChange={handleVersionSelect}
            >
              <SelectTrigger className="w-48 bg-input border-border">
                <SelectValue placeholder="Select version" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {versionOptions.map((v) => (
                  <SelectItem key={v} value={v.toString()}>
                    Version {v} {v === activeVersion ? '(Active)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" onClick={() => navigate({ to: '/admin/prompts' })}>
            Back to List
          </Button>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-xl text-card-foreground">Prompt Configuration</CardTitle>
          <CardDescription>Settings and metadata for version {displayedVersion}.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          <MetadataItem label="Version" value={promptDetails.version.toString()} />
          <MetadataItem label="Temperature" value={promptDetails.temperature.toString()} />
          <MetadataItem label="Max Tokens" value={promptDetails.maxTokens.toString()} />
          <MetadataItem label="Created At" value={new Date(promptDetails.createdAt).toLocaleString()} />
          <MetadataItem label="Created By" value={promptDetails.createdBy} />
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-xl text-card-foreground">System Template</CardTitle>
          <CardDescription>The core template used by the AI model.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="whitespace-pre-wrap rounded-md border border-border bg-background p-4 text-sm font-mono text-foreground overflow-x-auto">
            {promptDetails.template}
          </pre>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-xl text-card-foreground">Input Schema</CardTitle>
            <CardDescription>Expected structure of the input data.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap rounded-md border border-border bg-background p-4 text-sm font-mono text-foreground overflow-x-auto">
              {JSON.stringify(promptDetails.inputSchema, null, 2)}
            </pre>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-xl text-card-foreground">Output Schema</CardTitle>
            <CardDescription>Expected structure of the AI model's output.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap rounded-md border border-border bg-background p-4 text-sm font-mono text-foreground overflow-x-auto">
              {JSON.stringify(promptDetails.outputSchema, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}