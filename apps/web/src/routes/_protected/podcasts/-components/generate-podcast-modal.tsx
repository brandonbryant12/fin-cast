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
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as v from 'valibot';
import { trpc } from '@/router';
import FormFieldInfo from '@/routes/-components/common/form-field-info';
import Spinner from '@/routes/-components/common/spinner';

interface GeneratePodcastModalProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    onSuccess: () => void;
}

const podcastUrlSchema = v.object({
    sourceUrl: v.pipe(
        v.string(),
        v.minLength(1, 'Please enter a URL.'),
        v.url('Please enter a valid URL (e.g., https://example.com).'),
    ),
});

export function GeneratePodcastModal({ open, setOpen, onSuccess }: GeneratePodcastModalProps) {
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
        },
        onSubmit: async ({ value }) => {
            await createPodcastMutation.mutateAsync({
                sourceUrl: value.sourceUrl,
            });
        },
        validators: {
            onChange: podcastUrlSchema,
        },
    });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-[425px]">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void form.handleSubmit();
                    }}
                >
                    <DialogHeader>
                        <DialogTitle>Generate Podcast from URL</DialogTitle>
                        <DialogDescription>
                            Enter the URL of an article or web page you want to turn into a podcast.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <form.Field
                            name="sourceUrl"
                            children={(field) => (
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor={field.name} className="text-right">
                                        Article URL
                                    </Label>
                                    <div className="col-span-3">
                                        <Input
                                            id={field.name}
                                            name={field.name}
                                            value={field.state.value}
                                            onBlur={field.handleBlur}
                                            onChange={(e) => field.handleChange(e.target.value)}
                                            placeholder="https://example.com/article"
                                            className="col-span-3"
                                            aria-describedby={field.name + '-info'}
                                            aria-invalid={!!field.state.meta.errors?.length}
                                        />
                                        <FormFieldInfo field={field} />
                                    </div>
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
                                <Button type="submit" disabled={!canSubmit || isSubmitting || createPodcastMutation.isPending}>
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