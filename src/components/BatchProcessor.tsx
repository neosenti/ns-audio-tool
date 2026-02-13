import { useState, useRef, useCallback, useEffect } from "react";
import WaveSurfer from "wavesurfer.js";
import Dropzone from "react-dropzone";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Play,
  Pause,
  Download,
  Upload,
  Settings2,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Wand2,
  Square,
  Archive,
} from "lucide-react";
import { cn } from "@/lib/utils";

// =================================================================================
// Types
// =================================================================================
interface BatchSettings {
  trimEnabled: boolean;
  trimThreshold: number;
  trimPadding: number;
  normEnabled: boolean;
  normTarget: number; // dB, range -30 to +10
}

interface AudioItem {
  id: string;
  file: File;
  originalBuffer: AudioBuffer | null;
  processedBlob: Blob | null;
  processedUrl: string | null;
  status: "pending" | "processing" | "done" | "error";
  error?: string;
  settings: BatchSettings;
}

// =================================================================================
// Helper: Buffer to WAV
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

  // Header
  setUint32(0x46464952); // "RIFF"
  setUint32(L - 8);
  setUint32(0x45564157); // "WAVE"
  setUint32(0x20746d66); // "fmt "
  setUint32(16);
  setUint16(1);
  setUint16(numOfChan);
  setUint32(abuffer.sampleRate);
  setUint32(abuffer.sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2);
  setUint16(16);
  setUint32(0x61746164); // "data"
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
// Sub-Component: Mini Waveform Preview
// =================================================================================
const MiniWaveform = ({ url }: { url: string | null }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!url || !containerRef.current) return;

    if (wsRef.current) {
      wsRef.current.destroy();
    }

    const ws = WaveSurfer.create({
      container: containerRef.current,
      height: 40,
      waveColor: "#64748b",
      progressColor: "#0f172a",
      cursorWidth: 0,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      interact: true,
    });

    ws.load(url);
    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("finish", () => setIsPlaying(false));

    wsRef.current = ws;
    return () => ws.destroy();
  }, [url]);

  return (
    <div className="flex items-center gap-2 w-full">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => wsRef.current?.playPause()}
        disabled={!url}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>
      <div ref={containerRef} className="flex-grow w-full" />
    </div>
  );
};

// =================================================================================
// Main Component
// =================================================================================
const BatchProcessor = () => {
  const [items, setItems] = useState<AudioItem[]>([]);
  const [globalSettings, setGlobalSettings] = useState<BatchSettings>({
    trimEnabled: true,
    trimThreshold: -40,
    trimPadding: 100,
    normEnabled: true,
    normTarget: -3,
  });

  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Initialize AudioContext lazily
  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const ctx = getAudioContext();
      const newItems: AudioItem[] = [];

      for (const file of acceptedFiles) {
        const id = Math.random().toString(36).substring(7);
        try {
          const arrayBuffer = await file.arrayBuffer();
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

          newItems.push({
            id,
            file,
            originalBuffer: audioBuffer,
            processedBlob: null,
            processedUrl: null,
            status: "pending",
            settings: { ...globalSettings },
          });
        } catch (err) {
          console.error("Error decoding file:", file.name, err);
        }
      }
      setItems((prev) => [...prev, ...newItems]);
    },
    [globalSettings],
  );

  const applyGlobalToAll = () => {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        settings: { ...globalSettings },
        status: "pending",
      })),
    );
  };

  const updateItemSettings = (id: string, updates: Partial<BatchSettings>) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              settings: { ...item.settings, ...updates },
              status: "pending",
            }
          : item,
      ),
    );
  };

  const processItem = async (item: AudioItem): Promise<AudioItem> => {
    if (!item.originalBuffer) return item;

    const ctx = getAudioContext();
    const { trimEnabled, trimThreshold, trimPadding, normEnabled, normTarget } =
      item.settings;

    let bufferToProcess = item.originalBuffer;

    try {
      // 1. TRIM
      if (trimEnabled) {
        const threshold = Math.pow(10, trimThreshold / 20);
        const channelData = bufferToProcess.getChannelData(0);
        let start = 0;
        let end = channelData.length - 1;

        for (let i = 0; i < channelData.length; i++) {
          if (Math.abs(channelData[i]) > threshold) {
            start = i;
            break;
          }
        }
        for (let i = channelData.length - 1; i >= 0; i--) {
          if (Math.abs(channelData[i]) > threshold) {
            end = i;
            break;
          }
        }

        if (start < end) {
          const paddingSamples = Math.round(
            (trimPadding / 1000) * bufferToProcess.sampleRate,
          );
          const rawLen = end - start;
          const newLen = rawLen + paddingSamples * 2;

          const newBuffer = ctx.createBuffer(
            bufferToProcess.numberOfChannels,
            newLen,
            bufferToProcess.sampleRate,
          );

          for (let ch = 0; ch < bufferToProcess.numberOfChannels; ch++) {
            const oldData = bufferToProcess.getChannelData(ch);
            const newData = newBuffer.getChannelData(ch);
            newData.set(oldData.subarray(start, end), paddingSamples);

            const fadeLen = Math.floor(0.01 * bufferToProcess.sampleRate);
            for (let j = 0; j < fadeLen; j++) {
              if (paddingSamples + j < newData.length)
                newData[paddingSamples + j] *= j / fadeLen;
              const endIdx = newLen - paddingSamples - 1 - j;
              if (endIdx >= 0) newData[endIdx] *= j / fadeLen;
            }
          }
          bufferToProcess = newBuffer;
        }
      }

      // 2. NORMALIZE
      if (normEnabled) {
        const targetAmp = Math.pow(10, normTarget / 20);
        let maxPeak = 0;
        for (let ch = 0; ch < bufferToProcess.numberOfChannels; ch++) {
          const data = bufferToProcess.getChannelData(ch);
          for (let i = 0; i < data.length; i++) {
            const abs = Math.abs(data[i]);
            if (abs > maxPeak) maxPeak = abs;
          }
        }

        if (maxPeak > 0) {
          const gain = targetAmp / maxPeak;
          for (let ch = 0; ch < bufferToProcess.numberOfChannels; ch++) {
            const data = bufferToProcess.getChannelData(ch);
            for (let i = 0; i < data.length; i++) {
              data[i] *= gain;
            }
          }
        }
      }

      const blob = bufferToWave(bufferToProcess);
      const url = URL.createObjectURL(blob);

      return {
        ...item,
        processedBlob: blob,
        processedUrl: url,
        status: "done",
      };
    } catch (e) {
      console.error(e);
      return { ...item, status: "error", error: "Processing failed" };
    }
  };

  const runBatchProcessing = async () => {
    const pendingItems = items.filter(
      (i) => i.status === "pending" || i.status === "error",
    );
    if (pendingItems.length === 0) return;

    setItems((prev) =>
      prev.map((i) =>
        i.status === "pending" || i.status === "error"
          ? { ...i, status: "processing" }
          : i,
      ),
    );

    for (const item of pendingItems) {
      const result = await processItem(item);
      setItems((prev) => prev.map((i) => (i.id === item.id ? result : i)));
    }
  };

  const processSingleItem = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: "processing" } : i)),
    );
    const result = await processItem(item);
    setItems((prev) => prev.map((i) => (i.id === id ? result : i)));
  };

  const deleteItem = (id: string) => {
    if (playingId === id) {
      audioPlayerRef.current?.pause();
      setPlayingId(null);
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const downloadItem = (item: AudioItem) => {
    if (!item.processedUrl) return;
    const a = document.createElement("a");
    a.href = item.processedUrl;
    // Naming convention: <original>_processed.wav
    const nameParts = item.file.name.split(".");
    if (nameParts.length > 1) nameParts.pop(); // remove extension
    const name = nameParts.join(".");
    a.download = `${name}_processed.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadAllProcessed = () => {
    // Downloads all 'done' items sequentially
    const doneItems = items.filter((i) => i.status === "done");
    let delay = 0;
    doneItems.forEach((item) => {
      setTimeout(() => downloadItem(item), delay);
      delay += 500; // Stagger downloads slightly to prevent browser blocking
    });
  };

  const togglePreview = (item: AudioItem) => {
    if (playingId === item.id) {
      audioPlayerRef.current?.pause();
      setPlayingId(null);
      return;
    }

    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }

    let src = item.processedUrl;
    if (!src) {
      src = URL.createObjectURL(item.file);
    }

    const audio = new Audio(src);
    audio.onended = () => {
      setPlayingId(null);
      if (!item.processedUrl) URL.revokeObjectURL(src!);
    };
    audio.play();
    audioPlayerRef.current = audio;
    setPlayingId(item.id);
  };

  // Count ready items for the "Download All" button state
  const readyCount = items.filter((i) => i.status === "done").length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-12rem)]">
      {/* LEFT COLUMN: Controls & Upload */}
      <div className="space-y-6 lg:col-span-1 flex flex-col">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" /> Global Settings
            </CardTitle>
            <CardDescription>
              Applied to all new files. Use "Apply to All" to update existing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Trim Settings */}
            <div className="space-y-3 border-b pb-4">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">Auto-Trim Silence</Label>
                <Switch
                  checked={globalSettings.trimEnabled}
                  onCheckedChange={(c) =>
                    setGlobalSettings((s) => ({ ...s, trimEnabled: c }))
                  }
                />
              </div>
              {globalSettings.trimEnabled && (
                <>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Threshold</span>
                      <span>{globalSettings.trimThreshold} dB</span>
                    </div>
                    <Slider
                      min={-60}
                      max={-10}
                      step={1}
                      value={[globalSettings.trimThreshold]}
                      onValueChange={([v]) =>
                        setGlobalSettings((s) => ({ ...s, trimThreshold: v }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Padding</span>
                      <span>{globalSettings.trimPadding} ms</span>
                    </div>
                    <Slider
                      min={0}
                      max={500}
                      step={10}
                      value={[globalSettings.trimPadding]}
                      onValueChange={([v]) =>
                        setGlobalSettings((s) => ({ ...s, trimPadding: v }))
                      }
                    />
                  </div>
                </>
              )}
            </div>

            {/* Norm Settings */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">Volume / Norm</Label>
                <Switch
                  checked={globalSettings.normEnabled}
                  onCheckedChange={(c) =>
                    setGlobalSettings((s) => ({ ...s, normEnabled: c }))
                  }
                />
              </div>
              {globalSettings.normEnabled && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Target Level</span>
                    <span
                      className={cn(
                        globalSettings.normTarget > 0
                          ? "text-amber-500 font-bold"
                          : "",
                      )}
                    >
                      {globalSettings.normTarget > 0 ? "+" : ""}
                      {globalSettings.normTarget} dB
                    </span>
                  </div>
                  <Slider
                    min={-30}
                    max={10}
                    step={0.5}
                    value={[globalSettings.normTarget]}
                    onValueChange={([v]) =>
                      setGlobalSettings((s) => ({ ...s, normTarget: v }))
                    }
                  />
                  {globalSettings.normTarget > 0 && (
                    <p className="text-[10px] text-amber-500 flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" /> Positive gain may
                      cause clipping.
                    </p>
                  )}
                </div>
              )}
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={applyGlobalToAll}
            >
              Apply Settings to All Files
            </Button>
          </CardContent>
        </Card>

        {/* Dropzone */}
        <Card className="flex-grow flex flex-col">
          <CardContent className="pt-6 h-full">
            <Dropzone onDrop={onDrop} accept={{ "audio/*": [] }}>
              {({ getRootProps, getInputProps, isDragActive }) => (
                <div
                  {...getRootProps()}
                  className={cn(
                    "flex flex-col items-center justify-center h-full min-h-[150px] border-2 border-dashed rounded-lg cursor-pointer transition-colors",
                    isDragActive
                      ? "border-primary bg-primary/10"
                      : "border-muted hover:border-primary",
                  )}
                >
                  <input {...getInputProps()} />
                  <Upload className="h-10 w-10 text-muted-foreground mb-4" />
                  <p className="text-sm font-medium text-center">
                    Drag audio files here
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    or click to browse
                  </p>
                </div>
              )}
            </Dropzone>
          </CardContent>
        </Card>
      </div>

      {/* RIGHT COLUMN: File List */}
      <Card className="lg:col-span-2 flex flex-col h-full overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b shrink-0">
          <div>
            <CardTitle>Batch Queue ({items.length})</CardTitle>
            <CardDescription>
              Process, preview, and fine-tune individually.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setItems([])}
              disabled={items.length === 0}
              title="Clear List"
            >
              Clear
            </Button>
            <Button
              variant="secondary"
              onClick={downloadAllProcessed}
              disabled={readyCount === 0}
              title="Download All Processed"
            >
              <Archive className="mr-2 h-4 w-4" /> Save All ({readyCount})
            </Button>
            <Button onClick={runBatchProcessing} disabled={items.length === 0}>
              <Wand2 className="mr-2 h-4 w-4" /> Process All
            </Button>
          </div>
        </CardHeader>

        <ScrollArea className="flex-1 p-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <p>No files in queue.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="border rounded-lg bg-card text-card-foreground shadow-sm overflow-hidden"
                >
                  {/* Header Row */}
                  <div className="flex items-center justify-between p-3 gap-3">
                    {/* Left Side: Play & Info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 shrink-0 rounded-full"
                        onClick={() => togglePreview(item)}
                      >
                        {playingId === item.id ? (
                          <Square className="h-4 w-4 fill-current" />
                        ) : (
                          <Play className="h-4 w-4 ml-0.5" />
                        )}
                      </Button>

                      <div className="flex flex-col min-w-0">
                        <p
                          className="font-medium truncate text-sm"
                          title={item.file.name}
                        >
                          {item.file.name}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span>{(item.file.size / 1024).toFixed(0)} KB</span>
                          <span className="hidden sm:inline">•</span>
                          <StatusBadge status={item.status} />
                        </div>
                      </div>
                    </div>

                    {/* Right Side: Actions (Fixed Width/Shrink) */}
                    <div className="flex items-center gap-1 shrink-0">
                      {item.status === "done" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-green-600"
                          onClick={() => downloadItem(item)}
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant={
                          expandedItemId === item.id ? "secondary" : "ghost"
                        }
                        onClick={() =>
                          setExpandedItemId(
                            expandedItemId === item.id ? null : item.id,
                          )
                        }
                        className="hidden sm:inline-flex"
                      >
                        Fine Tune
                      </Button>
                      <Button
                        size="icon"
                        variant={
                          expandedItemId === item.id ? "secondary" : "ghost"
                        }
                        onClick={() =>
                          setExpandedItemId(
                            expandedItemId === item.id ? null : item.id,
                          )
                        }
                        className="sm:hidden h-8 w-8"
                      >
                        <Settings2 className="h-4 w-4" />
                      </Button>

                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={() => deleteItem(item.id)}
                        title="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Content (Fine Tuning) */}
                  {expandedItemId === item.id && (
                    <div className="border-t bg-muted/30 p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Local Controls */}
                        <div className="space-y-4 md:border-r md:pr-4">
                          <h4 className="text-xs font-bold uppercase text-muted-foreground">
                            Individual Settings
                          </h4>

                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <Label className="text-xs">Target Volume</Label>
                              <span className="text-xs font-mono">
                                {item.settings.normTarget} dB
                              </span>
                            </div>
                            <Slider
                              min={-30}
                              max={10}
                              step={0.5}
                              value={[item.settings.normTarget]}
                              onValueChange={([v]) =>
                                updateItemSettings(item.id, { normTarget: v })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <Label className="text-xs">Trim Threshold</Label>
                              <span className="text-xs font-mono">
                                {item.settings.trimThreshold} dB
                              </span>
                            </div>
                            <Slider
                              min={-60}
                              max={-10}
                              step={1}
                              value={[item.settings.trimThreshold]}
                              onValueChange={([v]) =>
                                updateItemSettings(item.id, {
                                  trimThreshold: v,
                                })
                              }
                            />
                          </div>
                          <Button
                            size="sm"
                            className="w-full mt-2"
                            onClick={() => processSingleItem(item.id)}
                          >
                            <RefreshCw className="mr-2 h-3 w-3" /> Reprocess
                            This File
                          </Button>
                        </div>

                        {/* Previews */}
                        <div className="space-y-4 md:pl-2">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">
                              Processed Result
                            </Label>
                            {item.processedUrl ? (
                              <MiniWaveform url={item.processedUrl} />
                            ) : (
                              <div className="h-12 flex items-center justify-center border border-dashed rounded bg-background/50 text-xs text-muted-foreground">
                                Not processed yet
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </Card>
    </div>
  );
};

const StatusBadge = ({ status }: { status: AudioItem["status"] }) => {
  switch (status) {
    case "done":
      return (
        <Badge
          variant="default"
          className="bg-green-600 hover:bg-green-700 h-5 px-1.5"
        >
          <CheckCircle2 className="w-3 h-3 mr-1" /> Ready
        </Badge>
      );
    case "processing":
      return (
        <Badge variant="secondary" className="animate-pulse h-5 px-1.5">
          Processing
        </Badge>
      );
    case "error":
      return (
        <Badge variant="destructive" className="h-5 px-1.5">
          Error
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="h-5 px-1.5">
          Pending
        </Badge>
      );
  }
};

export default BatchProcessor;
