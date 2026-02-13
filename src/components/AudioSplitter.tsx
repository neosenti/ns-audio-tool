import { useState, useRef, useEffect, useCallback } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import Dropzone from "react-dropzone";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider"; // Import Slider
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Play,
  Pause,
  Scissors,
  Download,
  Trash2,
  ZoomIn,
  ZoomOut,
  Plus,
  RotateCcw,
} from "lucide-react";

// =================================================================================
// Helper Function: Buffer to WAV
// =================================================================================
const bufferToWave = (
  abuffer: AudioBuffer,
  start: number,
  end: number,
): Blob => {
  const sampleRate = abuffer.sampleRate;
  const startSample = Math.max(0, Math.floor(start * sampleRate));
  const endSample = Math.min(abuffer.length, Math.ceil(end * sampleRate));
  const length = endSample - startSample;

  if (length <= 0) return new Blob([], { type: "audio/wav" });

  const numOfChan = abuffer.numberOfChannels;
  const L = length * numOfChan * 2 + 44;
  const buffer = new ArrayBuffer(L);
  const view = new DataView(buffer);
  const channels = [];

  let i,
    sample,
    offset = 0,
    pos = 0;

  // Header
  setUint32(0x46464952); // "RIFF"
  setUint32(L - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"
  setUint32(0x20746d66); // "fmt "
  setUint32(16); // length = 16
  setUint16(1); // PCM
  setUint16(numOfChan);
  setUint32(sampleRate);
  setUint32(sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit
  setUint32(0x61746164); // "data"
  setUint32(L - pos - 4); // chunk length

  for (i = 0; i < numOfChan; i++)
    channels.push(abuffer.getChannelData(i).slice(startSample, endSample));

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
// Helper: Format Seconds to MM:SS.ms
// =================================================================================
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
};

interface Segment {
  id: string;
  name: string;
  start: number;
  end: number;
  color: string;
}

const AudioSplitter = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsPluginRef = useRef<RegionsPlugin | null>(null);

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(50);
  const [segments, setSegments] = useState<Segment[]>([]);

  // Playback state for Slider
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const isDraggingSliderRef = useRef(false); // Prevent jitter while dragging

  // 1. Handle File Drop
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      setAudioFile(acceptedFiles[0]);
      setSegments([]);
      setCurrentTime(0);
      setDuration(0);
    }
  }, []);

  // 2. Initialize WaveSurfer & Load Audio
  useEffect(() => {
    if (!audioFile || !containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "rgb(200, 200, 200)",
      progressColor: "rgb(100, 100, 100)",
      height: 128,
      minPxPerSec: zoom,
      interact: true,
      autoScroll: true,
    });

    const wsRegions = RegionsPlugin.create();
    ws.registerPlugin(wsRegions);
    regionsPluginRef.current = wsRegions;
    wavesurferRef.current = ws;

    // Events
    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));

    // Sync Time for Slider
    ws.on("timeupdate", (t) => {
      if (!isDraggingSliderRef.current) {
        setCurrentTime(t);
      }
    });

    ws.on("decode", () => {
      const dur = ws.getDuration();
      setDuration(dur);

      // Init Region
      wsRegions.clearRegions();
      const initialId = Date.now().toString();
      wsRegions.addRegion({
        id: initialId,
        start: 0,
        end: dur,
        color: "rgba(0, 123, 255, 0.2)",
        drag: true,
        resize: true,
      });

      setSegments([
        {
          id: initialId,
          name: "Segment 1",
          start: 0,
          end: dur,
          color: "rgba(0, 123, 255, 0.2)",
        },
      ]);
    });

    // Region Sync
    wsRegions.on("region-updated", (region) => {
      setSegments((prev) =>
        prev
          .map((s) =>
            s.id === region.id
              ? { ...s, start: region.start, end: region.end }
              : s,
          )
          .sort((a, b) => a.start - b.start),
      );
    });

    wsRegions.on("region-clicked", (region, e) => {
      e.stopPropagation();
      region.play();
    });

    // Load Audio
    const url = URL.createObjectURL(audioFile);
    ws.load(url);

    // Decode for export
    const decodeAudio = async () => {
      try {
        const arrayBuffer = await audioFile.arrayBuffer();
        const audioContext = new AudioContext();
        const decoded = await audioContext.decodeAudioData(arrayBuffer);
        setAudioBuffer(decoded);
      } catch (e) {
        console.error("Error decoding audio", e);
      }
    };
    decodeAudio();

    return () => {
      ws.destroy();
      URL.revokeObjectURL(url);
    };
  }, [audioFile]);

  // Handle Zoom change
  useEffect(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.zoom(zoom);
    }
  }, [zoom]);

  // Handle Slider Change
  const handleSliderChange = (value: number[]) => {
    const newTime = value[0];
    setCurrentTime(newTime);

    if (wavesurferRef.current && duration > 0) {
      // WaveSurfer seekTo takes a progress from 0 to 1
      const progress = newTime / duration;
      wavesurferRef.current.seekTo(progress);
    }
  };

  const splitSegment = () => {
    if (!regionsPluginRef.current || !wavesurferRef.current) return;

    const time = wavesurferRef.current.getCurrentTime();
    const regions = regionsPluginRef.current.getRegions();
    const targetRegion = regions.find((r) => time > r.start && time < r.end);

    if (targetRegion) {
      const oldEnd = targetRegion.end;
      const oldId = targetRegion.id;

      targetRegion.setOptions({ end: time });

      const newId = (Date.now() + Math.random()).toString();
      regionsPluginRef.current.addRegion({
        id: newId,
        start: time,
        end: oldEnd,
        color: getRandomColor(),
        drag: true,
        resize: true,
      });

      setSegments((prev) => {
        const idx = prev.findIndex((s) => s.id === oldId);
        if (idx === -1) return prev;

        const newSegs = [...prev];
        newSegs[idx] = { ...newSegs[idx], end: time };

        const newSegment = {
          id: newId,
          name: `Segment ${prev.length + 1}`,
          start: time,
          end: oldEnd,
          color: "rgba(0, 123, 255, 0.2)",
        };
        newSegs.splice(idx + 1, 0, newSegment);

        return newSegs;
      });
    }
  };

  const getRandomColor = () => {
    return `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 0.2)`;
  };

  const updateSegmentName = (id: string, newName: string) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === id ? { ...s, name: newName } : s)),
    );
  };

  const downloadSegment = (id: string) => {
    const segment = segments.find((s) => s.id === id);
    if (!segment || !audioBuffer) return;

    const blob = bufferToWave(audioBuffer, segment.start, segment.end);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${segment.name}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const deleteSegment = (id: string) => {
    const region = regionsPluginRef.current
      ?.getRegions()
      .find((r) => r.id === id);
    if (region) {
      region.remove();
      setSegments((prev) => prev.filter((s) => s.id !== id));
    }
  };

  const resetAll = () => {
    setAudioFile(null);
    setAudioBuffer(null);
    setSegments([]);
    setCurrentTime(0);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Upload Source Audio</CardTitle>
          <CardDescription>
            Upload a long file to split into individual clips.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!audioFile ? (
            <Dropzone
              onDrop={onDrop}
              accept={{ "audio/*": [] }}
              multiple={false}
            >
              {({ getRootProps, getInputProps }) => (
                <div
                  {...getRootProps()}
                  className="flex items-center justify-center w-full p-10 border-2 border-dashed rounded-lg cursor-pointer border-muted hover:border-primary transition-colors"
                >
                  <input {...getInputProps()} />
                  <div className="text-center">
                    <Plus className="mx-auto h-12 w-12 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      Drag audio file here or click to upload
                    </p>
                  </div>
                </div>
              )}
            </Dropzone>
          ) : (
            <div className="flex items-center justify-between bg-muted p-3 rounded-md">
              <span className="font-medium truncate">{audioFile.name}</span>
              <Button variant="ghost" size="sm" onClick={resetAll}>
                <RotateCcw className="mr-2 h-4 w-4" /> Reset / New File
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {audioFile && (
        <>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle>2. Slice & Edit</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setZoom((z) => Math.max(10, z - 10))}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setZoom((z) => z + 10)}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md bg-background p-4 mb-2">
                <div ref={containerRef} className="w-full" />
              </div>

              {/* SLIDER CONTROL */}
              <div className="mb-6 px-2 flex items-center gap-4">
                <span className="text-sm font-mono text-muted-foreground w-16">
                  {formatTime(currentTime)}
                </span>
                <Slider
                  value={[currentTime]}
                  min={0}
                  max={duration || 100}
                  step={0.01}
                  onValueChange={handleSliderChange}
                  onPointerDown={() => {
                    isDraggingSliderRef.current = true;
                  }}
                  onPointerUp={() => {
                    isDraggingSliderRef.current = false;
                  }}
                  className="flex-grow cursor-pointer"
                />
                <span className="text-sm font-mono text-muted-foreground w-16 text-right">
                  {formatTime(duration)}
                </span>
              </div>

              <div className="flex gap-4 justify-center">
                <Button
                  onClick={() => wavesurferRef.current?.playPause()}
                  variant="secondary"
                  size="lg"
                  className="w-32"
                >
                  {isPlaying ? (
                    <Pause className="mr-2 h-4 w-4" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  {isPlaying ? "Pause" : "Play"}
                </Button>

                <Button onClick={splitSegment} size="lg" className="w-40">
                  <Scissors className="mr-2 h-4 w-4" />
                  Split Here
                </Button>
              </div>
              <p className="text-center text-sm text-muted-foreground mt-2">
                Drag the slider for precision, then click "Split Here".
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Export Segments</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Index</TableHead>
                    <TableHead>Segment Name</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {segments.map((segment, index) => (
                    <TableRow key={segment.id}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell>
                        <Input
                          value={segment.name}
                          onChange={(e) =>
                            updateSegmentName(segment.id, e.target.value)
                          }
                          className="max-w-[300px]"
                        />
                      </TableCell>
                      <TableCell>{segment.start.toFixed(2)}s</TableCell>
                      <TableCell>{segment.end.toFixed(2)}s</TableCell>
                      <TableCell className="text-right flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            const r = regionsPluginRef.current
                              ?.getRegions()
                              .find((rg) => rg.id === segment.id);
                            r?.play();
                          }}
                          title="Preview"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => deleteSegment(segment.id)}
                          title="Delete Segment"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => downloadSegment(segment.id)}
                        >
                          <Download className="mr-2 h-4 w-4" /> Save
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {segments.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center h-24 text-muted-foreground"
                      >
                        No segments available.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default AudioSplitter;
