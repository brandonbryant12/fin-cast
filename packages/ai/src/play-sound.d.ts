declare module 'play-sound' {
  interface PlaySoundOpts {
    // Define any options you might use, e.g.:
    // player?: string;
    // players?: string[];
    // timeout?: number;
    [key: string]: any; // Allow any other options
  }

  interface PlaySound {
    play(
      file: string,
      options?: PlaySoundOpts | ((err: any) => void),
      callback?: (err: any) => void
    ): any; // The return type is typically the child process, can refine if needed
  }

  function playSound(opts?: PlaySoundOpts): PlaySound;

  export default playSound;
} 