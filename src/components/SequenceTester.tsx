// src/components/SequenceTester.tsx

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Dropzone from "react-dropzone";
import localforage from "localforage";
import WaveSurfer from "wavesurfer.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Trash2,
  Play,
  PlusCircle,
  GripVertical,
  Square,
  ArrowDown,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// =================================================================================
// Types
// =================================================================================
interface TesterAudioClip {
  id: string; // Unique ID for the uploaded clip
  name: string;
  buffer: AudioBuffer;
}

interface SequenceItem {
  id: string; // Unique ID for the item *in the sequence*
  audioId: string; // ID of the clip from the `clips` array
  delayAfter: number; // The delay in ms that follows this audio
}

interface StoredClipData {
  id: string;
  name: string;
  data: ArrayBuffer;
}

// =================================================================================
// Constants
// =================================================================================
const CLIPS_STORAGE_KEY = "audio_tool_clips_v3";
const SEQUENCE_STORAGE_KEY = "audio_tool_sequence_v3";

// =================================================================================
// Helper Function
// =================================================================================
const bufferToWave = (abuffer: AudioBuffer): Blob => {
  const numOfChan = abuffer.numberOfChannels;
  const L = abuffer.length * numOfChan * 2 + 44;
  const buffer = new ArrayBuffer(L);
  const view = new DataView(buffer);
  const channels = [];
  let i,
    sample,
    offset = 0,
    pos = 0;
  setUint32(0x46464952);
  setUint32(L - 8);
  setUint32(0x45564157);
  setUint32(0x20746d66);
  setUint32(16);
  setUint16(1);
  setUint16(numOfChan);
  setUint32(abuffer.sampleRate);
  setUint32(abuffer.sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2);
  setUint16(16);
  setUint32(0x61746164);
  setUint32(L - pos - 4);
  for (i = 0; i < abuffer.numberOfChannels; i++)
    channels.push(abuffer.getChannelData(i));
  while (pos < L) {
    for (i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }
  return new Blob([view], { type: "audio/wav" });
  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }
  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
};

// =================================================================================
// Sortable Audio Item Component
// =================================================================================
const SortableAudioItem = ({
  id,
  clip,
  isPlaying,
  onRemove,
}: {
  id: string;
  clip?: TesterAudioClip;
  isPlaying: boolean;
  onRemove: () => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    zIndex: isDragging ? 10 : "auto",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 p-2 bg-background border rounded-lg touch-none relative transition-all",
        isPlaying &&
          "ring-2 ring-primary ring-offset-2 ring-offset-background border-primary",
        isDragging && "opacity-50",
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab p-1 hover:bg-muted rounded"
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </button>
      <div className="flex-grow font-medium truncate">
        {clip?.name || "Audio not found"}
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};

// =================================================================================
// Delay Control Component (Updated)
// =================================================================================
const DelayControl = ({
  value,
  onUpdate,
}: {
  value: number;
  onUpdate: (newValue: number) => void;
}) => {
  const [localValue, setLocalValue] = useState(value.toString());

  // Sync with prop changes
  useEffect(() => {
    setLocalValue(value.toString());
  }, [value]);

  const commitChange = () => {
    const num = parseInt(localValue, 10);
    if (!isNaN(num)) {
      onUpdate(num);
      setLocalValue(num.toString());
    } else {
      setLocalValue(value.toString()); // Revert if invalid
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-2 gap-1">
      <div className="h-3 w-px bg-border"></div>
      <div className="relative flex items-center">
        <Input
          type="number"
          className="w-24 h-8 text-center pr-8 text-xs font-mono"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={commitChange}
          onKeyDown={handleKeyDown}
        />
        <span className="absolute right-3 text-[10px] text-muted-foreground pointer-events-none select-none">
          ms
        </span>
      </div>
      <div className="h-3 w-px bg-border"></div>
      <ArrowDown className="h-3 w-3 text-muted-foreground/50" />
    </div>
  );
};

// =================================================================================
// Playback Visualizer Component
// =================================================================================
const PlaybackVisualizer = ({ clip }: { clip: TesterAudioClip | null }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  useEffect(() => {
    if (containerRef.current) {
      wavesurferRef.current = WaveSurfer.create({
        container: containerRef.current,
        height: 100,
        waveColor: "black",
        progressColor: "white",
        barWidth: 3,
        barRadius: 3,
        barGap: 2,
        interact: false,
      });
    }
    return () => wavesurferRef.current?.destroy();
  }, []);
  useEffect(() => {
    if (wavesurferRef.current && clip) {
      const blob = bufferToWave(clip.buffer);
      const url = URL.createObjectURL(blob);
      wavesurferRef.current.load(url).then(() => {
        URL.revokeObjectURL(url);
      });
    }
  }, [clip]);
  if (!clip) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Now Playing: {clip.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={containerRef} />
      </CardContent>
    </Card>
  );
};

// =================================================================================
// Main Sequence Tester Component
// =================================================================================
const SequenceTester = () => {
  const [clips, setClips] = useState<TesterAudioClip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sequence, setSequence] = useState<SequenceItem[]>(() => {
    const savedSequence = localStorage.getItem(SEQUENCE_STORAGE_KEY);
    return savedSequence ? JSON.parse(savedSequence) : [];
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentlyPlayingSequenceItemId, setCurrentlyPlayingSequenceItemId] =
    useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scheduledTimeoutsRef = useRef<NodeJS.Timeout[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    localforage.config({ name: "audioTool" });
    async function loadClips() {
      setIsLoading(true);
      const savedClipsData =
        await localforage.getItem<StoredClipData[]>(CLIPS_STORAGE_KEY);
      if (savedClipsData) {
        const audioContext = new AudioContext();
        const loadedClips: TesterAudioClip[] = [];
        for (const clipData of savedClipsData) {
          try {
            const buffer = await audioContext.decodeAudioData(
              clipData.data.slice(0),
            );
            loadedClips.push({ id: clipData.id, name: clipData.name, buffer });
          } catch (e) {
            console.error("Failed to decode saved audio data", e);
          }
        }
        setClips(loadedClips);
      }
      setIsLoading(false);
    }
    loadClips();
  }, []);

  useEffect(() => {
    localStorage.setItem(SEQUENCE_STORAGE_KEY, JSON.stringify(sequence));
  }, [sequence]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const audioContext = new AudioContext();
    const newClipsPromises = acceptedFiles.map(
      (file) =>
        new Promise<{ clip: TesterAudioClip; dataToSave: StoredClipData }>(
          (resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
              if (e.target?.result) {
                const arrayBuffer = e.target.result as ArrayBuffer;
                try {
                  const buffer = await audioContext.decodeAudioData(
                    arrayBuffer.slice(0),
                  );
                  const newClip = {
                    id: `${file.name}-${Date.now()}`,
                    name: file.name,
                    buffer,
                  };
                  const dataToSave = {
                    id: newClip.id,
                    name: newClip.name,
                    data: arrayBuffer,
                  };
                  resolve({ clip: newClip, dataToSave });
                } catch (err) {
                  reject(err);
                }
              } else {
                reject(new Error("FileReader error"));
              }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
          },
        ),
    );
    try {
      const results = await Promise.all(newClipsPromises);
      setClips((prev) => [...prev, ...results.map((r) => r.clip)]);
      const currentSaved =
        (await localforage.getItem<StoredClipData[]>(CLIPS_STORAGE_KEY)) || [];
      await localforage.setItem(CLIPS_STORAGE_KEY, [
        ...currentSaved,
        ...results.map((r) => r.dataToSave),
      ]);
    } catch (error) {
      alert("One or more files could not be processed.");
    }
  }, []);

  const addAudioToSequence = (clip: TesterAudioClip) => {
    const newSequenceItem: SequenceItem = {
      id: `seq_item_${Date.now()}`,
      audioId: clip.id,
      delayAfter: 100,
    };
    setSequence((prev) => [...prev, newSequenceItem]);
  };

  const removeFromSequence = (idToRemove: string) => {
    setSequence((prev) => prev.filter((item) => item.id !== idToRemove));
  };

  // Remove clip from available list AND local storage
  const deleteAvailableClip = async (clipId: string) => {
    // 1. Remove from state
    setClips((prev) => prev.filter((c) => c.id !== clipId));

    // 2. Remove from storage
    const currentSaved =
      (await localforage.getItem<StoredClipData[]>(CLIPS_STORAGE_KEY)) || [];
    const newSaved = currentSaved.filter((c) => c.id !== clipId);
    await localforage.setItem(CLIPS_STORAGE_KEY, newSaved);

    // 3. Remove from current sequence if present
    setSequence((prev) => prev.filter((item) => item.audioId !== clipId));
  };

  const updateDelay = (idToUpdate: string, delay: number) => {
    setSequence((prev) =>
      prev.map((item) =>
        item.id === idToUpdate ? { ...item, delayAfter: delay } : item,
      ),
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSequence((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const stopPlayback = () => {
    if (audioContextRef.current?.state !== "closed") {
      audioContextRef.current?.close();
    }
    scheduledTimeoutsRef.current.forEach(clearTimeout);
    scheduledTimeoutsRef.current = [];
    setIsPlaying(false);
    setCurrentlyPlayingSequenceItemId(null);
  };

  const playSequence = () => {
    if (isPlaying) {
      stopPlayback();
      return;
    }
    setIsPlaying(true);
    setCurrentlyPlayingSequenceItemId(null);
    audioContextRef.current = new AudioContext();
    let startTime = audioContextRef.current.currentTime + 0.1;

    sequence.forEach((item, index) => {
      const audio = clips.find((c) => c.id === item.audioId);
      if (audio) {
        const source = audioContextRef.current!.createBufferSource();
        source.buffer = audio.buffer;
        source.connect(audioContextRef.current!.destination);
        source.start(startTime);
        const visualizerDelay =
          (startTime - audioContextRef.current!.currentTime) * 1000;
        scheduledTimeoutsRef.current.push(
          setTimeout(
            () => setCurrentlyPlayingSequenceItemId(item.id),
            visualizerDelay,
          ),
        );
        startTime += audio.buffer.duration;
        if (index < sequence.length - 1) {
          startTime += item.delayAfter / 1000;
        }
      }
    });

    const finalClearDelay =
      (startTime - audioContextRef.current.currentTime) * 1000;
    scheduledTimeoutsRef.current.push(
      setTimeout(stopPlayback, finalClearDelay + 50),
    );
  };

  const currentlyPlayingSequenceItem = sequence.find(
    (item) => item.id === currentlyPlayingSequenceItemId,
  );
  const currentlyPlayingClip = currentlyPlayingSequenceItem
    ? clips.find((c) => c.id === currentlyPlayingSequenceItem.audioId) || null
    : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Upload Processed Clips</CardTitle>
        </CardHeader>
        <CardContent>
          <Dropzone onDrop={onDrop} accept={{ "audio/*": [] }}>
            {({ getRootProps, getInputProps }) => (
              <div
                {...getRootProps()}
                className="flex items-center justify-center w-full p-10 border-2 border-dashed rounded-lg cursor-pointer border-muted hover:border-primary transition-colors"
              >
                <input {...getInputProps()} />
                <p>Drop your processed audio files here</p>
              </div>
            )}
          </Dropzone>
          {isLoading ? (
            <p className="mt-4">Loading saved clips...</p>
          ) : (
            clips.length > 0 && (
              <div className="mt-4 space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                  Available Clips
                </h3>
                <div className="flex flex-wrap gap-2">
                  {clips.map((clip) => (
                    <div
                      key={clip.id}
                      className="flex items-center group bg-muted/50 rounded-md border pl-1 pr-1 py-1"
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 font-normal"
                        onClick={() => addAudioToSequence(clip)}
                      >
                        <PlusCircle className="mr-2 h-3 w-3" /> {clip.name}
                      </Button>
                      <div className="w-px h-4 bg-border mx-1"></div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => deleteAvailableClip(clip.id)}
                        title="Delete clip"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </CardContent>
      </Card>

      {sequence.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>2. Build and Play Sequence</CardTitle>
            <Button onClick={playSequence} size="lg" className="w-40">
              {isPlaying ? (
                <Square className="mr-2 h-4 w-4 fill-current" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              {isPlaying ? "Stop" : "Play Sequence"}
            </Button>
          </CardHeader>
          <CardContent>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <div className="flex flex-col">
                <SortableContext
                  items={sequence.map((i) => i.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {sequence.map((item, index) => {
                    const clip = clips.find((c) => c.id === item.audioId);
                    return (
                      <React.Fragment key={item.id}>
                        <SortableAudioItem
                          id={item.id}
                          clip={clip}
                          onRemove={() => removeFromSequence(item.id)}
                          isPlaying={item.id === currentlyPlayingSequenceItemId}
                        />
                        {index < sequence.length - 1 && (
                          <DelayControl
                            value={item.delayAfter}
                            onUpdate={(newValue) =>
                              updateDelay(item.id, newValue)
                            }
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </SortableContext>
              </div>
            </DndContext>
          </CardContent>
        </Card>
      )}
      <PlaybackVisualizer
        key={currentlyPlayingSequenceItemId}
        clip={currentlyPlayingClip}
      />
    </div>
  );
};

export default SequenceTester;
