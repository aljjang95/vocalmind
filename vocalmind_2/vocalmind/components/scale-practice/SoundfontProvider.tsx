'use client';

/**
 * react-piano 공식 데모의 SoundfontProvider 패턴.
 * soundfont-player로 MusyngKite acoustic_grand_piano 샘플 로드 + 재생.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import Soundfont, { Player } from 'soundfont-player';

interface Props {
  instrumentName?: string;
  hostname?: string;
  format?: 'mp3' | 'ogg';
  soundfont?: 'MusyngKite' | 'FluidR3_GM';
  audioContext: AudioContext;
  children: (props: {
    isLoading: boolean;
    playNote: (midiNumber: number) => void;
    stopNote: (midiNumber: number) => void;
    stopAllNotes: () => void;
  }) => React.ReactNode;
}

export default function SoundfontProvider({
  instrumentName = 'acoustic_grand_piano',
  hostname = 'https://d1pzp51pvbm36p.cloudfront.net',
  format = 'mp3',
  soundfont = 'MusyngKite',
  audioContext,
  children,
}: Props) {
  const [isLoading, setIsLoading] = useState(true);
  const instrumentRef = useRef<Player | null>(null);
  const activeNodesRef = useRef<Map<number, Player>>(new Map());

  useEffect(() => {
    setIsLoading(true);
    Soundfont.instrument(audioContext, instrumentName, {
      format,
      soundfont,
      nameToUrl: (name: string, sf: string, fmt: string) =>
        `${hostname}/${sf}/${name}-${fmt}.js`,
    }).then((instrument) => {
      instrumentRef.current = instrument;
      setIsLoading(false);
    });
  }, [audioContext, instrumentName, hostname, format, soundfont]);

  const playNote = useCallback((midiNumber: number) => {
    if (!instrumentRef.current) return;
    audioContext.resume();
    const node = instrumentRef.current.play(String(midiNumber), undefined, {
      gain: 2.5,
    });
    activeNodesRef.current.set(midiNumber, node);
  }, [audioContext]);

  const stopNote = useCallback((midiNumber: number) => {
    const node = activeNodesRef.current.get(midiNumber);
    if (node) {
      node.stop();
      activeNodesRef.current.delete(midiNumber);
    }
  }, []);

  const stopAllNotes = useCallback(() => {
    activeNodesRef.current.forEach((node) => node.stop());
    activeNodesRef.current.clear();
  }, []);

  return <>{children({ isLoading, playNote, stopNote, stopAllNotes })}</>;
}
