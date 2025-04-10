import { Button } from '@repo/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from '@repo/ui/components/popover';
import { Slider } from '@repo/ui/components/slider';
import { cn } from '@repo/ui/lib/utils';
import { Play, Pause, Rewind, FastForward, X, Volume2, Volume1, VolumeX } from 'lucide-react';
import React from 'react';
import { useAudioPlayer, PLAYBACK_RATES } from '@/contexts/audio-player-context';

// Helper to format time in MM:SS
const formatTime = (timeInSeconds: number): string => {
    if (isNaN(timeInSeconds) || timeInSeconds < 0) {
        return '00:00';
    }
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export function AudioPlayer() {
    const {
        activePodcast,
        isPlaying,
        currentTime,
        duration,
        isLoading,
        volume,
        playbackRate,
        play,
        pause,
        seek,
        closePlayer,
        setVolume,
        setPlaybackRate
    } = useAudioPlayer();

    if (!activePodcast) {
        return null;
    }

    const togglePlayPause = () => {
        if (isPlaying) {
            pause();
        } else {
            play();
        }
    };

    const handleSeek = (value: number[]) => {
        if (value && typeof value[0] === 'number') {
             seek(value[0]);
        }
    };

    const handleRewind = () => {
        seek(currentTime - 15);
    };

    const handleFastForward = () => {
        seek(currentTime + 15);
    };

    const controlsDisabled = isLoading || !duration;

    const handleVolumeChange = (value: number[]) => {
        if (value && typeof value[0] === 'number') {
            setVolume(value[0]);
        }
    };

    const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

    const handlePlaybackRateChange = (value: string) => {
        const newRate = parseFloat(value);
        if (PLAYBACK_RATES.includes(newRate as typeof PLAYBACK_RATES[number])) {
            setPlaybackRate(newRate as typeof PLAYBACK_RATES[number]);
        }
    };

    return (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 w-11/12 max-w-2xl z-50 bg-card/80 backdrop-blur-sm border border-border p-3 rounded-lg shadow-lg flex items-center space-x-2">
            <Button
                variant="ghost"
                size="icon"
                onClick={togglePlayPause}
                disabled={controlsDisabled}
                className="text-foreground hover:bg-primary/10 disabled:opacity-50 flex-shrink-0"
                aria-label={isPlaying ? "Pause" : "Play"}
            >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </Button>

            <div className="flex-1 flex flex-col space-y-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate mb-0.5">{activePodcast.title}</p>
                <div className="flex items-center space-x-1.5">
                    <Button variant="ghost" size="icon" onClick={handleRewind} disabled={controlsDisabled} className="text-muted-foreground hover:text-foreground disabled:opacity-50 h-6 w-6 flex-shrink-0" aria-label="Rewind 15 seconds">
                        <Rewind className="h-4 w-4" />
                    </Button>

                    <span className="text-xs font-mono text-muted-foreground w-10 text-right shrink-0">{formatTime(currentTime)}</span>

                     <div className="flex-1 min-w-[60px]">
                        <Slider
                            value={[currentTime]}
                            max={duration || 1}
                            step={0.1}
                            onValueChange={handleSeek}
                            disabled={controlsDisabled}
                            className="w-full [&_[data-slot=slider-thumb]]:size-2.5 [&_[data-slot=slider-track]]:h-0.5 [&_[data-slot=slider-range]]:bg-primary"
                            aria-label="Audio progress"
                        />
                    </div>

                    <span className="text-xs font-mono text-muted-foreground w-10 text-left shrink-0">{formatTime(duration)}</span>

                    <Button variant="ghost" size="icon" onClick={handleFastForward} disabled={controlsDisabled} className="text-muted-foreground hover:text-foreground disabled:opacity-50 h-6 w-6 flex-shrink-0" aria-label="Fast Forward 15 seconds">
                        <FastForward className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        className="text-xs font-mono w-[55px] flex-shrink-0"
                        aria-label={`Playback speed: ${playbackRate}x`}
                    >
                        {playbackRate.toFixed(2)}x
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[100px] min-w-0" sideOffset={6}>
                    <DropdownMenuRadioGroup value={String(playbackRate)} onValueChange={handlePlaybackRateChange}>
                        {PLAYBACK_RATES.map((rate) => (
                            <DropdownMenuRadioItem key={rate} value={String(rate)} className="text-xs font-mono">
                                {rate.toFixed(2)}x
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>

            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground flex-shrink-0" aria-label="Volume">
                         <VolumeIcon className="h-5 w-5" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2 flex justify-center" sideOffset={6}>
                    <Slider
                         defaultValue={[volume]}
                         max={1}
                         step={0.05}
                         orientation="vertical"
                         onValueChange={handleVolumeChange}
                         className="h-24 w-2"
                         aria-label="Volume control"
                     />
                </PopoverContent>
            </Popover>

            <Button
                variant="ghost"
                size="icon"
                onClick={closePlayer}
                className="text-muted-foreground hover:text-foreground hover:bg-red-900/20 flex-shrink-0"
                aria-label="Close player"
            >
                <X className="h-4 w-4" />
            </Button>
        </div>
    );
} 