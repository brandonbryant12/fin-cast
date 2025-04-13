import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, type ReactNode } from 'react';

import type { AppRouter } from '@repo/api/server';
import type { inferRouterOutputs } from '@trpc/server';
import { trpc } from '@/router';

type PersonalitiesOutput = inferRouterOutputs<AppRouter>['podcasts']['getAvailablePersonalities'];
export type PersonalityInfo = PersonalitiesOutput[number];


export enum PersonalityId {
  Arthur = 'Arthur',
  Chloe = 'Chloe',
  Maya = 'Maya',
  Sam = 'Sam',
  Evelyn = 'Evelyn',
  David = 'David',
}

interface VoicesContextType {
  availableVoices: PersonalityInfo[];
  isLoadingVoices: boolean;
  voicesError: Error | null;
}

const VoicesContext = createContext<VoicesContextType | undefined>(undefined);

export function VoicesProvider({ children }: { children: ReactNode }) {
  const { data: availableVoices, isLoading: isLoadingVoices, error: voicesError } = useQuery(
    trpc.podcasts.getAvailablePersonalities.queryOptions()
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