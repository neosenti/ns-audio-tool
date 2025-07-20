// src/lib/types.ts

export interface ProcessedAudio {
  id: string;
  name: string;
  buffer: AudioBuffer;
}

export interface SequenceItem {
  type: "audio";
  audioId: string;
  // The delay *after* this audio plays
  delayMs: number;
}
