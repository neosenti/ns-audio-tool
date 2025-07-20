// src/components/AudioProcessor.tsx

// (Keep all the imports from the previous step)
import { useState, useRef, useCallback } from "react";
import { useWavesurfer } from "@wavesurfer/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Dropzone from "react-dropzone";
import { Play, Pause, Sparkles } from "lucide-react";
import { type ProcessedAudio } from "@/lib/types";

// The props interface defines the function we expect from the parent
interface AudioProcessorProps {
  onAudioProcessed: (audio: ProcessedAudio) => void;
}

const AudioProcessor = ({ onAudioProcessed }: AudioProcessorProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);

  const { wavesurfer, isPlaying } = useWavesurfer({
    container: containerRef,
    height: 120,
    waveColor: "hsl(var(--muted-foreground))",
    progressColor: "hsl(var(--primary))",
    url: audioFile ? URL.createObjectURL(audioFile) : undefined,
    barWidth: 3,
    barRadius: 3,
    barGap: 2,
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles[0]) {
      setAudioFile(acceptedFiles[0]);
    }
  }, []);

  const handlePlayPause = () => {
    wavesurfer?.playPause();
  };

  // This is a placeholder for your actual silence detection and padding logic
  const handleProcessAudio = async () => {
    if (!wavesurfer || !audioFile) return;

    const originalBuffer = wavesurfer.getDecodedData();
    if (!originalBuffer) {
      alert("Audio not ready yet.");
      return;
    }

    // --- YOUR PROCESSING LOGIC GOES HERE ---
    // For now, we'll just simulate processing by cloning the buffer
    // and adding a 100ms pad on each side.
    const audioContext = new AudioContext();
    const paddingSeconds = 0.1; // 100ms
    const newBuffer = audioContext.createBuffer(
      originalBuffer.numberOfChannels,
      originalBuffer.length + 2 * (paddingSeconds * originalBuffer.sampleRate),
      originalBuffer.sampleRate
    );

    for (let i = 0; i < originalBuffer.numberOfChannels; i++) {
      const channel = newBuffer.getChannelData(i);
      const originalChannel = originalBuffer.getChannelData(i);
      // Copy original data into the middle of the new buffer
      channel.set(originalChannel, paddingSeconds * originalBuffer.sampleRate);
    }
    // --- END OF PROCESSING LOGIC ---

    // Create a unique ID and name for the processed audio
    const newProcessedAudio: ProcessedAudio = {
      id: `processed-${Date.now()}`,
      name: `${audioFile.name.split(".").slice(0, -1).join(".")}-padded`,
      buffer: newBuffer,
    };

    // Call the function passed from the parent to update the shared state
    onAudioProcessed(newProcessedAudio);
  };

  return (
    // The JSX remains largely the same as the previous version
    <Card>
      <CardHeader>
        <CardTitle>Upload & Process Audio</CardTitle>
      </CardHeader>
      <CardContent>
        <Dropzone onDrop={onDrop} accept={{ "audio/*": [] }}>
          {({ getRootProps, getInputProps }) => (
            <div
              {...getRootProps()}
              className="flex items-center justify-center w-full p-10 border-2 border-dashed rounded-lg cursor-pointer border-muted hover:border-primary transition-colors"
            >
              <input {...getInputProps()} />
              <p>Drop an audio file here</p>
            </div>
          )}
        </Dropzone>

        {audioFile && (
          <div className="mt-4">
            <div ref={containerRef} className="w-full mb-4" />
            <div className="flex items-center gap-4">
              <Button onClick={handlePlayPause} variant="outline" size="icon">
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
              <Button onClick={handleProcessAudio}>
                <Sparkles className="mr-2 h-4 w-4" /> Process & Pad Audio
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AudioProcessor;
