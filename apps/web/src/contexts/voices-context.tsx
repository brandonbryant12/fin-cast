import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, type ReactNode } from 'react';
import { trpc } from '@/router';

export enum PersonalityId {
  Arthur = 'arthur',
  Chloe = 'chloe',
  Maya = 'maya',
  Sam = 'sam',
  Evelyn = 'evelyn',
  David = 'david',
}

export interface PersonalityInfo {
  id: PersonalityId;
  name: string;
  description: string;
  previewPhrase?: string;
  previewAudioUrl?: string;
}


interface VoicesContextType {
  availableVoices: PersonalityInfo[];
  isLoadingVoices: boolean;
  voicesError: Error | null;
}

const VoicesContext = createContext<VoicesContextType | undefined>(undefined);

export function VoicesProvider({ children }: { children: ReactNode }) {
  const { data: availableVoices, isLoading: isLoadingVoices, error: voicesError } = useQuery(
    trpc.tts.getAvailablePersonalities.queryOptions()
  );

  const value = {
    availableVoices: availableVoices ?? [],
    isLoadingVoices,
    voicesError: voicesError as Error | null,
  };

  return <VoicesContext.Provider value={value}>{children}</VoicesContext.Provider>;
}

export function useVoices() {
  const context = useContext(VoicesContext);
  if (context === undefined) {
    throw new Error('useVoices must be used within a VoicesProvider');
  }
  return context;
} 