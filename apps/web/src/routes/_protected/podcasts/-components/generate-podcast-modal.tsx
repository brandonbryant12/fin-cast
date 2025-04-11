import { PersonalityId, type PersonalityInfo } from '@repo/ai';
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@repo/ui/components/select";
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
    availableVoices: PersonalityInfo[] | undefined,
}

const generatePodcastSchema = v.pipe(
    v.object({
        sourceUrl: v.pipe(v.string('Source must be a string'), v.url('Please provide a valid URL')),
        hostPersonalityId: v.enum(PersonalityId, 'Please select a host personality.'),
        cohostPersonalityId: v.enum(PersonalityId, 'Please select a co-host personality.'),
    }),
    v.forward(
        v.check(
            (input) => input.hostPersonalityId !== input.cohostPersonalityId,
            'Host and co-host personalities must be different.'
        ),
        ['cohostPersonalityId']
    )
);


export function GeneratePodcastModal({
    open,
    setOpen,
    onSuccess,
    availableVoices,
}: GeneratePodcastModalProps) {
    console.log('AVailabe', availableVoices)
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
            hostPersonalityId: '' as PersonalityId | '', // Initialize as empty string
            cohostPersonalityId: '' as PersonalityId | '', // Initialize as empty string
        },
        onSubmit: async ({ value }) => {
            // Ensure values are correctly typed before mutation
            if (value.hostPersonalityId && value.cohostPersonalityId) {
                await createPodcastMutation.mutateAsync({
                    sourceUrl: value.sourceUrl,
                    hostPersonalityId: value.hostPersonalityId,
                    cohostPersonalityId: value.cohostPersonalityId,
                });
            } else {
                toast.error("Missing Selection", { description: "Please select both host and co-host personalities."})
            }
        },
        validators: {
            // Use the updated schema for validation
            onChange: generatePodcastSchema,
        },
    });

    const availablePersonalities = availableVoices ?? [];

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-md"> {/* Wider modal */}
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
                            Enter the URL of an article and select the personalities for your podcast hosts.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        {/* URL Input */}
                        <form.Field
                            name="sourceUrl"
                            children={(field) => (
                                <div className="grid grid-cols-4 items-center gap-x-4 gap-y-1">
                                    <Label htmlFor={field.name} className="text-right col-span-1">
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
                                            aria-describedby={field.name + '-info'}
                                            aria-invalid={!!field.state.meta.errors?.length}
                                        />
                                        <FormFieldInfo field={field} />
                                    </div>
                                </div>
                            )}
                        />


                        {/* Host Personality Select */}
                        <form.Field
                            name="hostPersonalityId"
                            children={(field) => (
                                <div className="grid grid-cols-4 items-center gap-x-4 gap-y-1">
                                    <Label htmlFor={field.name} className="text-right col-span-1">
                                        Host Voice
                                    </Label>
                                    <div className="col-span-3">
                                        <Select
                                            name={field.name}
                                            value={field.state.value}
                                            onValueChange={(value) => field.handleChange(value as PersonalityId)}
                                            onOpenChange={(isOpen) => !isOpen && field.handleBlur()}
                                            disabled={availablePersonalities.length === 0}
                                        >
                                            <SelectTrigger id={field.name} aria-describedby={field.name + '-info'}>
                                                <SelectValue placeholder="Select a host personality..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availablePersonalities.map((p) => (
                                                    <SelectItem key={p.id} value={p.id}>
                                                        {p.name} - {p.description}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormFieldInfo field={field} />
                                    </div>
                                </div>
                            )}
                        />

                        <form.Field
                            name="cohostPersonalityId"
                            children={(field) => (
                                <div className="grid grid-cols-4 items-center gap-x-4 gap-y-1">
                                    <Label htmlFor={field.name} className="text-right col-span-1">
                                        Co-host Voice
                                    </Label>
                                    <div className="col-span-3">
                                        <Select
                                            name={field.name}
                                            value={field.state.value}
                                            onValueChange={(value) => field.handleChange(value as PersonalityId)}
                                            onOpenChange={(isOpen) => !isOpen && field.handleBlur()}
                                            disabled={availablePersonalities.length === 0}
                                        >
                                            <SelectTrigger id={field.name} aria-describedby={field.name + '-info'}>
                                                <SelectValue placeholder="Select a co-host personality..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availablePersonalities.map((p) => (
                                                    <SelectItem key={p.id} value={p.id}>
                                                        {p.name} - {p.description}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
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
                                <Button
                                    type="submit"
                                    disabled={
                                        !canSubmit ||
                                        isSubmitting ||
                                        createPodcastMutation.isPending
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