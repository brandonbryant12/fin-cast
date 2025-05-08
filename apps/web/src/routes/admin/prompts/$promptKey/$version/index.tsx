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

export const Route = createFileRoute('/admin/prompts/$promptKey/$version/')({
  component: PromptVersionPage,
})

function MetadataItem({ label, value }: { label: string; value: string | undefined | null }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <span className="text-base text-foreground">{value ?? 'N/A'}</span>
    </div>
  )
}

function PromptVersionPage() {
  const { promptKey, version: versionString } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const version = parseInt(versionString, 10);
  const [isEditing, setIsEditing] = useState(false)
  const [draftTemperature, setDraftTemperature] = useState<number | undefined>(undefined)
  const [draftMaxTokens, setDraftMaxTokens] = useState<number | undefined>(undefined)
  const [draftTemplate, setDraftTemplate] = useState<string>('')
  const [draftSystemPrompt, setDraftSystemPrompt] = useState<string>('')
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

  const activeVersionNumber = useMemo(
    () => versionsData?.find((v) => v.isActive)?.version,
    [versionsData],
  )

  const versionOptionsList = useMemo(
    () => versionsData?.map((v) => v.version).sort((a, b) => b - a) ?? [],
    [versionsData],
  )

  const detailsQueryOptions = trpc.promptRegistry.getDetails.queryOptions(
    { promptKey, version },
    {
      enabled: !isNaN(version) && versionsAreSuccess && versionsData !== undefined && versionsData.length > 0,
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
    onSuccess: ({ newVersion }) => {
      queryClient.invalidateQueries({ queryKey: versionsQueryOptions.queryKey });
      setIsEditing(false);
      setDraftSystemPrompt('');
      setDraftTemplate('');

      toast.success('New version published!', {
        description: 'Redirecting to the new active version...',
      });

      const newVersionString = newVersion.version.toString()
      navigate({
        to: `/admin/prompts/$promptKey/${newVersionString}`,
        params: { promptKey },
        replace: true,
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
        description: 'This version is now the active prompt. Page will reload or re-fetch.',
      });
      queryClient.invalidateQueries({ queryKey: versionsQueryOptions.queryKey });
      queryClient.invalidateQueries({ queryKey: detailsQueryOptions.queryKey });
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
      setDraftSystemPrompt(promptDetails.systemPrompt)
    }
  }, [promptDetails, isEditing])

  useEffect(() => {
    if (textareaRef.current && isEditing) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [draftTemplate, isEditing]);

  const startEdit = () => {
    if (promptDetails) {
        setDraftTemperature(promptDetails.temperature)
        setDraftMaxTokens(promptDetails.maxTokens)
        setDraftTemplate(promptDetails.template)
        setDraftSystemPrompt(promptDetails.systemPrompt)
    }
    setIsEditing(true)
  }

  const cancelEdit = () => setIsEditing(false)

  const saveEdit = () => {
    if (!draftSystemPrompt || draftTemperature === undefined || draftMaxTokens === undefined || !draftTemplate) {
      toast.error('Missing Fields', { description: 'Please fill in system prompt, temperature, max tokens, and the template.'});
      return;
    }
    setIsConfirmModalOpen(true);
  }

  const handleConfirmPublish = () => {
    if (!draftSystemPrompt || draftTemperature === undefined || draftMaxTokens === undefined || !draftTemplate) {
      toast.error('Missing Fields', { description: 'Please fill in system prompt, temperature, max tokens, and the template.'});
      return;
    }
    createVersionMutation.mutate(
      {
        promptKey,
        template: draftTemplate,
        systemPrompt: draftSystemPrompt,
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
   if (isNaN(version)) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Invalid Version</AlertTitle>
        <AlertDescription>
          The version specified in the URL is not a valid number.
        </AlertDescription>
        <Button onClick={() => navigate({ to: '/admin/prompts/$promptKey', params: { promptKey }})} className="mt-2">
            Back to Prompt Overview
        </Button>
      </Alert>
    );
  }

  if (isErrorVersions) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error Loading Prompt Versions Context</AlertTitle>
        <AlertDescription>
          {versionsError?.message || 'Could not fetch available versions for this prompt to determine context (e.g. active version).'}
        </AlertDescription>
      </Alert>
    )
  }

  if (isErrorDetails) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error Loading Prompt Details for Version {version}</AlertTitle>
        <AlertDescription>
          {detailsError?.message || `Could not fetch details for version ${version}.`}
        </AlertDescription>
      </Alert>
    )
  }

  if (!promptDetails) {
    return (
      <Alert variant="default" className="m-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Prompt Version Not Found</AlertTitle>
        <AlertDescription>
          Details for prompt "{promptKey}" version {version} could not be found.
          It might not exist, or an error occurred.
        </AlertDescription>
         <Button onClick={() => navigate({ to: '/admin/prompts/$promptKey', params: { promptKey }})} className="mt-2">
            Back to Prompt Overview
        </Button>
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
            Viewing Version {displayedVersion}
            {isViewingActive && ` (Active)`}
            {!isViewingActive && activeVersionNumber && ` (Current active is v${activeVersionNumber})`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isViewingActive && <Badge variant="default">Active Version</Badge>}
          {/* Re-added Version Select dropdown */}
          {versionOptionsList.length > 1 && (
            <Select
              value={displayedVersion.toString()}
              onValueChange={(selectedVersionValue) => 
                navigate({
                  to: '/admin/prompts/$promptKey/$version',
                  params: { promptKey, version: selectedVersionValue },
                  replace: true,
                })
              }
            >
              <SelectTrigger className="w-48 bg-input border-border">
                <SelectValue placeholder="Switch version" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {versionOptionsList.map((vNum) => (
                  <SelectItem key={vNum} value={vNum.toString()}>
                    Version {vNum} {vNum === activeVersionNumber ? '(Active)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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
              {setActiveMutation.isPending ? <Spinner className="mr-2 h-4 w-4" /> : 'Set this Version as Active'}
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate({ to: '/admin/prompts' })}>
            Back Prompts
          </Button>
        </div>
      </div>

      <Dialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl text-card-foreground">Confirm Publish New Version</DialogTitle>
            <DialogDescription className="text-center text-muted-foreground pt-2">
              This will create a NEW active version based on your edits.
              <br />
              The current version {displayedVersion} will remain unchanged.
              Are you sure?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4 justify-center">
            <Button variant="outline" onClick={() => setIsConfirmModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="default" onClick={handleConfirmPublish} disabled={createVersionMutation.isPending}>
              {createVersionMutation.isPending ? <Spinner className="mr-2" /> : 'Confirm & Publish New'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!isEditing && (
        <>
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-xl text-card-foreground">Prompt Configuration (Version {displayedVersion})</CardTitle>
              <CardDescription>Settings and metadata for this version.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MetadataItem label="Temperature" value={promptDetails.temperature.toString()} />
              <MetadataItem label="Max Tokens" value={promptDetails.maxTokens.toString()} />
              <MetadataItem label="Version" value={promptDetails.version.toString()} />
              <MetadataItem label="Created At" value={new Date(promptDetails.createdAt).toLocaleString()} />
              <MetadataItem label="Created By" value={promptDetails.creatorName || promptDetails.creatorEmail || promptDetails.createdBy || 'N/A'} />
               <MetadataItem label="Is Active" value={promptDetails.isActive ? 'Yes' : 'No'} />
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-xl text-card-foreground">System Prompt</CardTitle>
              <CardDescription>The guiding prompt for the AI model for version {displayedVersion}.</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap rounded-md border border-border bg-background p-4 text-sm font-mono text-foreground overflow-x-auto">
                {promptDetails.systemPrompt}
              </pre>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-xl text-card-foreground">Input Schema</CardTitle>
                <CardDescription>These values are available as Handlebars variables like {`{{"hostName"}}`} in the template.</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap rounded-md border border-border bg-background p-4 text-sm font-mono text-foreground overflow-x-auto">
                  {JSON.stringify(promptDetails.inputSchema, null, 2)}
                </pre>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-xl text-card-foreground">Template</CardTitle>
                <CardDescription>The prompt body for version {displayedVersion}.</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap rounded-md border border-border bg-background p-4 text-sm font-mono text-foreground overflow-x-auto">
                  {promptDetails.template}
                </pre>
              </CardContent>
            </Card>
          </div>
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
        </>
      )}
      {isEditing && (
        <div className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-xl text-card-foreground">Edit Prompt (based on Version {displayedVersion})</CardTitle>
              <CardDescription>
                You are editing the content based on version {displayedVersion}.
                Saving will publish a NEW version and set it as active.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="temperature" className="text-sm text-muted-foreground">Temperature</Label>
                <Input id="temperature" type="number" value={draftTemperature?.toString() ?? ''} onChange={e => setDraftTemperature(parseFloat(e.target.value))} className="bg-input"/>
              </div>
              <div className="space-y-1">
                <Label htmlFor="maxTokens" className="text-sm text-muted-foreground">Max Tokens</Label>
                <Input id="maxTokens" type="number" value={draftMaxTokens?.toString() ?? ''} onChange={e => setDraftMaxTokens(parseInt(e.target.value, 10))} className="bg-input"/>
              </div>
              {/* Displaying these as metadata during edit */}
              <MetadataItem label="Base Version" value={promptDetails.version.toString()} />
              <MetadataItem label="Base Created At" value={new Date(promptDetails.createdAt).toLocaleString()} />
              <MetadataItem label="Base Created By" value={promptDetails.creatorName || promptDetails.creatorEmail || promptDetails.createdBy || 'N/A'} />
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-xl text-card-foreground">System Prompt (Edit)</CardTitle>
              <CardDescription>The guiding prompt for the AI model.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                id="systemPrompt"
                className="bg-input min-h-[150px] font-mono text-sm"
                value={draftSystemPrompt}
                onChange={e => setDraftSystemPrompt(e.target.value)}
              />
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-xl text-card-foreground">Input Schema (View Only)</CardTitle>
              <CardDescription>These values are available as Handlebars variables like {`{{"hostName"}}`} in the template.</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap rounded-md border border-border bg-background p-4 text-sm font-mono text-foreground overflow-x-auto">
                {JSON.stringify(promptDetails.inputSchema, null, 2)}
              </pre>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-xl text-card-foreground">Template (Edit)</CardTitle>
              <CardDescription>The prompt body rendered with Handlebars. Use {`{{"variable"}}`} for inputs.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                id="template"
                ref={textareaRef}
                className="bg-input font-mono text-sm"
                value={draftTemplate}
                onChange={e => setDraftTemplate(e.target.value)}
                style={{ overflowY: 'hidden' }}
              />
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-xl text-card-foreground">Output Schema (View Only)</CardTitle>
              <CardDescription>Expected structure of the AI model's output.</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap rounded-md border border-border bg-background p-4 text-sm font-mono text-foreground overflow-x-auto">
                {JSON.stringify(promptDetails.outputSchema, null, 2)}
              </pre>
            </CardContent>
          </Card>

          <div className="flex gap-3 mt-6">
            <Button variant="outline" onClick={cancelEdit}>Cancel Edit</Button>
            <Button variant="default" onClick={saveEdit} disabled={createVersionMutation.isPending || setActiveMutation.isPending}>
              {createVersionMutation.isPending ? <Spinner className="mr-2" /> : 'Save & Publish New Version'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}