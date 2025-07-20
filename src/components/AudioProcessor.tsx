import { useState, useRef, useCallback } from "react";
import { useWavesurfer } from "@wavesurfer/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Dropzone from "react-dropzone";
import { Play, Pause, Scissors, Sparkles } from "lucide-react";

const AudioProcessor = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [originalBuffer, setOriginalBuffer] = useState<AudioBuffer | null>(
    null
  );

  // Wavesurfer hook to manage the audio player instance
  const { wavesurfer, isPlaying, currentTime } = useWavesurfer({
    container: containerRef,
    height: 120,
    waveColor: "hsl(var(--muted-foreground))",
    progressColor: "hsl(var(--primary))",
    url: audioUrl || undefined,
    barWidth: 3,
    barRadius: 3,
    barGap: 2,
  });

  // Callback for when a file is dropped
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles[0]) {
      const url = URL.createObjectURL(acceptedFiles[0]);
      setAudioUrl(url);
    }
  }, []);

  // Handle play/pause functionality
  const handlePlayPause = () => {
    wavesurfer && wavesurfer.playPause();
  };

  // Placeholder for the processing logic
  const handleProcessAudio = () => {
    if (!wavesurfer) return;

    // In a future step, we'll get the buffer from wavesurfer
    const buffer = wavesurfer.getDecodedData();
    if (!buffer) {
      alert("Audio has not been decoded yet. Please wait.");
      return;
    }

    console.log("Processing audio buffer:", buffer);
    alert("Silence detection and padding logic will be implemented here!");
    // 1. Detect silence
    // 2. Slice the audio
    // 3. Add padding
    // 4. Create a new buffer and load it into a new wavesurfer instance
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Upload Audio</CardTitle>
        </CardHeader>
        <CardContent>
          <Dropzone onDrop={onDrop} accept={{ "audio/*": [] }}>
            {({ getRootProps, getInputProps }) => (
              <div
                {...getRootProps()}
                className="flex items-center justify-center w-full p-10 border-2 border-dashed rounded-lg cursor-pointer border-muted hover:border-primary transition-colors"
              >
                <input {...getInputProps()} />
                <p className="text-muted-foreground">
                  Drag & drop an audio file here, or click to select a file
                </p>
              </div>
            )}
          </Dropzone>
        </CardContent>
      </Card>

      {audioUrl && (
        <Card>
          <CardHeader>
            <CardTitle>2. Review and Process</CardTitle>
          </CardHeader>
          <CardContent>
            <div ref={containerRef} className="w-full mb-4" />
            <div className="flex items-center gap-4">
              <Button onClick={handlePlayPause} variant="outline" size="icon">
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
              <div className="flex-grow">
                <p className="text-sm text-muted-foreground">
                  Current Time: {currentTime.toFixed(2)}s
                </p>
              </div>
              <Button onClick={handleProcessAudio}>
                <Sparkles className="mr-2 h-4 w-4" />
                Pad Audio
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AudioProcessor;
