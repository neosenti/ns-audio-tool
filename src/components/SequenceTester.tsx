// src/components/SequenceTester.tsx

import { useState } from "react";
import { type ProcessedAudio, type SequenceItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Play, PlusCircle } from "lucide-react";

interface SequenceTesterProps {
  availableAudios: ProcessedAudio[];
}

const SequenceTester = ({ availableAudios }: SequenceTesterProps) => {
  const [sequence, setSequence] = useState<SequenceItem[]>([]);
  const [selectedAudioId, setSelectedAudioId] = useState<string>("");

  const addAudioToSequence = () => {
    if (!selectedAudioId) {
      alert("Please select an audio clip to add.");
      return;
    }
    const newSequenceItem: SequenceItem = {
      type: "audio",
      audioId: selectedAudioId,
      delayMs: 100, // Default delay
    };
    setSequence([...sequence, newSequenceItem]);
  };

  const updateDelay = (index: number, delay: number) => {
    const newSequence = [...sequence];
    newSequence[index].delayMs = delay;
    setSequence(newSequence);
  };

  const removeFromSequence = (index: number) => {
    const newSequence = [...sequence];
    newSequence.splice(index, 1);
    setSequence(newSequence);
  };

  const playSequence = () => {
    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    let startTime = audioContext.currentTime;

    sequence.forEach((item) => {
      const audio = availableAudios.find((a) => a.id === item.audioId);
      if (audio) {
        const source = audioContext.createBufferSource();
        source.buffer = audio.buffer;
        source.connect(audioContext.destination);
        source.start(startTime);

        // Update the start time for the next item in the sequence
        startTime += audio.buffer.duration + item.delayMs / 1000;
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Build Your Audio Sequence</CardTitle>
        </CardHeader>
        <CardContent>
          {availableAudios.length === 0 ? (
            <p className="text-muted-foreground">
              Process an audio clip in the first tab to get started.
            </p>
          ) : (
            <div className="flex items-end gap-2">
              <div className="flex-grow">
                <label htmlFor="audio-select" className="text-sm font-medium">
                  Available Clips
                </label>
                <Select
                  onValueChange={setSelectedAudioId}
                  value={selectedAudioId}
                >
                  <SelectTrigger id="audio-select">
                    <SelectValue placeholder="Select a processed audio clip" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAudios.map((audio) => (
                      <SelectItem key={audio.id} value={audio.id}>
                        {audio.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={addAudioToSequence}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add to Sequence
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {sequence.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Current Sequence</CardTitle>
            <Button onClick={playSequence}>
              <Play className="mr-2 h-4 w-4" /> Play Full Sequence
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sequence.map((item, index) => {
                const audio = availableAudios.find(
                  (a) => a.id === item.audioId
                );
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
                          updateDelay(index, parseInt(e.target.value, 10))
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
