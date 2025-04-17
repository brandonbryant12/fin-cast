import React, {
    createContext,
    useState,
    useRef,
    useEffect,
    useCallback,
    useContext,
    type ReactNode,
  } from 'react';
  import { toast } from 'sonner';
  import type { Podcast } from '@/routes/_protected/podcasts/-components/podcast-list-item';
  import { usePersistentState } from '@/hooks/use-persistent-state';
  
  type ActivePodcastInfo = Pick<Podcast, 'id' | 'title' | 'audioUrl'>;
  
  export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const;
  export type PlaybackRate = typeof PLAYBACK_RATES[number];
  
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
  
  const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(
    undefined,
  );
  
  interface AudioProviderProps {
    children: ReactNode;
  }
  
  const LOCAL_STORAGE_VOLUME_KEY = 'fin_cast_audio_volume';
  const LOCAL_STORAGE_RATE_KEY = 'fin_cast_audio_rate';
  
  const isValidVolume = (v: unknown): v is number =>
    typeof v === 'number' && v >= 0 && v <= 1;
  
  const isValidRate = (r: unknown): r is PlaybackRate =>
    typeof r === 'number' && (PLAYBACK_RATES as readonly number[]).includes(r);
  
  export const AudioProvider: React.FC<AudioProviderProps> = ({ children }) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
  
    // Core dynamic state
    const [activePodcast, setActivePodcast] =
      useState<ActivePodcastInfo | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
  
    // Persistent state w/ validation
    const [volume, setVolumeState] = usePersistentState<number>(
      LOCAL_STORAGE_VOLUME_KEY,
      1,
      isValidVolume,
    );
    const [playbackRate, setPlaybackRateState] = usePersistentState<PlaybackRate>(
      LOCAL_STORAGE_RATE_KEY,
      1,
      isValidRate,
    );
  
    // ────────────────────────────────
    // Initialise the <audio> element
    // ────────────────────────────────
    useEffect(() => {
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      audioRef.current.volume = volume;
      audioRef.current.playbackRate = playbackRate;
  
      audioRef.current.addEventListener('error', () => {
        console.error('Audio Element Error');
        toast.error('Error playing audio');
        setIsPlaying(false);
        setIsLoading(false);
      });
    }, []); // (run once)
  
    // Keep volume / rate in sync
    useEffect(() => {
      if (audioRef.current) {
        audioRef.current.volume = volume;
        audioRef.current.playbackRate = playbackRate;
      }
    }, [volume, playbackRate]);
  
    // ────────────────────────────────
    // Event handlers
    // ────────────────────────────────
    const handleTimeUpdate = useCallback(() => {
      if (audioRef.current) setCurrentTime(audioRef.current.currentTime || 0);
    }, []);
  
    const handleLoadedMetadata = useCallback(() => {
      if (audioRef.current) {
        setDuration(audioRef.current.duration || 0);
        audioRef.current.playbackRate = playbackRate;
        setIsLoading(false);
      }
    }, [playbackRate]);
  
    const handleAudioEnded = useCallback(() => {
      setIsPlaying(false);
    }, []);
  
    // Attach / detach listeners whenever track changes
    useEffect(() => {
      const audio = audioRef.current;
      if (!audio) return;
  
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleAudioEnded);
  
      if (activePodcast?.audioUrl) {
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
          audio.load();
        }
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
    }, [activePodcast, handleTimeUpdate, handleLoadedMetadata, handleAudioEnded]);
  
    // ────────────────────────────────
    // Public controls
    // ────────────────────────────────
    const play = useCallback(() => {
      const audio = audioRef.current;
      if (audio && activePodcast) {
        audio.playbackRate = playbackRate;
        audio
          .play()
          .then(() => setIsPlaying(true))
          .catch(e => {
            console.error('Error playing audio:', e);
            toast.error('Could not start playback.');
            setIsPlaying(false);
          });
      }
    }, [activePodcast, playbackRate]);
  
    const pause = useCallback(() => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        setIsPlaying(false);
      }
    }, []);
  
    const loadTrack = useCallback(
      (podcast: ActivePodcastInfo, autoPlay = true) => {
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
  
        if (autoPlay) {
          const onCanPlay = () => {
            audio.playbackRate = playbackRate;
            audio
              .play()
              .then(() => setIsPlaying(true))
              .catch(e => {
                console.warn('Autoplay failed:', e);
                setIsPlaying(false);
              })
              .finally(() => {
                audio.removeEventListener('canplay', onCanPlay);
                audio.removeEventListener('error', onError);
              });
          };
  
          const onError = () => {
            toast.error('Error loading audio track.');
            setIsLoading(false);
            setActivePodcast(null);
            audio.removeEventListener('canplay', onCanPlay);
            audio.removeEventListener('error', onError);
          };
  
          audio.addEventListener('canplay', onCanPlay, { once: true });
          audio.addEventListener('error', onError, { once: true });
        } else {
          setIsPlaying(false);
        }
      },
      [activePodcast?.id, isPlaying, playbackRate, play, pause],
    );
  
    const seek = useCallback(
      (time: number) => {
        const audio = audioRef.current;
        if (audio && isFinite(time)) {
          const newTime = Math.max(0, Math.min(time, duration || 0));
          if (Math.abs(audio.currentTime - newTime) > 0.1) {
            audio.currentTime = newTime;
          }
          setCurrentTime(newTime);
        }
      },
      [duration],
    );
  
    const closePlayer = useCallback(() => {
      setActivePodcast(null);
    }, []);
  
    const setVolume = useCallback(
      (v: number) => {
        const clamped = Math.max(0, Math.min(v, 1));
        if (audioRef.current) audioRef.current.volume = clamped;
        setVolumeState(clamped);
      },
      [setVolumeState],
    );
  
    const setPlaybackRate = useCallback(
      (r: PlaybackRate) => {
        if (isValidRate(r)) {
          if (audioRef.current) audioRef.current.playbackRate = r;
          setPlaybackRateState(r);
        } else {
          console.warn(`Attempted to set invalid playback rate: ${r}`);
        }
      },
      [setPlaybackRateState],
    );

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
    const ctx = useContext(AudioPlayerContext);
    if (!ctx) {
      throw new Error('useAudioPlayer must be used within an AudioProvider');
    }
    return ctx;
  };
  