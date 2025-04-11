import { PersonalityId } from './personalities';

export const previewUrls: Partial<Record<PersonalityId, string | undefined>> = {
  [PersonalityId.Arthur]: 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAA...', // Voice: Arthur (truncated for example)
  [PersonalityId.Chloe]: 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//tQAAAAA...', // Voice: Chloe (truncated for example)
  [PersonalityId.Maya]: 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQxAAAAAAAH...', // Voice: Maya (truncated for example)
  [PersonalityId.Sam]: 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQxAAAA...', // Voice: Sam (truncated for example)
  [PersonalityId.Evelyn]: 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAA...', // Voice: Evelyn (truncated for example)
  [PersonalityId.David]: 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAA...'
};