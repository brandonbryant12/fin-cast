import { Button } from '@repo/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@repo/ui/components/tooltip';
import { cn } from '@repo/ui/lib/utils';
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, Check, Volume2, Pause } from 'lucide-react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import * as v from 'valibot';
import { useAudioPlayer } from '@/contexts/audio-player-context';
import { useVoices, PersonalityId, type PersonalityInfo } from '@/contexts/voices-context';
import { trpc } from '@/router';
import FormFieldInfo from '@/routes/-components/common/form-field-info';
import Spinner from '@/routes/-components/common/spinner';


interface GeneratePodcastModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  onSuccess: () => void;
}

const generatePodcastSchema = v.pipe(
  v.object({
    sourceUrl: v.pipe(v.string('Source must be a string'), v.url('Please provide a valid URL')),
    hostPersonalityId: v.pipe(
      v.string('Host ID must be a string.'),
      v.nonEmpty('Please select a host voice.'),
      v.custom<PersonalityId>((input) => Object.values(PersonalityId).includes(input as PersonalityId), 'Invalid host personality selected.')
    ),
    cohostPersonalityId: v.pipe(
      v.string('Co-host ID must be a string.'),
      v.nonEmpty('Please select a co-host voice.'),
      v.custom<PersonalityId>((input) => Object.values(PersonalityId).includes(input as PersonalityId), 'Invalid co-host personality selected.')
    ),
  }),
  v.forward(
    v.check(
      (input) => input.hostPersonalityId !== input.cohostPersonalityId,
      'Host and co-host voices must be different.'
    ),
    ['cohostPersonalityId']
  ),
  v.forward(
    v.check(
      (input) => input.hostPersonalityId !== input.cohostPersonalityId,
      'Host and co-host voices must be different.'
    ),
    ['hostPersonalityId']
  )
);

export function GeneratePodcastModal({
  open,
  setOpen,
  onSuccess,
}: GeneratePodcastModalProps) {

  const {
    loadTrack,
    pause,
    isPlaying,
    activePodcast,
    closePlayer
  } = useAudioPlayer();

  const { availableVoices, isLoadingVoices, voicesError } = useVoices();

  const createPodcastMutation = useMutation({
    ...(trpc.podcasts.create.mutationOptions()),
    onSuccess: () => {
      toast.success('Podcast Generation Started', { description: 'Your podcast is being processed.' });
      form.reset();
      onSuccess();
      setOpen(false);
    },
    onError: (error) => {
      toast.error('Generation Failed', {
        description: error.message || 'Could not start podcast generation.',
      });
    },
  });

  const form = useForm({
    defaultValues: {
      sourceUrl: '',
      hostPersonalityId: '' as PersonalityId | '',
      cohostPersonalityId: '' as PersonalityId | '',
    },
    onSubmit: async ({ value }) => {
      const submissionValue = {
          ...value,
          hostPersonalityId: value.hostPersonalityId || undefined,
          cohostPersonalityId: value.cohostPersonalityId || undefined,
      }
      const result = v.safeParse(generatePodcastSchema, submissionValue);

      if (!result.success) {
        console.error("Validation Issues:", result.issues);
        toast.error("Validation Error", { description: "Please check the form for errors." });
        return;
      }

      await createPodcastMutation.mutateAsync({
        sourceUrl: result.output.sourceUrl,
        hostPersonalityId: result.output.hostPersonalityId as PersonalityId,
        cohostPersonalityId: result.output.cohostPersonalityId as PersonalityId,
      });
    },
  });

  useEffect(() => {
    if (!isLoadingVoices && !voicesError && availableVoices.length > 0) {

      if (!form.state.values.hostPersonalityId && availableVoices[0]) {
        form.setFieldValue('hostPersonalityId', availableVoices[0].name);
      }

      if (!form.state.values.cohostPersonalityId && availableVoices.length > 1) {
         
          const defaultHostId = form.state.values.hostPersonalityId || availableVoices[0]?.name;
          const differentCohost = availableVoices.find(p => p.name !== defaultHostId);
          if (differentCohost) {
              form.setFieldValue('cohostPersonalityId', differentCohost.name);
          } else if(availableVoices[1] && availableVoices[0]?.name !== availableVoices[1]?.name) {
              form.setFieldValue('cohostPersonalityId', availableVoices[1].name);
          }
      }
    }
   
  }, [isLoadingVoices, voicesError, availableVoices, form]);

  const handlePreviewClick = (personality: PersonalityInfo) => {
    const previewUrl = personality.previewAudioUrl;
    if (!previewUrl) {
      toast.info(`No preview available for ${personality.name}.`);
      return;
    }

    // Check if this specific preview is currently playing
    const isCurrentlyPlayingPreview = isPlaying && activePodcast?.id === `preview-${personality.name}`;

    if (isCurrentlyPlayingPreview) {
      pause();
    } else {
      loadTrack({
        id: `preview-${personality.id}`,
        title: `Preview: ${personality.name}`,
        audioUrl: previewUrl,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
            closePlayer();
        }
       }}>
      <DialogContent className="sm:max-w-lg">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle>Generate Podcast</DialogTitle>
            <DialogDescription>
              Enter the URL of an article and select distinct voices for your podcast hosts. Hover over a name for details. Click the speaker icon to preview.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <form.Field
              name="sourceUrl"
              validators={{
                onChange: ({ value }) => {
                  const urlSchema = v.pipe(v.string(), v.nonEmpty('URL cannot be empty.'), v.url('Please enter a valid URL.'));
                  const result = v.safeParse(urlSchema, value);
                  return result.success ? undefined : result.issues[0]?.message;
                }
              }}
              children={(field) => (
                <div className="space-y-1">
                  <Label htmlFor={field.name}>
                    Article URL
                  </Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="https://example.com/article"
                    aria-describedby={field.name + '-info'}
                    aria-invalid={!!field.state.meta.errors?.length}
                  />
                  <FormFieldInfo field={field} />
                </div>
              )}
            />

            <div className="space-y-2">
              <Label>Select Hosts</Label>
              <div className="rounded-md border border-border bg-input/20 p-3 max-h-60 overflow-y-auto">
                {isLoadingVoices && (
                  <div className="flex items-center justify-center text-muted-foreground p-4">
                    <Spinner className="mr-2" /> Loading voices...
                  </div>
                )}
                {voicesError && (
                  <div className="flex items-center justify-center text-destructive p-4">
                    <AlertTriangle className="mr-2 h-4 w-4" /> Error loading voices: {voicesError.message}
                  </div>
                )}
                {!isLoadingVoices && !voicesError && availableVoices.length === 0 && (
                  <div className="text-center text-muted-foreground p-4">
                    No voice personalities available.
                  </div>
                )}
                {!isLoadingVoices && !voicesError && availableVoices.length > 0 && (
                  <div className="space-y-2">
                    <TooltipProvider delayDuration={100}>
                      {availableVoices.map((p) => (
                        <div key={p.id} className="flex items-center justify-between p-2 rounded hover:bg-input/50">
                          {/* Preview Button - Use Audio Context */}
                          {p.previewAudioUrl ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className={cn(
                                    "text-muted-foreground hover:text-foreground h-8 w-8 flex-shrink-0 mr-1",
                                    isPlaying && activePodcast?.id === `preview-${p.name}` && "text-primary"
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePreviewClick(p);
                                  }}
                                  aria-label={`Preview voice ${p.name}`}
                                >
                                  {isPlaying && activePodcast?.id === `preview-${p.name}` ? (
                                    <Pause className="h-4 w-4" />
                                  ) : (
                                    <Volume2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" align="start">
                                <p className="text-xs">Preview {p.name}</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            // Placeholder if no preview URL, maintains layout
                            <div className="h-8 w-8 mr-1 flex-shrink-0" />
                          )}

                          <div className="flex flex-1 items-center justify-between ml-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex-1 text-sm font-medium text-foreground cursor-default truncate pr-2" title={p.name}>
                                  {p.name}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" align="start">
                                <p className="text-xs max-w-xs">{p.description}</p>
                                {p.previewPhrase && <p className="text-xs mt-1 italic">"{p.previewPhrase}"</p>}
                              </TooltipContent>
                            </Tooltip>

                            <div className="flex space-x-2">
                              <form.Subscribe
                                selector={(state) => [
                                  state.values.hostPersonalityId,
                                  state.values.cohostPersonalityId,
                                ]}
                              >
                                {([hostId, cohostId]) => (
                                  <>
                                    <Button
                                      type="button"
                                      variant={hostId === p.name ? 'secondary' : 'outline'}
                                      size="sm"
                                      onClick={() => {
                                        if (cohostId !== p.name) {
                                          form.setFieldValue('hostPersonalityId', p.name);
                                        } else {
                                          toast.error("Host and Co-host cannot be the same voice.");
                                        }
                                      }}
                                      aria-checked={hostId === p.name}
                                      role="radio"
                                      className={cn(
                                        "px-3 py-1 text-xs h-auto",
                                        hostId === p.name && "ring-2 ring-primary ring-offset-1 ring-offset-background"
                                      )}
                                    >
                                      {hostId === p.name && <Check className="h-3 w-3 mr-1" />}
                                      Host
                                    </Button>
                                    <Button
                                      type="button"
                                      variant={cohostId === p.name ? 'secondary' : 'outline'}
                                      size="sm"
                                      onClick={() => {
                                        if (hostId !== p.name) {
                                          form.setFieldValue('cohostPersonalityId', p.name);
                                        } else {
                                           toast.error("Host and Co-host cannot be the same voice.");
                                        }
                                      }}
                                      aria-checked={cohostId === p.name}
                                      role="radio"
                                      className={cn(
                                        "px-3 py-1 text-xs h-auto",
                                        cohostId === p.name && "ring-2 ring-primary ring-offset-1 ring-offset-background"
                                      )}
                                    >
                                      {cohostId === p.name && <Check className="h-3 w-3 mr-1" />}
                                      Co-host
                                    </Button>
                                  </>
                                )}
                              </form.Subscribe>
                            </div>
                          </div>
                        </div>
                      ))}
                    </TooltipProvider>
                  </div>
                )}
              </div>
              {/* Combined error display for host/co-host selection */}
              <form.Subscribe selector={(state) => [
                  state.fieldMeta['hostPersonalityId']?.errors,
                  state.fieldMeta['cohostPersonalityId']?.errors
              ]}>
                  {([hostErrors, cohostErrors]) => {
                      // Combine and deduplicate errors specifically related to host/co-host selection
                      const uniqueErrors = Array.from(new Set([...(hostErrors || []), ...(cohostErrors || [])]))
                                                .filter(error => typeof error === 'string' && error.trim() !== '');

                      return uniqueErrors.length > 0 ? (
                        <div className="mt-1 text-sm text-destructive space-y-0.5 px-1">
                            {uniqueErrors.map((error, i) => (
                                <p key={i}>{error}</p>
                            ))}
                        </div>
                      ) : null;
                  }}
              </form.Subscribe>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
              children={([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  disabled={
                    !canSubmit ||
                    isSubmitting ||
                    createPodcastMutation.isPending ||
                    isLoadingVoices ||
                    availableVoices.length === 0
                  }
                >
                  {createPodcastMutation.isPending || isSubmitting ? (
                    <><Spinner className="mr-2" /> Generating...</>
                  ) : (
                    'Generate Podcast'
                  )}
                </Button>
              )}
            />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}