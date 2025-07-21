// src/components/AudioProcessor/AudioProcessor.tsx
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
import Dropzone from "react-dropzone";
import {
  Play,
  Pause,
  Download,
  Sparkles,
  Import,
  FolderUp,
} from "lucide-react";

// Components
import TrimAndPad from "./ProcessingSteps/TrimAndPad";
import VolumeNorm from "./ProcessingSteps/VolumeNorm";
import ProsodyViz from "./ProcessingSteps/ProsodyViz";

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

interface VolumeNormSettings {
  enabled: boolean;
  targetDb: number;
}

interface ProsodyVizSettings {
  enabled: boolean;
}

interface ProcessingSettings {
  trimAndPad: TrimPadSettings;
  volumeNorm: VolumeNormSettings;
  prosodyViz: ProsodyVizSettings;
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
    volumeNorm: {
      enabled: true,
      targetDb: -3,
    },
    prosodyViz: {
      enabled: false,
    },
  });
  // Refs for debouncing and URL management
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const processedAudioUrlRef = useRef<string | null>(null);
  const settingsFileInputRef = useRef<HTMLInputElement>(null);
  const [prosodyData, setProsodyData] = useState<{
    pitch: number[];
    intensity: number[];
    voiced: boolean[];
  } | null>(null);

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

        // Trim & Pad Processing
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

        // Volume Normalization Processing
        if (settings.volumeNorm.enabled) {
          const targetAmplitude = Math.pow(
            10,
            settings.volumeNorm.targetDb / 20
          );

          // Find the current peak amplitude
          let peak = 0;
          for (
            let channel = 0;
            channel < bufferToProcess.numberOfChannels;
            channel++
          ) {
            const channelData = bufferToProcess.getChannelData(channel);
            for (let i = 0; i < channelData.length; i++) {
              const amplitude = Math.abs(channelData[i]);
              if (amplitude > peak) peak = amplitude;
            }
          }

          // Calculate gain needed to reach target amplitude
          if (peak > 0) {
            const gain = targetAmplitude / peak;

            // Apply gain to all channels
            for (
              let channel = 0;
              channel < bufferToProcess.numberOfChannels;
              channel++
            ) {
              const channelData = bufferToProcess.getChannelData(channel);
              for (let i = 0; i < channelData.length; i++) {
                channelData[i] *= gain;
              }
            }
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
      setProsodyData(null);

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
    step: keyof ProcessingSettings,
    newSettings: any
  ) => {
    setSettings((prev) => ({
      ...prev,
      [step]: { ...prev[step], ...newSettings },
    }));
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

  // Export settings to JSON file
  const exportSettings = () => {
    const settingsStr = JSON.stringify(settings, null, 2);
    const blob = new Blob([settingsStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "audio-processor-settings.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Import settings from JSON file
  const importSettings = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedSettings = JSON.parse(e.target?.result as string);
        setSettings(importedSettings);
      } catch (error) {
        console.error("Error importing settings:", error);
        alert("Invalid settings file format");
      }
    };
    reader.readAsText(file);
  };

  const handleSettingsFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importSettings(file);
    }
    // Reset input to allow selecting same file again
    if (e.target) e.target.value = "";
  };

  const handleProsodyAnalysisComplete = (data: {
    pitch: number[];
    intensity: number[];
    voiced: boolean[];
  }) => {
    setProsodyData(data);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Upload Audio</CardTitle>
          <CardDescription>
            Drop an audio file to begin processing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={exportSettings}
              className="flex-1"
            >
              <FolderUp className="mr-2 h-4 w-4" /> Export Settings
            </Button>

            <Button
              variant="outline"
              onClick={() => settingsFileInputRef.current?.click()}
              className="flex-1"
            >
              <Import className="mr-2 h-4 w-4" /> Import Settings
            </Button>
            <input
              type="file"
              ref={settingsFileInputRef}
              onChange={handleSettingsFileChange}
              accept=".json"
              className="hidden"
            />
          </div>
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

          <div className="space-y-4">
            <CardHeader>
              <CardTitle>3. Processing Steps</CardTitle>
              <CardDescription>
                Enable and configure processing steps
              </CardDescription>
            </CardHeader>

            <TrimAndPad
              settings={settings.trimAndPad}
              onSettingsChange={(newSettings) =>
                handleSettingsChange("trimAndPad", newSettings)
              }
            />

            <VolumeNorm
              settings={settings.volumeNorm}
              onSettingsChange={(newSettings) =>
                handleSettingsChange("volumeNorm", newSettings)
              }
            />

            <ProsodyViz
              audioBuffer={originalAudioBuffer.current}
              onAnalysisComplete={handleProsodyAnalysisComplete}
              analysisData={prosodyData}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>4. Result</CardTitle>
              <CardDescription>
                Listen to the processed audio and download it.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="relative">
                {isProcessing && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Sparkles className="h-4 w-4 animate-spin" />
                      Processing...
                    </div>
                  </div>
                )}

                {processedAudioUrl ? (
                  <>
                    <WaveformDisplay
                      key={processedAudioUrl}
                      audioUrl={processedAudioUrl}
                      title="Processed Audio"
                    />
                    <Button onClick={handleDownload} size="lg" className="mt-4">
                      <Download className="mr-2 h-4 w-4" /> Download Processed
                      Audio
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Processed audio will appear here.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default AudioProcessor;
