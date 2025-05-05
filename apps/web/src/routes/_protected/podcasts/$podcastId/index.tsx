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
import { Textarea } from '@repo/ui/components/textarea';
import { cn } from '@repo/ui/lib/utils';
import { useForm } from '@tanstack/react-form';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { AlertCircle, Terminal, Pencil, Play, Pause, LinkIcon, Search } from 'lucide-react';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { toast } from "sonner";
import * as v from 'valibot';
import type { AppRouter } from '@repo/api/server';
import type { TRPCClientErrorLike } from '@trpc/client';
import type { inferRouterOutputs, inferProcedureInput } from '@trpc/server';
import { LeaveReviewModal } from '../-components/leave-review-modal';
import { authClient } from '@/clients/authClient';
import { useAudioPlayer } from '@/contexts/audio-player-context';
import { useVoices, type PersonalityInfo, PersonalityId } from '@/contexts/voices-context';
import { trpc } from '@/router';
import { PodcastTags } from '@/routes/-components/common/podcast-tags';
import Spinner from '@/routes/-components/common/spinner';
import { StarRatingDisplay } from '@/routes/-components/common/star-rating-display';

const DialogueSegmentSchema = v.object({
 speaker: v.string(),
 line: v.pipe(v.string(), v.minLength(1, 'Dialogue line cannot be empty.'))
});
type DialogueSegment = v.InferInput<typeof DialogueSegmentSchema>;

type PodcastOutput = NonNullable<inferRouterOutputs<AppRouter>['podcasts']['byId']>;

type UpdatePodcastInputType = inferProcedureInput<AppRouter['podcasts']['update']>;

export const Route = createFileRoute('/_protected/podcasts/$podcastId/')({
 component: PodcastDetailPage,
 validateSearch: (search: Record<string, unknown>): Record<string, unknown> => { return {} },
});


function PodcastDetailPage() {
 const { podcastId } = Route.useParams();
 const [isEditing, setIsEditing] = useState(false);
 const [searchTerm, setSearchTerm] = useState('');

 const [editingSegmentIndex, setEditingSegmentIndex] = useState<number | null>(null);
 const editingTextareaRef = useRef<HTMLTextAreaElement>(null);
 const queryClient = useQueryClient();
 const { data: session } = authClient.useSession();

 const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
 const reviewsQueryOptions = trpc.reviews.byEntityId.queryOptions({ entityId: podcastId, contentType: 'podcast' });
 const { data: reviews } = useQuery(reviewsQueryOptions);

  const { averageRating, totalReviews } = useMemo(() => {
    if (!reviews || reviews.length === 0) {
       return { averageRating: 0, totalReviews: 0, currentUserHasReviewed: false };
     }
     const totalStars = reviews.reduce((sum, review) => sum + review.stars, 0);
     const avg = totalStars / reviews.length;
     const hasReviewed = reviews.some(review => review.userId === session?.user?.id);
     return { averageRating: avg, totalReviews: reviews.length, currentUserHasReviewed: hasReviewed };
   }, [reviews, session?.user?.id]);
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
   summary: podcast?.summary,
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
      setEditingSegmentIndex(null);
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
      summary: data.summary || '',
      hostPersonalityId: data.hostPersonalityId || undefined,
      cohostPersonalityId: data.cohostPersonalityId || undefined,
     dialogue: Array.isArray(data.transcript?.content) ? data.transcript.content : [],
   });
 }, [form]);

  useEffect(() => {
    if (editingSegmentIndex !== null && editingTextareaRef.current) {
      editingTextareaRef.current.focus();
    }
  }, [editingSegmentIndex]);


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
    const dialogue = Array.isArray(podcast.transcript?.content) ? podcast.transcript.content : [];
    if (dialogue.length > 0) {
      setEditingSegmentIndex(0);
    } else {
      setEditingSegmentIndex(null);
    }
  }
  setIsEditing(true);
 };

 const handleCancel = () => {
  if (podcast) {
   resetFormWithData(podcast);
  }
  setEditingSegmentIndex(null);
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
  return <div className="flex justify-center items-center h-64"><Spinner /></div>;
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

 const handleReviewSuccess = () => {
   queryClient.invalidateQueries({ queryKey: reviewsQueryOptions.queryKey });
 };

 const highlightMatch = (text: string, highlight: string): React.ReactNode => {
  if (!highlight.trim()) {
   return text;
  }
  const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);

  return (
   <>
    {parts.map((part, i) =>
     regex.test(part) ? (
      <mark key={i} className="bg-yellow-300 text-black px-0.5 rounded">
       {part}
      </mark>
     ) : (
      part
     )
    )}
   </>
  );
 };

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
          
          <PodcastTags tags={typedPodcast.tags} className="pt-1" />

          {/* Add Star Rating Display here, after tags */}
          <div className="flex items-center mt-2 mb-3">
            <StarRatingDisplay
              rating={averageRating}
              totalReviews={totalReviews}
              showText={true}
              size={18}
            />
          </div>

          {/* Display Summary */}
          {typedPodcast.summary && (
            <CardDescription className="text-muted-foreground pt-2 text-base">
              {typedPodcast.summary}
            </CardDescription>
          )}

          {/* Display Source URL if available */}
          {typedPodcast.sourceType === 'url' && typedPodcast.sourceDetail && (typedPodcast.sourceDetail.startsWith('http://') || typedPodcast.sourceDetail.startsWith('https://')) && (
             <div className="pt-3 flex items-center gap-1.5">
               <LinkIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <a
                  href={typedPodcast.sourceDetail}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-sky-500 hover:text-sky-400 hover:underline truncate"
                  title={typedPodcast.sourceDetail}
                >
                  {typedPodcast.sourceDetail}
                </a>
             </div>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-4">
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
           {/* Display Summary in Read-Only Mode */}
           {typedPodcast.summary && (
             <div className="space-y-1 pt-2">
               <Label className="text-sm font-medium text-muted-foreground">Podcast Summary</Label>
               <p className="text-muted-foreground text-base pt-1">{typedPodcast.summary}</p>
             </div>
           )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <form.Field name="hostPersonalityId" key={`host-${isEditing}`}>
              {(field) => {
             const currentHostIdBeforeChange = field.state.value;
             return (
              <div className="space-y-1">
               <Label htmlFor={field.name} className="text-sm font-medium text-muted-foreground">Host</Label>
               <Select
                 name={field.name}
                 value={field.state.value}
                 onValueChange={(newValue) => {
                   updateDialogueSpeakers(currentHostIdBeforeChange, newValue);
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
        <>
         {/* Add Review Button next to edit button */}
         {session?.user?.id && !reviews?.some(review => review.userId === session.user.id) && (
          <Button
           variant="outline"
           size="sm"
           onClick={() => setIsReviewModalOpen(true)}
           aria-label="Leave Review"
          >
           Leave Review
          </Button>
         )}
         <Button
          variant="outline"
          size="icon"
          onClick={handleEditClick}
          disabled={isProcessing}
          aria-label="Edit Podcast"
         >
          <Pencil className="h-4 w-4" />
         </Button>
        </>
       ) : (
        <>
         <Button
          variant="outline"
          size="sm"
          onClick={handleCancel}
          aria-label="Cancel Edit"
          type="button"
         >
          Cancel
         </Button>
         <form.Subscribe selector={(state) => [state.isValid, state.isSubmitting]}>
          {([isValid, isSubmitting]) => (
           <Button
            variant="default"
            size="sm"
            aria-label="Save Changes"
            type="submit"
            disabled={isSubmitting || !isValid || updatePodcastMutation.isPending}
           >
            {isSubmitting || updatePodcastMutation.isPending ? <Spinner className="h-4 w-4" /> : 'Save Changes'}
           </Button>
          )}
         </form.Subscribe>
        </>
       )}
      </div>
     </div>
    </CardHeader>
    <CardContent className="pt-6 border-t border-border">
     <div className="flex justify-between items-center mb-4">
       <h3 className="text-xl font-semibold text-foreground">Transcript</h3>
     </div>

     {!isEditing ? (
      <>
        <div className="relative w-full max-w-xs mb-4">
          <Input
            type="search"
            placeholder="Search transcript..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 bg-input"
          />
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto rounded-md border border-border bg-background p-4">
       {Array.isArray(viewDialogue) && viewDialogue.length > 0 ? (
        viewDialogue
         .filter(segment => !searchTerm || segment.line.toLowerCase().includes(searchTerm.toLowerCase()))
         .map((segment, index) => {
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
             <span className={`font-semibold mr-2 w-full sm:w-auto mb-1 sm:mb-0 ${speakerColorClass} flex-shrink-0 sm:max-w-[150px]`}>
                {speakerName}:
             </span>
             <span className="text-foreground flex-1 pl-0 sm:pl-2">{highlightMatch(segment.line ?? '', searchTerm)}</span>
          </div>
         );
        })
       ) : (
        <p className="text-muted-foreground italic">No transcript available.</p>
       )}
      </div>
      </>
     ) : (
      <form.Field name="dialogue">
       {(field) => {
          const dialogue = Array.isArray(field.state.value) ? field.state.value : [];
          const currentlyEditingSegment = editingSegmentIndex !== null ? dialogue[editingSegmentIndex] : null;

          const handleSegmentLineChange = (newLine: string) => {
            if (editingSegmentIndex !== null && dialogue[editingSegmentIndex]) {
              const updatedSegment: DialogueSegment = { 
                speaker: dialogue[editingSegmentIndex].speaker, 
                line: newLine 
              };
              handleUpdateSegment(editingSegmentIndex, updatedSegment);
            }
          };

          const getSegmentSpeakerName = (segmentSpeakerId: string | null | undefined) => {
              return getPersonalityName(segmentSpeakerId);
          };

         return (
           <div className="space-y-4">
             <div className="relative w-full max-w-xs mb-4">
               <Input
                 type="search"
                 placeholder="Search transcript..."
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="pl-8 bg-input"
               />
               <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
             </div>
             {currentlyEditingSegment && (
                <div className="border border-input rounded-md p-4 space-y-3 bg-background">
                    <h4 className="text-lg font-semibold text-foreground">Editing Segment {editingSegmentIndex !== null ? editingSegmentIndex + 1 : ''}</h4>
                    <div className="text-sm text-muted-foreground">Speaker: {getSegmentSpeakerName(currentlyEditingSegment.speaker)}</div>
                    <Textarea
                        ref={editingTextareaRef}
                        value={currentlyEditingSegment.line}
                        onChange={(e) => handleSegmentLineChange(e.target.value)}
                        placeholder="Edit dialogue line..."
                        className="bg-input text-sm min-h-[80px] resize-none leading-snug"
                    />
                </div>
              )}
             <div className="space-y-2 max-h-[50vh] overflow-y-auto rounded-md border border-input bg-background p-4">
               {dialogue.length > 0 ? (
                  dialogue
                   .filter(segment => !searchTerm || segment.line.toLowerCase().includes(searchTerm.toLowerCase()))
                   .map((segment: DialogueSegment, index: number) => {
                    const originalIndex = dialogue.findIndex(d => d === segment);
                    const speakerName = getSegmentSpeakerName(segment.speaker);
                    const isHost = segment.speaker === typedPodcast.hostPersonalityId;
                    const isCohost = segment.speaker === typedPodcast.cohostPersonalityId;
                    const speakerColorClass = isHost
                        ? 'text-indigo-400'
                        : isCohost
                        ? 'text-teal-400'
                        : 'text-primary';
                    const isSelected = index === editingSegmentIndex;

                    return (
                      <div
                        key={index}
                        className={cn(
                           "text-sm flex flex-col sm:flex-row sm:items-start p-2 rounded-md cursor-pointer",
                           isSelected ? "bg-accent/30 border border-accent" : "border border-transparent hover:bg-accent/20"
                         )}
                         onClick={() => setEditingSegmentIndex(originalIndex)}
                       >
                         <span className={`font-semibold mr-2 w-full sm:w-auto mb-1 sm:mb-0 ${speakerColorClass} flex-shrink-0 sm:max-w-[150px]`}>
                           {speakerName}:
                         </span>
                         <span className="text-foreground flex-1 pl-0 sm:pl-2">{highlightMatch(segment.line || 'Empty line', searchTerm)}</span>
                       </div>
                     );
                  })
                ) : (
                  <p className="text-muted-foreground italic">No transcript segments available for editing.</p>
                )}
             </div>
           </div>
         );
       }}
      </form.Field>
     )}
    </CardContent>
   </Card>
    <LeaveReviewModal
       podcastId={podcastId}
       podcastTitle={typedPodcast.title ?? 'this podcast'}
       open={isReviewModalOpen}
       setOpen={setIsReviewModalOpen}
       onSuccess={handleReviewSuccess}
    />
  </form>
 );
}