import React, { createContext, useState, useRef, useEffect, useCallback, useContext, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { Podcast } from '@/routes/_protected/podcasts/-components/podcast-list-item';
import { usePersistentState } from '@/hooks/use-persistent-state';

type ActivePodcastInfo = Pick<Podcast, 'id' | 'title' | 'audioUrl'>

export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const;
type PlaybackRate = typeof PLAYBACK_RATES[number];

interface AudioPlayerState {
    activePodcast: ActivePodcastInfo | null;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    isLoading: boolean;
    volume: number;
    playbackRate: PlaybackRate;
}

interface AudioPlayerActions {
    loadTrack: (podcast: ActivePodcastInfo, autoPlay?: boolean) => void;
    play: () => void;
    pause: () => void;
    seek: (time: number) => void;
    closePlayer: () => void;
    setVolume: (volume: number) => void;
    setPlaybackRate: (rate: PlaybackRate) => void;
}

type AudioPlayerContextType = AudioPlayerState & AudioPlayerActions;

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined);

interface AudioProviderProps {
    children: ReactNode;
}

const LOCAL_STORAGE_VOLUME_KEY = 'fin_cast_audio_volume';
const LOCAL_STORAGE_RATE_KEY = 'fin_cast_audio_rate';

export const AudioProvider: React.FC<AudioProviderProps> = ({ children }) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [activePodcast, setActivePodcast] = useState<ActivePodcastInfo | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [volume, setVolumeState] = usePersistentState<number>(LOCAL_STORAGE_VOLUME_KEY, 1);
    const [playbackRate, setPlaybackRateState] = usePersistentState<PlaybackRate>(LOCAL_STORAGE_RATE_KEY, 1);

    useEffect(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio();
            audioRef.current.volume = volume;
            audioRef.current.playbackRate = playbackRate;
            audioRef.current.addEventListener('error', () => {
                console.error('Audio Element Error');
                toast.error('Error playing audio');
                setIsPlaying(false);
                setIsLoading(false);
            });
        }
        else {
            if (audioRef.current.volume !== volume) {
                 audioRef.current.volume = volume;
            }
            if (audioRef.current.playbackRate !== playbackRate) {
                audioRef.current.playbackRate = playbackRate;
            }
        }
    }, [volume, playbackRate]);

    const handleTimeUpdate = useCallback(() => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime || 0);
        }
    }, []);

    const handleLoadedMetadata = useCallback(() => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration || 0);
            audioRef.current.playbackRate = playbackRate; // Apply rate here
            setIsLoading(false);
        }
    }, [playbackRate]); // Added playbackRate dependency

    const handleAudioEnded = useCallback(() => {
        setIsPlaying(false);
        // Optionally: Load next track here?
    }, []);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('ended', handleAudioEnded);
        // Remove any existing 'canplay' or 'error' listeners added by loadTrack
        // This requires careful management if handlers aren't memoized or defined outside
        // For simplicity, assuming no stale listeners for now, but could be improved.

        if (activePodcast?.audioUrl) {
            // Don't reset loading/time/duration if src isn't actually changing
            if (audio.src !== activePodcast.audioUrl) {
                 setIsLoading(true);
                 setCurrentTime(0);
                 setDuration(0);
                 audio.src = activePodcast.audioUrl;
                 audio.load();
            }

            audio.addEventListener('timeupdate', handleTimeUpdate);
            audio.addEventListener('loadedmetadata', handleLoadedMetadata);
            audio.addEventListener('ended', handleAudioEnded);

        } else {
            if (audio.src) {
                audio.removeAttribute('src');
                audio.load(); // Important to clear the buffer
            }
            setIsPlaying(false);
            setCurrentTime(0);
            setDuration(0);
            setIsLoading(false);
            setActivePodcast(null); // Ensure state consistency
        }

        // Cleanup function
        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('ended', handleAudioEnded);
            // Consider removing 'canplay'/'error' listeners here too if added dynamically
        };
    }, [activePodcast, handleAudioEnded, handleLoadedMetadata, handleTimeUpdate]);


    const play = useCallback(() => {
        const audio = audioRef.current;
        if (audio && activePodcast) {
            audio.playbackRate = playbackRate; // Set rate before playing
            audio.play()
                .then(() => setIsPlaying(true))
                .catch(e => {
                    console.error("Error playing audio:", e);
                    toast.error("Could not start playback.");
                    setIsPlaying(false);
                });
        }
    }, [activePodcast, playbackRate]); // Added playbackRate dependency

     const pause = useCallback(() => {
        const audio = audioRef.current;
        if (audio) {
            audio.pause();
            setIsPlaying(false);
        }
    }, []);


    const loadTrack = useCallback((podcast: ActivePodcastInfo, autoPlay = true) => {
        const audio = audioRef.current;
        if (!audio) return;

        if (activePodcast?.id === podcast.id) {
             if (autoPlay && !isPlaying) {
                 play();
             } else if (!autoPlay && isPlaying) {
                 pause();
             }
             return;
        }

        setActivePodcast(podcast);
        // State updates like setIsLoading, setCurrentTime, setDuration
        // and setting audio.src + audio.load() are handled by the useEffect watching activePodcast

        if (autoPlay) {
            let canPlayHandler: () => void;
            let loadErrorHandler: () => void;

             canPlayHandler = () => {
                audio.playbackRate = playbackRate; // Set rate before auto-playing
                audio.play()
                    .then(() => setIsPlaying(true))
                    .catch(e => {
                        console.warn("Autoplay failed:", e);
                        setIsPlaying(false);
                    })
                    .finally(() => {
                       audio.removeEventListener('canplay', canPlayHandler);
                       audio.removeEventListener('error', loadErrorHandler); // Also remove error handler
                    });
            };

            loadErrorHandler = () => {
                toast.error('Error loading audio track.');
                setIsLoading(false);
                setActivePodcast(null);
                audio.removeEventListener('canplay', canPlayHandler);
                audio.removeEventListener('error', loadErrorHandler);
            }

            audio.addEventListener('canplay', canPlayHandler, { once: true }); // Use { once: true } for auto-cleanup
            audio.addEventListener('error', loadErrorHandler, { once: true }); // Use { once: true } for auto-cleanup

        } else {
            setIsPlaying(false);
        }

    }, [activePodcast?.id, isPlaying, playbackRate, play, pause]); // Added dependencies


    const seek = useCallback((time: number) => {
        const audio = audioRef.current;
        if (audio && isFinite(time)) {
            const newTime = Math.max(0, Math.min(time, duration || 0));
            // Only update if the time actually changes significantly to avoid choppy seeking
            if (Math.abs(audio.currentTime - newTime) > 0.1) {
                 audio.currentTime = newTime;
            }
            // Optimistically update state, timeupdate event will correct it
            setCurrentTime(newTime);
        }
    }, [duration]);

    const closePlayer = useCallback(() => {
        // setActivePodcast(null) triggers the useEffect cleanup
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

    const setPlaybackRate = useCallback((newRate: PlaybackRate) => {
        const audio = audioRef.current;
        if (PLAYBACK_RATES.includes(newRate)) {
            if (audio) {
                audio.playbackRate = newRate;
            }
            setPlaybackRateState(newRate);
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
        playbackRate,
        loadTrack,
        play,
        pause,
        seek,
        closePlayer,
        setVolume,
        setPlaybackRate,
    };

    return (
        <AudioPlayerContext.Provider value={value}>
            {children}
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