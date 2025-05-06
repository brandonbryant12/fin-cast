import { Button } from '@repo/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog';
import { Label } from '@repo/ui/components/label';
import { Textarea } from '@repo/ui/components/textarea';
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as v from 'valibot';
import { trpc } from '@/router';
import FormFieldInfo from '@/routes/-components/common/form-field-info';
import Spinner from '@/routes/-components/common/spinner';
import { StarRatingInput } from '@/routes/-components/common/star-rating-input';
import { reviewSchema } from '@/validations/review-validation';

interface LeaveReviewModalProps {
  podcastId: string;
  podcastTitle: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  onSuccess?: () => void;
}

export function LeaveReviewModal({
  podcastId,
  podcastTitle,
  open,
  setOpen,
  onSuccess,
}: LeaveReviewModalProps) {

  const addReviewMutation = useMutation({
    ...trpc.reviews.add.mutationOptions(),
    onSuccess: () => {
      toast.success('Review Submitted!', { description: `Thanks for rating "${podcastTitle}".` });
      form.reset();
      onSuccess?.();
      setOpen(false);
    },
    onError: (error) => {
      toast.error('Failed to Submit Review', {
        description: error.message || 'Could not save your review.',
      });
    },
  });

  const form = useForm({
    defaultValues: {
      stars: 0,
      feedback: '',
    },
    onSubmit: async ({ value }) => {
       const validationResult = v.safeParse(reviewSchema, value);
       if (!validationResult.success) {
         toast.error('Validation Error', { description: 'Please check your input.' });
         return;
       }

      addReviewMutation.mutate({
        entityId: podcastId,
        contentType: 'podcast',
        stars: validationResult.output.stars,
        feedback: validationResult.output.feedback,
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle>Leave a Review</DialogTitle>
            <DialogDescription>
              Rate your experience with "{podcastTitle}". Feedback is optional.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
             <form.Field
              name="stars"
              validators={{
                onChange: reviewSchema.entries.stars
              }}
              children={(field) => (
                <div className="space-y-1">
                  <Label htmlFor={field.name}>Rating</Label>
                   <StarRatingInput
                      value={field.state.value}
                      onChange={field.handleChange}
                      size={28}
                      className="mt-1"
                   />
                   <FormFieldInfo field={field} />
                 </div>
              )}
            />
            <form.Field
                name="feedback"
                validators={{
                 onChange: ({ value }) => {
                   const result = v.safeParse(reviewSchema.entries.feedback, value);
                   return result.success ? undefined : result.issues[0]?.message;
                 },
                }}
                children={(field) => (
                 <div className="space-y-1">
                    <Label htmlFor={field.name}>Additional Feedback (Optional)</Label>
                    <Textarea
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Tell us what you think..."
                      rows={4}
                      maxLength={400}
                      className="bg-input"
                    />
                    <FormFieldInfo field={field} />
                 </div>
                )}
            />
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
                  disabled={!canSubmit || isSubmitting || addReviewMutation.isPending}
                >
                  {addReviewMutation.isPending || isSubmitting ? (
                    <><Spinner className="mr-2" /> Submitting...</>
                  ) : (
                    'Submit Review'
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