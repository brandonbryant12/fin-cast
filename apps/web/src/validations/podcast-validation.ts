import * as v from 'valibot';
import { PersonalityId } from '@/contexts/voices-context';

export const generatePodcastSchema = v.pipe(
  v.object({
    sourceUrl: v.pipe(v.string('Source must be a string'), v.url('Please provide a valid URL')),
    hostPersonalityId: v.pipe(
      v.string('Host ID must be a string.'),
      v.nonEmpty('Please select a host voice.'),
      v.custom<PersonalityId>((input) => Object.values(PersonalityId).includes(input as PersonalityId), 'Invalid host personality selected.')
    ),
    cohostPersonalityId: v.pipe(
      v.string('Co-host ID must be a string.'),
      v.nonEmpty('Please select a co-host voice.'),
      v.custom<PersonalityId>((input) => Object.values(PersonalityId).includes(input as PersonalityId), 'Invalid co-host personality selected.')
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