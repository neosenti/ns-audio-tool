// src/components/AudioProcessor.tsx
import React, { useState, useRef, useCallback, useEffect } from "react";
import WaveSurfer from "wavesurfer.js";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import Dropzone from "react-dropzone";
import { Play, Pause, Download, Sparkles, Scissors } from "lucide-react";

// =================================================================================
// Types
// =================================================================================
interface TrimPadSettings {
  enabled: boolean;
  paddingMs: number;
  thresholdDb: number;
  fadeInMs: number;
  fadeOutMs: number;
}

interface ProcessingSettings {
  trimAndPad: TrimPadSettings;
}

// =================================================================================
// Helper Component for Waveform Display
// =================================================================================
const WaveformDisplay = ({
  audioUrl,
  title,
}: {
  audioUrl: string;
  title: string;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !audioUrl) return;

    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      height: 100,
      waveColor: "black",
      progressColor: "white",
      barWidth: 3,
      barRadius: 3,
      barGap: 2,
    });

    wavesurfer.load(audioUrl);

    wavesurfer.on("play", () => setIsPlaying(true));
    wavesurfer.on("pause", () => setIsPlaying(false));
    wavesurfer.on("finish", () => setIsPlaying(false));

    wavesurferRef.current = wavesurfer;

    return () => wavesurfer.destroy();
  }, [audioUrl]);

  const handlePlayPause = () => {
    wavesurferRef.current?.playPause();
  };

  return (
    <div>
      <p className="text-sm font-medium mb-2">{title}</p>
      <div ref={containerRef} className="w-full mb-2" />
      <Button onClick={handlePlayPause} variant="outline" size="sm">
        {isPlaying ? (
          <Pause className="mr-2 h-4 w-4" />
        ) : (
          <Play className="mr-2 h-4 w-4" />
        )}
        {isPlaying ? "Pause" : "Play"}
      </Button>
    </div>
  );
};

// =================================================================================
// Helper Function to convert AudioBuffer to a WAV Blob
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
// Main Audio Processor Component
// =================================================================================
const AudioProcessor = () => {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [originalAudioUrl, setOriginalAudioUrl] = useState<string | null>(null);
  const [processedAudioUrl, setProcessedAudioUrl] = useState<string | null>(
    null
  );
  const [processedAudioBlob, setProcessedAudioBlob] = useState<Blob | null>(
    null
  );
  const originalAudioBuffer = useRef<AudioBuffer | null>(null);
  const audioContext = useRef(new AudioContext());
  const [isProcessing, setIsProcessing] = useState(false);
  const [settings, setSettings] = useState<ProcessingSettings>({
    trimAndPad: {
      enabled: true,
      paddingMs: 100,
      thresholdDb: -40,
      fadeInMs: 10,
      fadeOutMs: 10,
    },
  });
  // Refs for debouncing and URL management
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const processedAudioUrlRef = useRef<string | null>(null);
  // State for accordion
  const [accordionValue, setAccordionValue] = useState<string>("item-1");

  // Debounced processing function
  const runProcessingPipeline = useCallback(() => {
    if (!originalAudioBuffer.current) return;

    setIsProcessing(true);

    // Clear any existing timeout
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
    }

    // Set new timeout with longer debounce (500ms)
    processingTimeoutRef.current = setTimeout(() => {
      try {
        let bufferToProcess = originalAudioBuffer.current!;

        // Only process if enabled
        if (settings.trimAndPad.enabled) {
          const { thresholdDb, paddingMs, fadeInMs, fadeOutMs } =
            settings.trimAndPad;
          const threshold = Math.pow(10, thresholdDb / 20);
          let audioStartIndex = 0,
            audioEndIndex = bufferToProcess.getChannelData(0).length - 1;

          // Find start of audio
          for (let i = 0; i < bufferToProcess.getChannelData(0).length; i++) {
            if (Math.abs(bufferToProcess.getChannelData(0)[i]) > threshold) {
              audioStartIndex = i;
              break;
            }
          }
          // Find end of audio
          for (
            let i = bufferToProcess.getChannelData(0).length - 1;
            i >= 0;
            i--
          ) {
            if (Math.abs(bufferToProcess.getChannelData(0)[i]) > threshold) {
              audioEndIndex = i;
              break;
            }
          }

          if (audioStartIndex < audioEndIndex) {
            const trimmedLength = audioEndIndex - audioStartIndex;
            const paddingSamples = Math.round(
              (paddingMs / 1000) * bufferToProcess.sampleRate
            );
            const finalLength = trimmedLength + 2 * paddingSamples;
            const finalBuffer = audioContext.current.createBuffer(
              bufferToProcess.numberOfChannels,
              finalLength,
              bufferToProcess.sampleRate
            );

            // Copy trimmed audio with padding
            for (let i = 0; i < finalBuffer.numberOfChannels; i++) {
              finalBuffer
                .getChannelData(i)
                .set(
                  bufferToProcess
                    .getChannelData(i)
                    .subarray(audioStartIndex, audioEndIndex),
                  paddingSamples
                );
            }

            // Apply fades
            const fadeInSamples = Math.round(
              (fadeInMs / 1000) * bufferToProcess.sampleRate
            );
            const fadeOutSamples = Math.round(
              (fadeOutMs / 1000) * bufferToProcess.sampleRate
            );

            for (let i = 0; i < finalBuffer.numberOfChannels; i++) {
              const channelData = finalBuffer.getChannelData(i);
              // Fade in
              for (
                let j = 0;
                j < fadeInSamples && paddingSamples + j < channelData.length;
                j++
              )
                channelData[paddingSamples + j] *= j / fadeInSamples;
              // Fade out
              for (
                let j = 0;
                j < fadeOutSamples && finalLength - paddingSamples - 1 - j >= 0;
                j++
              )
                channelData[finalLength - paddingSamples - 1 - j] *=
                  j / fadeOutSamples;
            }
            bufferToProcess = finalBuffer;
          }
        }

        const finalBlob = bufferToWave(bufferToProcess);
        setProcessedAudioBlob(finalBlob);

        // Manage URL cleanup
        if (processedAudioUrlRef.current) {
          URL.revokeObjectURL(processedAudioUrlRef.current);
        }
        const newUrl = URL.createObjectURL(finalBlob);
        processedAudioUrlRef.current = newUrl;
        setProcessedAudioUrl(newUrl);
      } catch (error) {
        console.error("Error during audio processing:", error);
      } finally {
        setIsProcessing(false);
      }
    }, 500); // Increased debounce time to 500ms
  }, [settings]);

  // Run processing when settings change or new audio is loaded
  useEffect(() => {
    if (originalAudioBuffer.current) {
      runProcessingPipeline();
    }
  }, [settings, runProcessingPipeline]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
      if (processedAudioUrlRef.current) {
        URL.revokeObjectURL(processedAudioUrlRef.current);
      }
    };
  }, []);

  // Handle accordion changes
  useEffect(() => {
    if (accordionValue === "item-1") {
      // When accordion opens, ensure processing is enabled
      setSettings((prev) => ({
        ...prev,
        trimAndPad: { ...prev.trimAndPad, enabled: true },
      }));
    }
  }, [accordionValue]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (!acceptedFiles[0]) return;
      if (originalAudioUrl) URL.revokeObjectURL(originalAudioUrl);
      if (processedAudioUrlRef.current) {
        URL.revokeObjectURL(processedAudioUrlRef.current);
        processedAudioUrlRef.current = null;
      }

      const file = acceptedFiles[0];
      setAudioFile(file);
      setOriginalAudioUrl(URL.createObjectURL(file));
      setProcessedAudioUrl(null);
      setProcessedAudioBlob(null);

      const reader = new FileReader();
      reader.onload = async (e) => {
        if (e.target?.result) {
          try {
            // Create new AudioContext for each file
            audioContext.current = new AudioContext();
            originalAudioBuffer.current =
              await audioContext.current.decodeAudioData(
                e.target.result as ArrayBuffer
              );
            runProcessingPipeline();
          } catch (error) {
            console.error("Error loading audio:", error);
          }
        }
      };
      reader.readAsArrayBuffer(file);
    },
    [originalAudioUrl, runProcessingPipeline]
  );

  const handleSettingsChange = (
    newTrimPadSettings: Partial<TrimPadSettings>
  ) => {
    setSettings((prev) => ({
      ...prev,
      trimAndPad: { ...prev.trimAndPad, ...newTrimPadSettings },
    }));

    // If disabling processing, close the accordion
    if (newTrimPadSettings.enabled === false) {
      setAccordionValue("");
    }
  };

  const handleDownload = () => {
    if (!processedAudioBlob || !audioFile) return;
    const originalName =
      audioFile.name.split(".").slice(0, -1).join(".") || audioFile.name;
    const url = URL.createObjectURL(processedAudioBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${originalName}-processed.wav`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const trimPadSettings = settings.trimAndPad;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Upload Audio</CardTitle>
          <CardDescription>Drop an audio file to begin.</CardDescription>
        </CardHeader>
        <CardContent>
          <Dropzone onDrop={onDrop} accept={{ "audio/*": [] }} multiple={false}>
            {({ getRootProps, getInputProps }) => (
              <div
                {...getRootProps()}
                className="flex items-center justify-center w-full p-10 border-2 border-dashed rounded-lg cursor-pointer border-muted hover:border-primary"
              >
                <input {...getInputProps()} />
                <p>Drag & drop an audio file, or click to select</p>
              </div>
            )}
          </Dropzone>
        </CardContent>
      </Card>

      {originalAudioUrl && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>2. Original Audio</CardTitle>
            </CardHeader>
            <CardContent>
              <WaveformDisplay
                key={originalAudioUrl}
                audioUrl={originalAudioUrl}
                title={audioFile?.name || "Original"}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Processing Steps</CardTitle>
              <CardDescription>
                Adjust settings to automatically re-process the audio.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion
                type="single"
                collapsible
                value={accordionValue}
                onValueChange={setAccordionValue}
                className="w-full"
              >
                <AccordionItem value="item-1">
                  <AccordionTrigger>
                    <div className="flex flex-1 items-center gap-4">
                      <Label
                        htmlFor="trim-enable"
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Scissors className="h-5 w-5" /> Auto-Trim & Pad
                      </Label>
                      <Switch
                        id="trim-enable"
                        checked={trimPadSettings.enabled}
                        onCheckedChange={(checked) =>
                          handleSettingsChange({ enabled: checked })
                        }
                        className="ml-auto"
                      />
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-6 pt-4">
                    <fieldset
                      disabled={!trimPadSettings.enabled}
                      className="disabled:opacity-50 space-y-6"
                    >
                      <div className="space-y-2">
                        <Label>
                          Silence Threshold ({trimPadSettings.thresholdDb} dB)
                        </Label>
                        <Slider
                          min={-60}
                          max={0}
                          step={1}
                          value={[trimPadSettings.thresholdDb]}
                          onValueChange={([val]) =>
                            handleSettingsChange({ thresholdDb: val })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Padding</Label>
                        <Input
                          type="number"
                          value={trimPadSettings.paddingMs}
                          onChange={(e) =>
                            handleSettingsChange({
                              paddingMs: parseInt(e.target.value) || 0,
                            })
                          }
                        />
                        <p className="text-sm text-muted-foreground">
                          Milliseconds before and after audio.
                        </p>
                      </div>
                      <div className="pt-4 border-t">
                        <Label>Popping Reduction (Micro-Fades)</Label>
                        <div className="grid grid-cols-2 gap-4 mt-2">
                          <div className="space-y-2">
                            <Label htmlFor="fade-in">Fade-In (ms)</Label>
                            <Input
                              id="fade-in"
                              type="number"
                              value={trimPadSettings.fadeInMs}
                              onChange={(e) =>
                                handleSettingsChange({
                                  fadeInMs: parseInt(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="fade-out">Fade-Out (ms)</Label>
                            <Input
                              id="fade-out"
                              type="number"
                              value={trimPadSettings.fadeOutMs}
                              onChange={(e) =>
                                handleSettingsChange({
                                  fadeOutMs: parseInt(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </fieldset>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>4. Result</CardTitle>
              <CardDescription>
                Listen to the processed audio and download it.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isProcessing ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Sparkles className="h-4 w-4 animate-spin" />
                  Processing...
                </div>
              ) : processedAudioUrl ? (
                <>
                  <WaveformDisplay
                    key={processedAudioUrl}
                    audioUrl={processedAudioUrl}
                    title="Processed Audio"
                  />
                  <Button onClick={handleDownload} size="lg">
                    <Download className="mr-2 h-4 w-4" /> Download Processed
                    Audio
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Processed audio will appear here.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default AudioProcessor;
