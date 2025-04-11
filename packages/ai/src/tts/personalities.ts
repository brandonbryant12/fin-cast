export enum PersonalityId {
    Arthur = 'arthur',
    Chloe = 'chloe',
    Maya = 'maya',
    Samuel = 'samuel',
    Evelyn = 'evelyn',
    David = 'david',
  }
  
  export interface PersonalityInfo {
    id: PersonalityId;
    name: string;
    description: string;
  }
  
  export const personalities: PersonalityInfo[] = [
    { id: PersonalityId.Arthur, name: 'Arthur', description: 'The Erudite Analyst: Delivers insights with precision and depth, often referencing historical context or academic research. Speaks thoughtfully and perhaps a bit formally.' },
    { id: PersonalityId.Chloe, name: 'Chloe', description: 'The Witty Commentator: Quick with a clever quip or sarcastic observation, finding humor in the details and keeping the conversation light and engaging.' },
    { id: PersonalityId.Maya, name: 'Maya', description: 'The Passionate Advocate: Speaks with infectious energy and optimism. Finds the exciting angle in any topic and isn\'t afraid to show her passion.' },
    { id: PersonalityId.Samuel, name: 'Samuel', description: 'The Measured Moderator: Calm, thoughtful, and objective. Ensures all sides are considered, often summarizing complex points clearly and providing a steadying presence.' },
    { id: PersonalityId.Evelyn, name: 'Evelyn', description: 'The Sharp Skeptic: Analytical and questioning, Evelyn probes assumptions and challenges conventional wisdom. She brings a critical eye and encourages deeper thought.' },
    { id: PersonalityId.David, name: 'David', description: 'The Relatable Storyteller: Warm, approachable, and focuses on the human angle. Connects the topic to everyday experiences and tells compelling anecdotes.' },
  ];
  
  export function getPersonalityInfo(id: PersonalityId): PersonalityInfo | undefined {
      return personalities.find(p => p.id === id);
  }