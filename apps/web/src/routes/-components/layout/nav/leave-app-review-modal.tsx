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
import { useMutation, useQueryClient } from '@tanstack/react-query';
 import { toast } from 'sonner';
 import * as v from 'valibot';
import { env } from '@/env';
 import { trpc } from '@/router';
import FormFieldInfo from '@/routes/-components/common/form-field-info';
import Spinner from '@/routes/-components/common/spinner';
import { StarRatingInput } from '@/routes/-components/common/star-rating-input';
 import { reviewSchema } from '@/validations/review-validation';

 const APP_ENTITY_ID = '00000000-0000-0000-0000-000000000000';

interface LeaveAppReviewModalProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    onSuccess?: () => void;
}

export function LeaveAppReviewModal({
    open,
    setOpen,
    onSuccess,
}: LeaveAppReviewModalProps) {
    const queryClient = useQueryClient();
    const appReviewsQueryKey = trpc.reviews.byEntityId.queryOptions({ entityId: APP_ENTITY_ID, contentType: 'app' }).queryKey;

    const addReviewMutation = useMutation({
           ...trpc.reviews.add.mutationOptions(),
           onSuccess: () => {
            toast.success('Review Submitted!', { description: `Thanks for rating ${env.PUBLIC_APP_NAME}.` });
            form.reset();
            queryClient.invalidateQueries({ queryKey: appReviewsQueryKey });
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
                entityId: APP_ENTITY_ID,
                contentType: 'app',
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
                             <DialogTitle>Review {env.PUBLIC_APP_NAME}</DialogTitle>
                             <DialogDescription>
                              Rate your overall experience with the {env.PUBLIC_APP_NAME} application. Feedback is optional.
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
                               onChange: reviewSchema.entries.feedback,
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