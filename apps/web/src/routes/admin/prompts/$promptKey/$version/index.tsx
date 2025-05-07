import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@repo/ui/components/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogClose } from '@repo/ui/components/dialog'
import { Input } from '@repo/ui/components/input'
import { Label } from '@repo/ui/components/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/select'
import { Textarea } from '@repo/ui/components/textarea'
import { useForm } from '@tanstack/react-form'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import * as v from 'valibot'
import { trpc } from '@/router'
import Spinner from '@/routes/-components/common/spinner'

export const Route = createFileRoute('/admin/prompts/$promptKey/$version/')({
  component: PromptDetailPage,
})

const EditSchema = v.object({
  userInstructions: v.string(),
  temperature: v.pipe(v.number(), v.minValue(0), v.maxValue(2)),
  maxTokens: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(5000)),
})

type EditFormValues = v.InferInput<typeof EditSchema>;

function PromptDetailPage() {
  const { promptKey, version } = Route.useParams()
  const navigate = useNavigate()
  const utils = trpc.useUtils()
  const [isConfirmSetActiveModalOpen, setIsConfirmSetActiveModalOpen] = useState(false);


  const promptDetailsQuery = useQuery(trpc.promptRegistry.getDetails.queryOptions(
    { promptKey, version },
    { staleTime: 5 * 60 * 1000 }
  ));

  const availableVersionsQuery = trpc.promptRegistry.getAvailableVersions.useQuery(
    { promptKey },
    { staleTime: 5 * 60 * 1000 }
  );

  const updateMutation = trpc.promptRegistry.update.useMutation({
    onSuccess: async () => {
      toast.success(`Prompt ${promptKey} v${version} updated successfully.`);
      await utils.promptRegistry.getDetails.invalidate({ promptKey, version });
    },
    onError: (error) => {
      toast.error(`Failed to update prompt: ${error.message}`);
    }
  });

  const setActiveMutation = trpc.promptRegistry.setActive.useMutation({
    onSuccess: async () => {
      toast.success(`Version ${version} of ${promptKey} is now active.`);
      await utils.promptRegistry.listAll.invalidate();
      await utils.promptRegistry.getDetails.invalidate({ promptKey, version });
      await utils.promptRegistry.getDetails.invalidate({ promptKey, version: promptDetailsQuery.data?.isActive ? promptDetailsQuery.data.version : undefined }); // Invalidate old active if known
      setIsConfirmSetActiveModalOpen(false);
    },
    onError: (error) => {
      toast.error(`Failed to set active version: ${error.message}`);
      setIsConfirmSetActiveModalOpen(false);
    }
  });

  const form = useForm<EditFormValues>({
    defaultValues: {
      userInstructions: '',
      temperature: 0.7,
      maxTokens: 1024,
    },
    onSubmit: async ({ value }) => {
      try {
        const parsed = v.parse(EditSchema, value);
        await updateMutation.mutateAsync({ promptKey, version, ...parsed });
      } catch (error) {
        if (error instanceof v.ValiError) {
          toast.error("Validation error. Please check your inputs.");
        } else {
          toast.error("An unexpected error occurred.");
        }
      }
    },
  });

  useEffect(() => {
    if (promptDetailsQuery.data) {
      form.reset({
        userInstructions: promptDetailsQuery.data.userInstructions ?? '',
        temperature: Number(promptDetailsQuery.data.temperature ?? 0.7),
        maxTokens: promptDetailsQuery.data.maxTokens ?? 1024,
      });
    }
  }, [promptDetailsQuery.data, form.reset]);


  if (promptDetailsQuery.isLoading || availableVersionsQuery.isLoading) {
    return <div className="flex justify-center items-center h-64"><Spinner /></div>;
  }

  if (promptDetailsQuery.isError || !promptDetailsQuery.data) {
    return <p className="text-destructive">Error loading prompt details: {promptDetailsQuery.error?.message ?? 'Prompt not found'}</p>;
  }
  if (availableVersionsQuery.isError || !availableVersionsQuery.data) {
    return <p className="text-destructive">Error loading available versions: {availableVersionsQuery.error?.message}</p>;
  }

  const currentPrompt = promptDetailsQuery.data;
  const versions = availableVersionsQuery.data;

  const handleVersionChange = (newVersion: string) => {
    if (newVersion && newVersion !== version) {
      navigate({ to: '/admin/prompts/$promptKey/$version', params: { promptKey, version: newVersion }});
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-2xl">{promptKey} - Version {version}</CardTitle>
            <CardDescription>
              Manage this specific version of the prompt.
              {currentPrompt.isActive && <Badge className="ml-2">Active</Badge>}
            </CardDescription>
          </div>
          {versions && versions.length > 1 && (
            <div className="w-48">
              <Select value={version} onValueChange={handleVersionChange}>
                <SelectTrigger id="version-select" aria-label="Select prompt version">
                  <SelectValue placeholder="Switch version..." />
                </SelectTrigger>
                <SelectContent>
                  {versions.map(v => (
                    <SelectItem key={v} value={v}>
                      Version {v} {currentPrompt.version === v && currentPrompt.isActive ? "(Active)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={e => { e.preventDefault(); e.stopPropagation(); form.handleSubmit() }}
          className="space-y-6"
        >
          <form.Field name="userInstructions">
            {(field) => (
              <div>
                <Label htmlFor={field.name} className="block text-sm font-medium mb-1">User Instructions</Label>
                <Textarea
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="bg-input min-h-[120px]"
                  rows={8}
                />
                {field.state.meta.errors && <p className="text-sm text-destructive mt-1">{field.state.meta.errors.join(', ')}</p>}
              </div>
            )}
          </form.Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <form.Field name="temperature">
              {(field) => (
                <div>
                  <Label htmlFor={field.name} className="block text-sm font-medium mb-1">Temperature</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="number"
                    step="0.01"
                    min="0"
                    max="2"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(parseFloat(e.target.value))}
                    className="bg-input"
                  />
                  {field.state.meta.errors && <p className="text-sm text-destructive mt-1">{field.state.meta.errors.join(', ')}</p>}
                </div>
              )}
            </form.Field>
            <form.Field name="maxTokens">
              {(field) => (
                <div>
                  <Label htmlFor={field.name} className="block text-sm font-medium mb-1">Max Tokens (1-5000)</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="number"
                    step="1"
                    min="1"
                    max="5000"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(parseInt(e.target.value, 10))}
                    className="bg-input"
                  />
                  {field.state.meta.errors && <p className="text-sm text-destructive mt-1">{field.state.meta.errors.join(', ')}</p>}
                </div>
              )}
            </form.Field>
          </div>
          <div className="flex flex-wrap gap-2 pt-4">
            <Button type="submit" disabled={updateMutation.isPending || !form.state.isDirty} className="bg-primary hover:bg-primary-hover">
              {updateMutation.isPending ? <Spinner className="mr-2 h-4 w-4" /> : null}
              Save Changes
            </Button>
            <Dialog open={isConfirmSetActiveModalOpen} onOpenChange={setIsConfirmSetActiveModalOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  disabled={currentPrompt.isActive || setActiveMutation.isPending}
                  onClick={() => setIsConfirmSetActiveModalOpen(true)}
                >
                  {setActiveMutation.isPending ? <Spinner className="mr-2 h-4 w-4" /> : null}
                  Set Active
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirm Set Active</DialogTitle>
                </DialogHeader>
                <p className="py-4">
                  Are you sure you want to make version <strong>{version}</strong> of prompt <strong>{promptKey}</strong> the active version?
                  This action will affect production immediately.
                </p>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline" disabled={setActiveMutation.isPending}>Cancel</Button>
                  </DialogClose>
                  <Button
                    onClick={async () => {
                      await setActiveMutation.mutateAsync({ promptKey, version })
                    }}
                    disabled={setActiveMutation.isPending}
                    className="bg-destructive hover:bg-destructive/80"
                  >
                    {setActiveMutation.isPending ? <Spinner className="mr-2 h-4 w-4" /> : null}
                    Confirm & Set Active
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </form>
      </CardContent>
      <CardFooter className="border-t border-border pt-4 mt-6">
        <Link to="/admin/prompts" className="text-sm text-primary hover:underline">
          &larr; Back to All Prompts
        </Link>
      </CardFooter>
    </Card>
  )
}