import { PersonalityId } from '@repo/ai';
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
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, Check, Volume2 } from 'lucide-react';
import { useEffect, useMemo } from 'react';
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

const generatePodcastSchema = v.pipe(
    v.object({
        sourceUrl: v.pipe(v.string('Source must be a string'), v.url('Please provide a valid URL')),
        hostPersonalityId: v.pipe(
            v.string('Host ID must be a string.'),
            v.nonEmpty('Please select a host voice.'),
            v.enum(PersonalityId, 'Invalid host personality selected.')
        ),
        cohostPersonalityId: v.pipe(
            v.string('Co-host ID must be a string.'),
            v.nonEmpty('Please select a co-host voice.'),
            v.enum(PersonalityId, 'Invalid co-host personality selected.')
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
    const availableVoicesQuery = useQuery(trpc.tts.getAvailablePersonalities.queryOptions(undefined, {
        enabled: open,
        staleTime: Infinity,
    }));

    // Use useMemo to memoize the availablePersonalities array
    const availablePersonalities = useMemo(() => {
        return availableVoicesQuery.data ?? [];
    }, [availableVoicesQuery.data]);

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
            const result = v.safeParse(generatePodcastSchema, value);

            if (!result.success) {
                const errors: Record<string, any> = {};
                for (const issue of result.issues) {
                    const path = issue.path?.map(p => p.key).join('.');
                    if (path && (path === 'hostPersonalityId' || path === 'cohostPersonalityId' || path === 'sourceUrl')) {
                        errors[path] = issue.message;
                    } else {
                        if (issue.message.includes('must be different')) {
                            errors.hostPersonalityId = issue.message;
                            errors.cohostPersonalityId = issue.message;
                        } else {
                            errors._form = errors._form ? [...errors._form, issue.message] : [issue.message];
                        }
                    }
                }

                toast.error("Validation Error", { description: "Please check the form for errors." });
                return errors;
            }

            await createPodcastMutation.mutateAsync({
                sourceUrl: result.output.sourceUrl,
                hostPersonalityId: result.output.hostPersonalityId,
                cohostPersonalityId: result.output.cohostPersonalityId,
            });
        },
    });

    useEffect(() => {
        if (availableVoicesQuery.isSuccess && availablePersonalities.length > 0) {
            if (!form.state.values.hostPersonalityId && availablePersonalities[0]) {
                form.setFieldValue('hostPersonalityId', availablePersonalities[0].id);
            }
            if (!form.state.values.cohostPersonalityId && availablePersonalities[1]) {
                if (availablePersonalities[0]?.id !== availablePersonalities[1]?.id) {
                    form.setFieldValue('cohostPersonalityId', availablePersonalities[1].id);
                }
            }
        }
    }, [availableVoicesQuery.isSuccess, availablePersonalities, form]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
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
                            Enter the URL of an article and select distinct voices for your podcast hosts. Hover over a name for details.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <form.Field
                            name="sourceUrl"
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
                                {availableVoicesQuery.isLoading && (
                                    <div className="flex items-center justify-center text-muted-foreground p-4">
                                        <Spinner className="mr-2" /> Loading voices...
                                    </div>
                                )}
                                {availableVoicesQuery.isError && (
                                    <div className="flex items-center justify-center text-destructive p-4">
                                        <AlertTriangle className="mr-2 h-4 w-4" /> Error loading voices.
                                    </div>
                                )}
                                {availableVoicesQuery.isSuccess && availablePersonalities.length === 0 && (
                                    <div className="text-center text-muted-foreground p-4">
                                        No voice personalities available.
                                    </div>
                                )}
                                {availableVoicesQuery.isSuccess && availablePersonalities.length > 0 && (
                                    <div className="space-y-2">
                                        {availablePersonalities.map((p) => (
                                            <div key={p.id} className="flex items-center justify-between p-2 rounded hover:bg-input/50">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-muted-foreground hover:text-foreground h-8 w-8 flex-shrink-0"
                                                    onClick={() => console.log('Preview audio for:', p.id /* p.previewAudioUrl */)}
                                                    aria-label={`Preview voice ${p.name}`}
                                                >
                                                    <Volume2 className="h-4 w-4" />
                                                </Button>
                                                <div className="flex flex-1 items-center justify-between ml-2">
                                                    <TooltipProvider delayDuration={100}>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <span className="flex-1 text-sm font-medium text-foreground cursor-default truncate pr-2" title={p.name}>
                                                                    {p.name}
                                                                </span>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="top" align="start">
                                                                <p className="text-xs max-w-xs">{p.description}</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
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
                                                                        variant={hostId === p.id ? 'secondary' : 'outline'}
                                                                        size="sm"
                                                                        onClick={() => {
                                                                            if (cohostId !== p.id) {
                                                                                form.setFieldValue('hostPersonalityId', p.id);
                                                                            }
                                                                        }}
                                                                        aria-checked={hostId === p.id}
                                                                        role="radio"
                                                                        className={cn(
                                                                            "px-3 py-1 text-xs h-auto",
                                                                            hostId === p.id && "ring-2 ring-primary ring-offset-1 ring-offset-background"
                                                                        )}
                                                                    >
                                                                        {hostId === p.id && <Check className="h-3 w-3 mr-1" />}
                                                                        Host
                                                                    </Button>
                                                                    <Button
                                                                        type="button"
                                                                        variant={cohostId === p.id ? 'secondary' : 'outline'}
                                                                        size="sm"
                                                                        onClick={() => {
                                                                            if (hostId !== p.id) {
                                                                                form.setFieldValue('cohostPersonalityId', p.id);
                                                                            }
                                                                        }}
                                                                        aria-checked={cohostId === p.id}
                                                                        role="radio"
                                                                        className={cn(
                                                                            "px-3 py-1 text-xs h-auto",
                                                                            cohostId === p.id && "ring-2 ring-primary ring-offset-1 ring-offset-background"
                                                                        )}
                                                                    >
                                                                         {cohostId === p.id && <Check className="h-3 w-3 mr-1" />}
                                                                         Co-host
                                                                    </Button>
                                                                </>
                                                            )}
                                                        </form.Subscribe>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <form.Subscribe selector={(state) => [
                                state.fieldMeta['hostPersonalityId']?.errors,
                                state.fieldMeta['cohostPersonalityId']?.errors
                            ]}>
                                {([hostErrors, cohostErrors]) => {
                                    const allErrors = [
                                        ...(hostErrors || []),
                                        ...(cohostErrors || []),
                                    ].filter((error, index, self) => error && self.indexOf(error) === index && error.trim() !== '');

                                    return allErrors.length > 0 ? (
                                        <div className="mt-2 text-sm text-destructive space-y-0.5 px-1">
                                            {allErrors.map((error, i) => (
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
                                    disabled={!canSubmit || isSubmitting || createPodcastMutation.isPending}
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