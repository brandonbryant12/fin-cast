import { Alert, AlertDescription, AlertTitle } from '@repo/ui/components/alert';
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
import { useForm } from '@tanstack/react-form';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { AlertCircle, Terminal, Pencil, X, Check, Loader2 } from 'lucide-react';
import { useState, useCallback } from 'react';
import { toast } from "sonner";
import * as v from 'valibot';
import type { AppRouter } from '@repo/api/server';
import type { TRPCClientErrorLike } from '@trpc/client';
import type { inferRouterOutputs, inferProcedureInput } from '@trpc/server';
import { DialogueSegmentEditor } from './-components/dialogue-segment-editor';
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

function PodcastDetailPage() {
 const { podcastId } = Route.useParams();
 const [isEditing, setIsEditing] = useState(false);
 const queryClient = useQueryClient();

 const podcastQueryOptions = trpc.podcasts.byId.queryOptions({ id: podcastId });
 const { data: podcast, isLoading: isLoadingPodcast, isError: isPodcastError, error: podcastError } = useQuery(podcastQueryOptions);
 const { availableVoices, isLoadingVoices } = useVoices();

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
      <div className="flex-grow space-y-3">
       {!isEditing ? (
        <CardTitle className="text-3xl font-bold text-foreground">{form.getFieldValue('title')}</CardTitle>
       ) : (
        <form.Field name="title" key={`title-${isEditing}`}>
         {(field) => {
          return (
           <div className="space-y-1">
            <Label htmlFor={field.name} className="text-xs text-muted-foreground">Podcast Title</Label>
            <Input
             id={field.name}
             name={field.name}
             value={field.state.value}
             onBlur={field.handleBlur}
             onChange={(e) => field.handleChange(e.target.value)}
             className="text-xl bg-input"
             placeholder="Enter podcast title"
            />
           </div>
          );
         }}
        </form.Field>
       )}
       {!isEditing ? (
        <>
         <CardDescription className="text-muted-foreground flex items-center gap-2">
           Status: {typedPodcast.status}
           {isProcessing && <Spinner className="h-4 w-4" />}
         </CardDescription>
         <CardDescription className="text-muted-foreground pt-1">
          Host: {currentHostName} | Co-host: {currentCohostName}
         </CardDescription>
        </>
       ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
         <form.Field name="hostPersonalityId" key={`host-${isEditing}`}>
          {(field) => {
           const previousHostId = field.state.value;
           return (
            <div className="space-y-1">
             <Label htmlFor={field.name} className="text-xs text-muted-foreground">Host</Label>
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
             <Label htmlFor={field.name} className="text-xs text-muted-foreground">Co-host</Label>
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
    <CardContent>
     <h3 className="text-xl font-semibold mb-4 text-foreground">Transcript</h3>

     {!isEditing ? (
      <div className="space-y-4 max-h-[60vh] overflow-y-auto rounded-md border border-border bg-card p-4">
       {Array.isArray(viewDialogue) && viewDialogue.length > 0 ? (
        viewDialogue.map((segment, index) => (
         <div key={index} className="text-sm">
          <span className="font-semibold text-primary mr-2">{(segment as any)?.speaker ?? 'Unknown'}:</span>
          <span className="text-foreground">{(segment as any)?.line ?? ''}</span>
         </div>
        ))
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
                   key={`${index}`}
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