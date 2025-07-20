// src/components/SequenceTester.tsx
import { useState, useCallback, useEffect } from "react";
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
import { type SequenceItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Trash2,
  Play,
  PlusCircle,
  GripVertical,
  ChevronsUpDown,
} from "lucide-react";

// Local type for audio clips within this component
interface TesterAudioClip {
  id: string;
  name: string;
  buffer: AudioBuffer;
}

// Local type for storing raw audio data
interface StoredClipData {
  id: string;
  name: string;
  data: ArrayBuffer;
}

// --- Local Storage Keys ---
const CLIPS_STORAGE_KEY = "audio_tool_clips_v2";
const SEQUENCE_STORAGE_KEY = "audio_tool_sequence_v2";

// --- Delay Options ---
const delayOptions = Array.from({ length: 11 }, (_, i) => (i - 5) * 100).map(
  (v) => ({ value: v.toString(), label: `${v} ms` })
);

// =================================================================================
// Sortable Audio Item Component
// =================================================================================
const SortableAudioItem = ({
  item,
  clip,
  onRemove,
}: {
  item: SequenceItem;
  clip?: TesterAudioClip;
  onRemove: () => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 bg-card border rounded-lg touch-none"
    >
      <button {...attributes} {...listeners} className="cursor-grab p-1">
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </button>
      <div className="flex-grow font-semibold">
        {clip?.name || "Audio not found"}
      </div>
      <Button variant="ghost" size="icon" onClick={onRemove}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
};

// =================================================================================
// Delay Control Component
// =================================================================================
const DelayControl = ({
  value,
  onUpdate,
}: {
  value: number;
  onUpdate: (newValue: number) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value.toString());

  useEffect(() => {
    setInputValue(value.toString());
  }, [value]);

  const handleSelect = (currentValue: string) => {
    onUpdate(Number(currentValue));
    setInputValue(currentValue);
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numValue = parseInt(e.target.value, 10);
    setInputValue(e.target.value);
    if (!isNaN(numValue)) {
      onUpdate(numValue);
    }
  };

  return (
    <div className="flex justify-center items-center my-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[150px] justify-between"
          >
            {value} ms
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0">
          <Command>
            <CommandInput
              placeholder="Set delay (ms)..."
              value={inputValue}
              onValueChange={setInputValue}
              onBlur={handleInputChange}
            />
            <CommandList>
              <CommandEmpty>No results.</CommandEmpty>
              <CommandGroup>
                {delayOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={handleSelect}
                  >
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // --- Load clips from localforage on initial render ---
  useEffect(() => {
    async function loadClips() {
      setIsLoading(true);
      const savedClipsData = await localforage.getItem<StoredClipData[]>(
        CLIPS_STORAGE_KEY
      );
      if (savedClipsData) {
        const audioContext = new AudioContext();
        const loadedClips: TesterAudioClip[] = [];
        for (const clipData of savedClipsData) {
          try {
            const buffer = await audioContext.decodeAudioData(
              clipData.data.slice(0)
            );
            loadedClips.push({ id: clipData.id, name: clipData.name, buffer });
          } catch (e) {
            console.error(
              "Failed to decode saved audio data for",
              clipData.name,
              e
            );
          }
        }
        setClips(loadedClips);
      }
      setIsLoading(false);
    }
    loadClips();
  }, []);

  // --- Save sequence to localStorage on change ---
  useEffect(() => {
    localStorage.setItem(SEQUENCE_STORAGE_KEY, JSON.stringify(sequence));
  }, [sequence]);

  // --- File Upload Handler ---
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
                    arrayBuffer.slice(0)
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
          }
        )
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

  // --- Sequence Manipulation ---
  const addAudioToSequence = (clip: TesterAudioClip) => {
    const newAudioItem: SequenceItem = {
      type: "audio",
      id: `audio-${Date.now()}`,
      audioId: clip.id,
    };
    if (sequence.length > 0) {
      const newDelayItem: SequenceItem = {
        type: "delay",
        id: `delay-${Date.now()}`,
        value: 100,
      };
      setSequence((prev) => [...prev, newDelayItem, newAudioItem]);
    } else {
      setSequence([newAudioItem]);
    }
  };

  const updateDelay = (index: number, value: number) => {
    setSequence(
      (prev) =>
        prev.map((item, i) =>
          i === index ? { ...item, value } : item
        ) as SequenceItem[]
    );
  };

  const removeFromSequence = (idToRemove: string) => {
    setSequence((prev) => {
      const index = prev.findIndex((item) => item.id === idToRemove);
      if (index === -1) return prev;
      if (index > 0 && prev[index - 1].type === "delay") {
        return prev.filter((_, i) => i !== index && i !== index - 1);
      } else if (index === 0 && prev.length > 1 && prev[1].type === "delay") {
        return prev.slice(2);
      }
      return prev.filter((item) => item.id !== idToRemove);
    });
  };

  // --- Drag and Drop Handler ---
  const normalizeDelays = (items: SequenceItem[]): SequenceItem[] => {
    if (items.length < 2) return items;
    const result: SequenceItem[] = [];
    for (let i = 0; i < items.length; i++) {
      const currentItem = items[i];
      const prevItemInResult = result[result.length - 1];
      if (
        currentItem.type === "delay" &&
        (!prevItemInResult || prevItemInResult.type === "delay")
      )
        continue;
      if (currentItem.type === "audio" && prevItemInResult?.type === "audio") {
        result.push({
          type: "delay",
          id: `delay-${Date.now()}-${i}`,
          value: 100,
        });
      }
      result.push(currentItem);
    }
    if (result[0]?.type === "delay") result.shift();
    if (result[result.length - 1]?.type === "delay") result.pop();
    return result;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSequence((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        return normalizeDelays(newItems);
      });
    }
  };

  // --- Playback Logic ---
  const playSequence = () => {
    const audioContext = new AudioContext();
    let startTime = audioContext.currentTime + 0.1;

    sequence.forEach((item) => {
      if (item.type === "audio") {
        const audio = clips.find((c) => c.id === item.audioId);
        if (audio) {
          const source = audioContext.createBufferSource();
          source.buffer = audio.buffer;
          source.connect(audioContext.destination);
          source.start(startTime);
          startTime += audio.buffer.duration;
        } else {
          console.warn(`Audio clip for sequence item ${item.id} not found!`);
        }
      } else if (item.type === "delay") {
        startTime += item.value / 1000;
      }
    });
  };

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
                className="flex items-center justify-center w-full p-10 border-2 border-dashed rounded-lg cursor-pointer border-muted hover:border-primary"
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
                <h3 className="font-semibold">Available Clips:</h3>
                <div className="flex flex-wrap gap-2">
                  {clips.map((clip) => (
                    <Button
                      key={clip.id}
                      variant="outline"
                      onClick={() => addAudioToSequence(clip)}
                    >
                      <PlusCircle className="mr-2 h-4 w-4" /> Add "{clip.name}"
                    </Button>
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
            <Button onClick={playSequence}>
              <Play className="mr-2 h-4 w-4" /> Play Full Sequence
            </Button>
          </CardHeader>
          <CardContent>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sequence.map((i) => i.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {sequence.map((item, index) => {
                    if (item.type === "audio") {
                      const clip = clips.find((c) => c.id === item.audioId);
                      return (
                        <SortableAudioItem
                          key={item.id}
                          item={item}
                          clip={clip}
                          onRemove={() => removeFromSequence(item.id)}
                        />
                      );
                    }
                    if (item.type === "delay") {
                      return (
                        <DelayControl
                          key={item.id}
                          value={item.value}
                          onUpdate={(newValue) => updateDelay(index, newValue)}
                        />
                      );
                    }
                    return null;
                  })}
                </div>
              </SortableContext>
            </DndContext>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SequenceTester;
