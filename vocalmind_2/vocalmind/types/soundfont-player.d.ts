declare module 'soundfont-player' {
  interface Player {
    play: (note: string, time?: number, options?: { gain?: number; duration?: number }) => Player;
    stop: (time?: number) => void;
    on: (event: string, callback: () => void) => void;
  }

  interface InstrumentOptions {
    format?: 'mp3' | 'ogg';
    soundfont?: 'MusyngKite' | 'FluidR3_GM';
    nameToUrl?: (name: string, soundfont: string, format: string) => string;
    gain?: number;
  }

  function instrument(
    ac: AudioContext,
    name: string,
    options?: InstrumentOptions,
  ): Promise<Player>;

  export { Player, InstrumentOptions };
  export default { instrument };
}
