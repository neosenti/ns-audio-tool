// src/lib/types.ts

// A union type for items in our sequence
export type SequenceItem =
  | { type: "audio"; id: string; audioId: string }
  | { type: "delay"; id: string; value: number };

// This can be removed if not used elsewhere, as SequenceTester has its own local types now.
export interface ProcessedAudio {
  id: string;
  name: string;
  buffer: AudioBuffer;
}
