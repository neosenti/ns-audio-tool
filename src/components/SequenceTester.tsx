// src/components/SequenceTester.tsx

import { useState, useCallback } from "react";
import Dropzone from "react-dropzone";
import { type SequenceItem } from "@/lib/types"; // We will update types.ts
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Trash2, Play, PlusCircle } from "lucide-react";

// Local type for audio clips within this component
interface TesterAudioClip {
  id: string;
  name: string;
  buffer: AudioBuffer;
}

const SequenceTester = () => {
  const [clips, setClips] = useState<TesterAudioClip[]>([]);
  const [sequence, setSequence] = useState<SequenceItem[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const audioContext = new AudioContext();
    acceptedFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        if (e.target?.result) {
          try {
            const buffer = await audioContext.decodeAudioData(
              e.target.result as ArrayBuffer
            );
            const newClip: TesterAudioClip = {
              id: `${file.name}-${Date.now()}`,
              name: file.name,
              buffer: buffer,
            };
            setClips((prev) => [...prev, newClip]);
          } catch (error) {
            console.error("Error decoding audio data:", error);
            alert(`Could not process the file: ${file.name}`);
          }
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }, []);

  const addAudioToSequence = (audioId: string) => {
    if (!audioId) return;
    setSequence((prev) => [...prev, { type: "audio", audioId, delayMs: 100 }]);
  };

  const updateDelay = (index: number, delay: number) => {
    setSequence((prev) =>
      prev.map((item, i) => (i === index ? { ...item, delayMs: delay } : item))
    );
  };

  const removeFromSequence = (index: number) => {
    setSequence((prev) => prev.filter((_, i) => i !== index));
  };

  const playSequence = () => {
    // This fixes the TypeScript error by using the standardized AudioContext
    const audioContext = new AudioContext();
    let startTime = audioContext.currentTime + 0.1; // Add a small buffer to ensure playback starts smoothly

    sequence.forEach((item) => {
      const audio = clips.find((c) => c.id === item.audioId);
      if (audio) {
        const source = audioContext.createBufferSource();
        source.buffer = audio.buffer;
        source.connect(audioContext.destination);
        source.start(startTime);
        startTime += audio.buffer.duration + item.delayMs / 1000;
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Upload Your Processed Clips</CardTitle>
        </CardHeader>
        <CardContent>
          <Dropzone onDrop={onDrop} accept={{ "audio/*": [] }}>
            {({ getRootProps, getInputProps }) => (
              <div
                {...getRootProps()}
                className="flex items-center justify-center w-full p-10 border-2 border-dashed rounded-lg cursor-pointer border-muted hover:border-primary"
              >
                <input {...getInputProps()} />
                <p>
                  Drop your processed audio files here (you can select multiple)
                </p>
              </div>
            )}
          </Dropzone>
          {clips.length > 0 && (
            <div className="mt-4 space-y-2">
              <h3 className="font-semibold">Available Clips:</h3>
              <div className="flex flex-wrap gap-2">
                {clips.map((clip) => (
                  <Button
                    key={clip.id}
                    variant="outline"
                    onClick={() => addAudioToSequence(clip.id)}
                  >
                    <PlusCircle className="mr-2 h-4 w-4" /> Add "{clip.name}"
                  </Button>
                ))}
              </div>
            </div>
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
            <div className="space-y-4">
              {sequence.map((item, index) => {
                const audio = clips.find((c) => c.id === item.audioId);
                return (
                  <div
                    key={index}
                    className="flex items-center gap-4 p-2 border rounded-lg"
                  >
                    <div className="font-mono text-sm text-muted-foreground">
                      #{index + 1}
                    </div>
                    <div className="flex-grow font-semibold">
                      {audio?.name || "Audio not found"}
                    </div>
                    <div className="flex items-center gap-2">
                      <label htmlFor={`delay-${index}`} className="text-sm">
                        Delay:
                      </label>
                      <Input
                        id={`delay-${index}`}
                        type="number"
                        value={item.delayMs}
                        onChange={(e) =>
                          updateDelay(index, parseInt(e.target.value, 10) || 0)
                        }
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">ms</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFromSequence(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SequenceTester;
