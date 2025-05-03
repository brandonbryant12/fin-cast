import * as v from 'valibot';

export const reviewSchema = v.object({
  stars: v.pipe(
    v.number('Rating is required.'),
    v.integer('Rating must be a whole number.'),
    v.minValue(1, 'Rating must be at least 1 star.'),
    v.maxValue(5, 'Rating cannot be more than 5 stars.')
  ),
  feedback: v.optional(
    v.pipe(
        v.string(),
        v.maxLength(400, 'Feedback cannot exceed 400 characters.')
    ),
    '' // Default to empty string if optional
  ),
});

export type ReviewFormData = v.InferInput<typeof reviewSchema>;