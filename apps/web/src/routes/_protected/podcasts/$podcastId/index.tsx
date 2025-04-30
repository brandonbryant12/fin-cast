import { Alert, AlertDescription, AlertTitle } from '@repo/ui/components/alert';
import { Badge } from "@repo/ui/components/badge"; // Import Badge
import { Button } from '@repo/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/card';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@repo/ui/components/select";
import { cn } from '@repo/ui/lib/utils';
import { useForm } from '@tanstack/react-form';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { AlertCircle, Terminal, Pencil, X, Check, Loader2, Play, Pause } from 'lucide-react';
import { useState, useCallback } from 'react';
import { toast } from "sonner";
import * as v from 'valibot';
import type { AppRouter } from '@repo/api/server';
import type { TRPCClientErrorLike } from '@trpc/client';
import type { inferRouterOutputs, inferProcedureInput } from '@trpc/server';
import { DialogueSegmentEditor } from './-components/dialogue-segment-editor';
import { useAudioPlayer } from '@/contexts/audio-player-context';
import { useVoices, type PersonalityInfo, PersonalityId } from '@/contexts/voices-context';
import { trpc } from '@/router';
import Spinner from '@/routes/-components/common/spinner';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DialogueSegmentSchema = v.object({
 speaker: v.string(),
 line: v.pipe(v.string(), v.minLength(1, 'Dialogue line cannot be empty.'))
});

type DialogueSegment = v.InferInput<typeof DialogueSegmentSchema>;

type PodcastOutput = inferRouterOutputs<AppRouter>['podcasts']['byId'];

type UpdatePodcastInputType = inferProcedureInput<AppRouter['podcasts']['update']>;

export const Route = createFileRoute('/_protected/podcasts/$podcastId/')({
 component: PodcastDetailPage,
 validateSearch: (search: Record<string, unknown>): Record<string, unknown> => { return {} },
});

// Static data for Key Topics - replace later with actual data
const staticKeyTopics = ["Market Analysis", "AI Impact", "Q1 Earnings", "Federal Reserve", "Tech Stocks", "Global Economy"];

// Define chip colors - using standard Tailwind for variety, ensure good contrast with text-white/text-gray-900
const chipColorClasses = [
  "bg-teal-600 hover:bg-teal-700 text-white",
  "bg-sky-600 hover:bg-sky-700 text-white",
  "bg-amber-600 hover:bg-amber-700 text-white",
  "bg-rose-600 hover:bg-rose-700 text-white",
  "bg-violet-600 hover:bg-violet-700 text-white",
  "bg-lime-600 hover:bg-lime-700 text-white",
];


function PodcastDetailPage() {
 const { podcastId } = Route.useParams();
 const [isEditing, setIsEditing] = useState(false);
 const queryClient = useQueryClient();

 const podcastQueryOptions = trpc.podcasts.byId.queryOptions({ id: podcastId });
 const { data: podcast, isLoading: isLoadingPodcast, isError: isPodcastError, error: podcastError } = useQuery(podcastQueryOptions);
 const { availableVoices, isLoadingVoices } = useVoices();
 const {
    activePodcast,
    isPlaying: isContextPlaying,
    loadTrack,
    play,
    pause: pauseTrack
 } = useAudioPlayer();

 const updatePodcastMutation = useMutation({
  ...trpc.podcasts.update.mutationOptions()
 });

 const form = useForm({
  defaultValues: {
   title: podcast?.title,
   hostPersonalityId: podcast?.hostPersonalityId,
   cohostPersonalityId: podcast?.cohostPersonalityId,
   dialogue: podcast?.transcript?.content as DialogueSegment[],
  },
  onSubmit: async ({ value }) => {
   const originalData = podcast as PodcastOutput | null | undefined;
   if (!originalData) {
    toast.error("Failed to save: Original data unavailable.");
    return;
   }
   if (value.hostPersonalityId && value.hostPersonalityId === value.cohostPersonalityId) {
    toast.error("Host and Co-host must be different.");
    return;
   }

   if (!value.dialogue || value.dialogue.length === 0) {
    toast.error("Podcast must have at least one dialogue segment.");
    return;
   }

   const changes: Partial<UpdatePodcastInputType> = {};

   if (value.title !== originalData.title) {
    changes.title = value.title;
   }
   if (value.hostPersonalityId !== originalData.hostPersonalityId) {
    changes.hostPersonalityId = value.hostPersonalityId as PersonalityId;
   }
   if (value.cohostPersonalityId !== originalData.cohostPersonalityId) {
    changes.cohostPersonalityId = value.cohostPersonalityId as PersonalityId;
   }

   const originalDialogueString = JSON.stringify(originalData.transcript?.content || []);
   const currentDialogueString = JSON.stringify(value.dialogue);
   if (originalDialogueString !== currentDialogueString) {
    changes.content = value.dialogue.map(seg => ({ speaker: seg.speaker, line: seg.line }));
   }

   if (Object.keys(changes).length === 0) {
    toast.info("No changes detected.");
    setIsEditing(false);
    return;
   }

   updatePodcastMutation.mutate(
    { podcastId: podcastId, ...changes },
    {
     onSuccess: () => {
      toast.success("Podcast update initiated.");
      queryClient.invalidateQueries({ queryKey: podcastQueryOptions.queryKey });
      setIsEditing(false);
     },
     onError: (error: TRPCClientErrorLike<AppRouter>) => {
      toast.error(`Failed to save: ${error.message}`);
     },
    }
   );
  },
 });

 const resetFormWithData = useCallback((data: PodcastOutput | null | undefined) => {
   if (!data) {
    return;
   }
   form.reset({
     title: data.title || '',
     hostPersonalityId: data.hostPersonalityId || undefined,
     cohostPersonalityId: data.cohostPersonalityId || undefined,
     dialogue: Array.isArray(data.transcript?.content) ? data.transcript.content : [],
   });
 }, [form]);

 const handleAddSegment = () => {
  const currentDialogue = form.getFieldValue('dialogue') || [];
  const defaultSpeaker = form.getFieldValue('hostPersonalityId') || (availableVoices && availableVoices[0]?.name) || '';
  form.setFieldValue('dialogue', [...currentDialogue, { speaker: defaultSpeaker, line: '' }]);
 };

 const handleRemoveSegment = (index: number) => {
  const currentDialogue = form.getFieldValue('dialogue') || [];
  form.setFieldValue('dialogue', currentDialogue.filter((_: any, i: number) => i !== index));
 };

 const handleUpdateSegment = (index: number, updatedSegment: DialogueSegment) => {
  const currentDialogue = form.getFieldValue('dialogue') || [];
  const updatedDialogue = [...currentDialogue];
  updatedDialogue[index] = updatedSegment;
  form.setFieldValue('dialogue', updatedDialogue);
 };

 const getPersonalityName = (id: string | null | undefined): string => {
  return availableVoices?.find((p: PersonalityInfo) => p.name === id)?.name ?? (id || 'Unknown');
 };

 const updateDialogueSpeakers = (oldSpeakerId: string | undefined | null, newSpeakerId: string) => {
    if (!oldSpeakerId || oldSpeakerId === newSpeakerId) {
      return;
    }
    const currentDialogue = form.getFieldValue('dialogue') || [];
    const updatedDialogue = currentDialogue.map(segment => {
      if (segment.speaker === oldSpeakerId) {
        return { ...segment, speaker: newSpeakerId };
      }
      return segment;
    });
    form.setFieldValue('dialogue', updatedDialogue);
 };

 const handleEditClick = () => {
  if (podcast) {
   resetFormWithData(podcast);
  }
  setIsEditing(true);
 };

 const handleCancel = () => {
  if (podcast) {
   resetFormWithData(podcast);
  }
  setIsEditing(false);
 };

 const handlePlayPauseClick = () => {
    if (!podcast || podcast.status !== 'success' || !podcast.audioUrl) {
      console.warn('Cannot play podcast: Invalid status or missing audioUrl');
      toast.error("Audio is not available for this podcast yet.");
      return;
    }

    const isActive = activePodcast?.id === podcast.id;

    if (isActive) {
      if (isContextPlaying) {
        pauseTrack();
      } else {
        play();
      }
    } else {
      loadTrack({
        id: podcast.id,
        title: podcast.title || 'Untitled Podcast',
        audioUrl: podcast.audioUrl
      });
    }
 };

 if (isLoadingPodcast || isLoadingVoices) {
  return <div className="flex justify-center items-center h-64"><Spinner className="h-16 w-16" /></div>;
 }

 if (isPodcastError) {
  return (
   <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>Error Loading Podcast</AlertTitle>
    <AlertDescription>{podcastError?.message || 'Could not fetch podcast details.'}</AlertDescription>
   </Alert>
  );
 }

 const typedPodcast = podcast as PodcastOutput;

 if (!typedPodcast) {
  return (
   <Alert variant="default">
    <Terminal className="h-4 w-4" />
    <AlertTitle>Podcast Not Found</AlertTitle>
    <AlertDescription>The requested podcast could not be found or you don't have permission to view it.</AlertDescription>
   </Alert>
  );
 }

 const isProcessing = typedPodcast.status === 'processing';
 const viewDialogue = typedPodcast?.transcript?.content;

 const currentHostName = getPersonalityName(typedPodcast.hostPersonalityId);
 const currentCohostName = getPersonalityName(typedPodcast.cohostPersonalityId);

 const isCurrentPodcastPlaying = activePodcast?.id === typedPodcast.id && isContextPlaying;
 const canPlayPodcast = typedPodcast.status === 'success' && !!typedPodcast.audioUrl;

 return (
  <form
   onSubmit={(e) => {
    e.preventDefault();
    e.stopPropagation();
    form.handleSubmit();
   }}
   className="container mx-auto py-8 px-4"
  >
   <Card>
    <CardHeader>
     <div className="flex justify-between items-start gap-4">
      <div className="flex-grow space-y-4">
       {!isEditing ? (
        <>
          <CardTitle className="text-3xl font-bold text-foreground">{typedPodcast.title}</CardTitle>

          {/* Key Topics Section */}
          <div className="flex flex-wrap gap-2">
              {staticKeyTopics.map((topic, index) => (
                  <Badge
                      key={topic}
                      variant="outline"
                      className={cn(
                          "border-transparent px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                          chipColorClasses[index % chipColorClasses.length]
                      )}
                  >
                      {topic}
                  </Badge>
              ))}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2">
              <Button
                  variant="outline"
                  size="icon"
                  onClick={handlePlayPauseClick}
                  disabled={!canPlayPodcast || isProcessing}
                  aria-label={isCurrentPodcastPlaying ? 'Pause Podcast' : 'Play Podcast'}
                  className="text-foreground hover:bg-primary/10 disabled:opacity-50 flex-shrink-0"
              >
                  {isCurrentPodcastPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </Button>
              <CardDescription className="text-muted-foreground text-sm">
                  {isProcessing && <Spinner className="inline-block h-4 w-4 ml-2" />}
              </CardDescription>
              <CardDescription className="text-muted-foreground text-sm">
                  Host: {currentHostName} | Co-host: {currentCohostName}
              </CardDescription>
          </div>
        </>
       ) : (
        <>
          <form.Field name="title" key={`title-${isEditing}`}>
           {(field) => (
            <div className="space-y-1">
             <Label htmlFor={field.name} className="text-sm font-medium text-muted-foreground">Podcast Title</Label>
             <Input
              id={field.name}
              name={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              className="text-lg bg-input"
              placeholder="Enter podcast title"
             />
            </div>
           )}
          </form.Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
           <form.Field name="hostPersonalityId" key={`host-${isEditing}`}>
            {(field) => {
             const previousHostId = field.state.value;
             return (
              <div className="space-y-1">
               <Label htmlFor={field.name} className="text-sm font-medium text-muted-foreground">Host</Label>
               <Select
                 name={field.name}
                 value={field.state.value}
                 onValueChange={(newValue) => {
                   updateDialogueSpeakers(previousHostId, newValue);
                   field.handleChange(newValue);
                 }}
                >
                <SelectTrigger id={field.name} className="bg-input">
                 <SelectValue placeholder="Select host..." />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                 {Array.isArray(availableVoices) && availableVoices
                  .filter(p => p.name !== form.getFieldValue('cohostPersonalityId'))
                  .map((p: PersonalityInfo) => (
                   <SelectItem key={p.name} value={p.name}>{p?.name ?? 'Unknown'}</SelectItem>
                  ))}
                </SelectContent>
               </Select>
              </div>
             );
            }}
           </form.Field>
           <form.Field name="cohostPersonalityId" key={`cohost-${isEditing}`}>
            {(field) => {
             const previousCohostId = field.state.value;
             return (
              <div className="space-y-1">
               <Label htmlFor={field.name} className="text-sm font-medium text-muted-foreground">Co-host</Label>
               <Select
                 name={field.name}
                 value={field.state.value}
                 onValueChange={(newValue) => {
                   updateDialogueSpeakers(previousCohostId, newValue);
                   field.handleChange(newValue);
                 }}
                >
                <SelectTrigger id={field.name} className="bg-input">
                 <SelectValue placeholder="Select co-host..." />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                 {Array.isArray(availableVoices) && availableVoices
                  .filter(p => p.name !== form.getFieldValue('hostPersonalityId'))
                  .map((p: PersonalityInfo) => (
                   <SelectItem key={p.name} value={p.name}>{p?.name ?? 'Unknown'}</SelectItem>
                  ))}
                </SelectContent>
               </Select>
              </div>
             );
            }}
           </form.Field>
          </div>
        </>
       )}
      </div>
      <div className="flex space-x-2 flex-shrink-0">
       {!isEditing ? (
        <Button
         variant="outline"
         size="icon"
         onClick={handleEditClick}
         disabled={isProcessing}
         aria-label="Edit Podcast"
        >
         <Pencil className="h-4 w-4" />
        </Button>
       ) : (
        <>
         <Button
          variant="outline"
          size="icon"
          onClick={handleCancel}
          aria-label="Cancel Edit"
          type="button"
         >
          <X className="h-4 w-4" />
         </Button>
         <form.Subscribe selector={(state) => [state.isValid, state.isSubmitting]}>
          {([isValid, isSubmitting]) => (
           <Button
            variant="default"
            size="icon"
            aria-label="Save Changes"
            type="submit"
            disabled={isSubmitting || !isValid || updatePodcastMutation.isPending}
           >
            {isSubmitting || updatePodcastMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
           </Button>
          )}
         </form.Subscribe>
        </>
       )}
      </div>
     </div>
    </CardHeader>
    <CardContent className="pt-6 border-t border-border">
     <h3 className="text-xl font-semibold mb-4 text-foreground">Transcript</h3>

     {!isEditing ? (
      <div className="space-y-4 max-h-[60vh] overflow-y-auto rounded-md border border-border bg-background p-4">
       {Array.isArray(viewDialogue) && viewDialogue.length > 0 ? (
        viewDialogue.map((segment, index) => {
         const speakerName = (segment as any)?.speaker ?? 'Unknown';
         const isHost = speakerName === typedPodcast.hostPersonalityId;
         const isCohost = speakerName === typedPodcast.cohostPersonalityId;
         const speakerColorClass = isHost
           ? 'text-indigo-400'
           : isCohost
           ? 'text-teal-400'
           : 'text-primary';
         return (
          <div key={index} className="text-sm flex flex-col sm:flex-row sm:items-start">
             <span className={`font-semibold mr-2 w-full sm:w-auto mb-1 sm:mb-0 ${speakerColorClass} flex-shrink-0 sm:max-w-[150px] truncate`}>
                {speakerName}:
             </span>
             <span className="text-foreground pl-1 sm:pl-0">{segment.line ?? ''}</span>
          </div>
         );
        })
       ) : (
        <p className="text-muted-foreground italic">No transcript available.</p>
       )}
      </div>
     ) : (
      <form.Field name="dialogue">
       {(field) => {
         const currentHostId = form.getFieldValue('hostPersonalityId');
         const currentCohostId = form.getFieldValue('cohostPersonalityId');
         const hostNameForEditor = currentHostId ?? 'Unknown';
         const cohostNameForEditor = currentCohostId ?? 'Unknown';

         return (
           <div className="space-y-3">
             <div className="space-y-2 max-h-[50vh] overflow-y-auto rounded-md border border-input bg-background p-2">
               {(field.state.value || []).map((segment: DialogueSegment, index: number) => (
                 <DialogueSegmentEditor
                   key={index}
                   index={index}
                   segment={segment}
                   onSpeakerChange={(idx, speaker) => handleUpdateSegment(idx, { ...segment, speaker })}
                   onLineChange={(idx, line) => handleUpdateSegment(idx, { ...segment, line })}
                   onDelete={() => handleRemoveSegment(index)}
                   hostName={hostNameForEditor}
                   cohostName={cohostNameForEditor}
                 />
               ))}
             </div>
             <Button
               variant="outline"
               size="sm"
               type="button"
               onClick={handleAddSegment}
             >
               Add Segment
             </Button>
           </div>
         );
       }}
      </form.Field>
     )}
    </CardContent>
   </Card>
  </form>
 );
}