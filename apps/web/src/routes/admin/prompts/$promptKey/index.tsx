import { Alert, AlertDescription, AlertTitle } from '@repo/ui/components/alert'
import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@repo/ui/components/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog'
import { Input } from '@repo/ui/components/input'
import { Label } from '@repo/ui/components/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/select'
import { Textarea } from '@repo/ui/components/textarea'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { AlertCircle } from 'lucide-react'
import { useState, useMemo, useEffect, useRef } from 'react'
import { toast } from 'sonner';
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
  const queryClient = useQueryClient()

  // Helper to get the path part of the query key for getDetails
  // We use dummy values for input as we only care about the path segment (e.g., ['promptRegistry', 'getDetails'])
  const getDetailsPathKey = trpc.promptRegistry.getDetails.queryOptions({
    promptKey: '',
    version: 0,
  }).queryKey[0];

  const [selectedVersionNumber, setSelectedVersionNumber] = useState<number | undefined>(undefined)
  const [isEditing, setIsEditing] = useState(false)
  const [draftTemperature, setDraftTemperature] = useState<number | undefined>(undefined)
  const [draftMaxTokens, setDraftMaxTokens] = useState<number | undefined>(undefined)
  const [draftTemplate, setDraftTemplate] = useState<string>('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

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

  const detailsQueryOptions = trpc.promptRegistry.getDetails.queryOptions(
    { promptKey, version: selectedVersionNumber || activeVersion || 1 },
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

  const createVersionMutation = useMutation({
    ...trpc.promptRegistry.createNewVersion.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: versionsQueryOptions.queryKey })
      queryClient.invalidateQueries({ queryKey: detailsQueryOptions.queryKey })
      setIsEditing(false)
      setSelectedVersionNumber(undefined)
      toast.success('New version published!', {
        description: 'The new prompt version is now active.',
      });
    },
    onError: (error) => {
      toast.error('Failed to publish new version', {
        description: error.message || 'An unexpected error occurred.',
      });
    }
  })

  const setActiveMutation = useMutation({
    ...trpc.promptRegistry.setActive.mutationOptions(),
    onSuccess: () => {
      toast.success('Version set as active!', {
        description: 'This version is now the active prompt. Page will reload.',
      });
      window.location.reload();
    },
    onError: (error) => {
      toast.error('Failed to set active version', {
        description: error.message || 'An unexpected error occurred.',
      });
    },
  });

  useEffect(() => {
    if (promptDetails && !isEditing) {
      setDraftTemperature(promptDetails.temperature)
      setDraftMaxTokens(promptDetails.maxTokens)
      setDraftTemplate(promptDetails.template)
    }
  }, [promptDetails, isEditing])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [draftTemplate, isEditing]);

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

  const startEdit = () => setIsEditing(true)

  const cancelEdit = () => setIsEditing(false)

  const saveEdit = () => {
    if (!draftTemperature || !draftMaxTokens || !draftTemplate) {
      toast.error('Missing Fields', { description: 'Please fill in temperature, max tokens, and the template.'});
      return;
    }
    setIsConfirmModalOpen(true);
  }

  const handleConfirmPublish = () => {
    if (!draftTemperature || !draftMaxTokens || !draftTemplate) {
      toast.error('Missing Fields', { description: 'Please fill in temperature, max tokens, and the template.'});
      return;
    }
    createVersionMutation.mutate(
      {
        promptKey,
        template: draftTemplate,
        temperature: draftTemperature,
        maxTokens: draftMaxTokens
      }
    )
    setIsConfirmModalOpen(false);
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
          <Button
            variant="outline"
            onClick={() => setSelectedVersionNumber(undefined)}
            disabled={isViewingActive}
          >
            Go to active version
          </Button>
          {!isEditing && (
            <Button variant="outline" onClick={startEdit}>
              Edit
            </Button>
          )}
          {promptDetails && !isViewingActive && !isEditing && (
            <Button
              variant="default"
              onClick={() => {
                setActiveMutation.mutate({
                  promptKey,
                  version: promptDetails.version,
                });
              }}
              disabled={setActiveMutation.isPending}
            >
              {setActiveMutation.isPending ? <Spinner className="mr-2 h-4 w-4" /> : 'Set as Active'}
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate({ to: '/admin/prompts' })}>
            Back to List
          </Button>
        </div>
      </div>

      {isEditing && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-xl text-card-foreground">Edit and publish new version</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="temperature" className="text-sm text-muted-foreground">Temperature</Label>
                <Input id="temperature" type="number" value={draftTemperature?.toString() ?? ''} onChange={e => setDraftTemperature(parseFloat(e.target.value))} className="bg-input" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="maxTokens" className="text-sm text-muted-foreground">Max Tokens</Label>
                <Input id="maxTokens" type="number" value={draftMaxTokens?.toString() ?? ''} onChange={e => setDraftMaxTokens(parseInt(e.target.value, 10))} className="bg-input" />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="template" className="text-sm text-muted-foreground">System Template</Label>
              <Textarea
                id="template"
                ref={textareaRef}
                value={draftTemplate}
                onChange={e => setDraftTemplate(e.target.value)}
                className="bg-input"
                style={{ overflowY: 'hidden' }}
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={cancelEdit}>Cancel</Button>
              <Button variant="default" onClick={saveEdit} disabled={createVersionMutation.isPending}>Save & publish</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Modal */}
      <Dialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl text-card-foreground">Confirm Publish</DialogTitle>
            <DialogDescription className="text-center text-muted-foreground pt-2">
              This will become the new active system prompt.
              <br />
              Are you sure?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4 justify-center">
            <Button variant="outline" onClick={() => setIsConfirmModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="default" onClick={handleConfirmPublish} disabled={createVersionMutation.isPending}>
              {createVersionMutation.isPending ? <Spinner className="mr-2" /> : 'Confirm & Publish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!isEditing && (
        <>
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
              <MetadataItem 
                label="Created By" 
                value={promptDetails.creatorName || promptDetails.creatorEmail || promptDetails.createdBy || 'N/A'} 
              />
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
        </>
      )}
    </div>
  )
}