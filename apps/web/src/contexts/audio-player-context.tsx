import React, { createContext, useState, useRef, useEffect, useCallback, useContext, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { Podcast } from '@/routes/_protected/podcasts/-components/podcast-list-item'; // Assuming Podcast type is exported
import { usePersistentState } from '@/hooks/use-persistent-state';

type ActivePodcastInfo = Pick<Podcast, 'id' | 'title' | 'audioUrl'>

// Define valid playback rates
export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const;
type PlaybackRate = typeof PLAYBACK_RATES[number];

interface AudioPlayerState {
    activePodcast: ActivePodcastInfo | null;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    isLoading: boolean;
    volume: number;
    playbackRate: PlaybackRate; // Added playbackRate state
}

interface AudioPlayerActions {
    loadTrack: (podcast: ActivePodcastInfo, autoPlay?: boolean) => void;
    play: () => void;
    pause: () => void;
    seek: (time: number) => void;
    closePlayer: () => void;
    setVolume: (volume: number) => void;
    setPlaybackRate: (rate: PlaybackRate) => void; // Added playbackRate action
}

type AudioPlayerContextType = AudioPlayerState & AudioPlayerActions;

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined);

interface AudioProviderProps {
    children: ReactNode;
}

const LOCAL_STORAGE_VOLUME_KEY = 'fin_cast_audio_volume';
const LOCAL_STORAGE_RATE_KEY = 'fin_cast_audio_rate'; // Key for playback rate

export const AudioProvider: React.FC<AudioProviderProps> = ({ children }) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [activePodcast, setActivePodcast] = useState<ActivePodcastInfo | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [volume, setVolumeState] = usePersistentState<number>(LOCAL_STORAGE_VOLUME_KEY, 1);
    const [playbackRate, setPlaybackRateState] = usePersistentState<PlaybackRate>(LOCAL_STORAGE_RATE_KEY, 1);

    // Create audio element and set initial volume/rate
    useEffect(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio();
            audioRef.current.volume = volume;
            audioRef.current.playbackRate = playbackRate; // Set initial playback rate
            audioRef.current.addEventListener('error', () => {
                console.error('Audio Element Error');
                toast.error('Error playing audio');
                setIsPlaying(false);
                setIsLoading(false);
            });
             // Add listeners for volume/rate changes? Maybe not necessary if controlled via context
        }
        // Ensure rate is updated if it changes (e.g., loaded from storage after mount)
        else {
            if (audioRef.current.playbackRate !== playbackRate) {
                audioRef.current.playbackRate = playbackRate;
            }
        }
    }, [volume, playbackRate]); // Add playbackRate to dependency array

    const handleTimeUpdate = useCallback(() => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime || 0);
        }
    }, []);

    const handleLoadedMetadata = useCallback(() => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration || 0);
            setIsLoading(false);
        }
    }, []);

    const handleAudioEnded = useCallback(() => {
        setIsPlaying(false);
    }, []);

    // Effect to manage audio source and listeners based on activePodcast
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('ended', handleAudioEnded);

        if (activePodcast?.audioUrl) {
            setIsLoading(true);
            setCurrentTime(0);
            setDuration(0);

            if (audio.src !== activePodcast.audioUrl) {
                audio.src = activePodcast.audioUrl;
                audio.load();
            }

            audio.addEventListener('timeupdate', handleTimeUpdate);
            audio.addEventListener('loadedmetadata', handleLoadedMetadata);
            audio.addEventListener('ended', handleAudioEnded);

        } else {
            audio.removeAttribute('src');
            audio.load();
            setIsPlaying(false);
            setCurrentTime(0);
            setDuration(0);
            setIsLoading(false);
        }

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('ended', handleAudioEnded);
        };
    }, [activePodcast, handleAudioEnded, handleLoadedMetadata, handleTimeUpdate]);

    const loadTrack = useCallback((podcast: ActivePodcastInfo, autoPlay = true) => {
        const audio = audioRef.current;
        if (!audio) return;

        setActivePodcast(podcast);

        if (autoPlay) {
            setTimeout(() => {
                audio.play()
                    .then(() => setIsPlaying(true))
                    .catch(e => {
                        console.warn("Autoplay failed:", e);
                        setIsPlaying(false);
                    });
            }, 50);
        } else {
            setIsPlaying(false);
        }

    }, []);

    const play = useCallback(() => {
        const audio = audioRef.current;
        if (audio && activePodcast) {
            audio.play()
                .then(() => setIsPlaying(true))
                .catch(e => {
                    console.error("Error playing audio:", e);
                    toast.error("Could not start playback.");
                    setIsPlaying(false);
                });
        }
    }, [activePodcast]);

    const pause = useCallback(() => {
        const audio = audioRef.current;
        if (audio) {
            audio.pause();
            setIsPlaying(false);
        }
    }, []);

    const seek = useCallback((time: number) => {
        const audio = audioRef.current;
        if (audio && isFinite(time)) {
            const newTime = Math.max(0, Math.min(time, duration || 0));
            audio.currentTime = newTime;
            setCurrentTime(newTime);
        }
    }, [duration]);

    const closePlayer = useCallback(() => {
        const audio = audioRef.current;
        if (audio) {
            audio.pause();
        }
        setActivePodcast(null);
    }, []);

    const setVolume = useCallback((newVolume: number) => {
        const audio = audioRef.current;
        const clampedVolume = Math.max(0, Math.min(newVolume, 1));
        if (audio) {
            audio.volume = clampedVolume;
        }
        setVolumeState(clampedVolume);
    }, [setVolumeState]);

    // New setPlaybackRate action
    const setPlaybackRate = useCallback((newRate: PlaybackRate) => {
        const audio = audioRef.current;
        // Ensure the rate is one of the allowed values
        if (PLAYBACK_RATES.includes(newRate)) {
            if (audio) {
                audio.playbackRate = newRate;
            }
            setPlaybackRateState(newRate); // Update state and localStorage via hook
        } else {
            console.warn(`Attempted to set invalid playback rate: ${newRate}`);
        }
    }, [setPlaybackRateState]);

    const value: AudioPlayerContextType = {
        activePodcast,
        isPlaying,
        currentTime,
        duration,
        isLoading,
        volume,
        playbackRate, // Provide playbackRate state
        loadTrack,
        play,
        pause,
        seek,
        closePlayer,
        setVolume,
        setPlaybackRate, // Provide playbackRate action
    };

    return (
        <AudioPlayerContext.Provider value={value}>
            {children}
            {/* The actual audio element is managed here, but not rendered visibly */}
        </AudioPlayerContext.Provider>
    );
};

export const useAudioPlayer = (): AudioPlayerContextType => {
    const context = useContext(AudioPlayerContext);
    if (context === undefined) {
        throw new Error('useAudioPlayer must be used within an AudioProvider');
    }
    return context;
}; 