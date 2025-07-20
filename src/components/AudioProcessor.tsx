// src/components/AudioProcessor.tsx

import { useState, useRef, useCallback } from "react";
import { useWavesurfer } from "@wavesurfer/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Dropzone from "react-dropzone";
import { Play, Pause, Download, Sparkles } from "lucide-react";

// Helper function to convert an AudioBuffer to a WAV file (Blob)
const bufferToWave = (abuffer: AudioBuffer): Blob => {
  const numOfChan = abuffer.numberOfChannels;
  const L = abuffer.length * numOfChan * 2 + 44;
  const buffer = new ArrayBuffer(L);
  const view = new DataView(buffer);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  // write WAVE header
  setUint32(0x46464952); // "RIFF"
  setUint32(L - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(abuffer.sampleRate);
  setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit

  setUint32(0x61746164); // "data" - chunk
  setUint32(L - pos - 4); // chunk length

  for (i = 0; i < abuffer.numberOfChannels; i++)
    channels.push(abuffer.getChannelData(i));

  while (pos < L) {
    for (i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
      view.setInt16(pos, sample, true); // write 16-bit sample
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

const AudioProcessor = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [processedAudioBlob, setProcessedAudioBlob] = useState<Blob | null>(
    null
  );

  const { wavesurfer, isPlaying } = useWavesurfer({
    container: containerRef,
    height: 120,
    waveColor: "hsl(var(--muted-foreground))",
    progressColor: "hsl(var(--primary))",
    url: audioFile ? URL.createObjectURL(audioFile) : undefined,
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles[0]) {
      setAudioFile(acceptedFiles[0]);
      setProcessedAudioBlob(null); // Reset on new file upload
    }
  }, []);

  const handlePlayPause = () => wavesurfer?.playPause();

  const handleProcessAudio = () => {
    if (!wavesurfer) return;
    const originalBuffer = wavesurfer.getDecodedData();
    if (!originalBuffer) {
      alert("Audio not ready yet.");
      return;
    }

    const audioContext = new AudioContext();
    const paddingSeconds = 0.1;
    const newLength =
      originalBuffer.length + 2 * (paddingSeconds * originalBuffer.sampleRate);
    const newBuffer = audioContext.createBuffer(
      originalBuffer.numberOfChannels,
      newLength,
      originalBuffer.sampleRate
    );

    for (let i = 0; i < originalBuffer.numberOfChannels; i++) {
      const channel = newBuffer.getChannelData(i);
      const originalChannel = originalBuffer.getChannelData(i);
      channel.set(originalChannel, paddingSeconds * originalBuffer.sampleRate);
    }

    setProcessedAudioBlob(bufferToWave(newBuffer));
    alert("Audio processed successfully! You can now download it.");
  };

  const handleDownload = () => {
    if (!processedAudioBlob || !audioFile) return;
    const originalName = audioFile.name.split(".").slice(0, -1).join(".");
    const downloadUrl = URL.createObjectURL(processedAudioBlob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `${originalName}-padded.wav`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(downloadUrl);
    a.remove();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload, Process & Download</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Dropzone onDrop={onDrop} accept={{ "audio/*": [] }}>
          {({ getRootProps, getInputProps }) => (
            <div
              {...getRootProps()}
              className="flex items-center justify-center w-full p-10 border-2 border-dashed rounded-lg cursor-pointer border-muted hover:border-primary"
            >
              <input {...getInputProps()} />
              <p>Drop an audio file here</p>
            </div>
          )}
        </Dropzone>

        {audioFile && (
          <div>
            <div ref={containerRef} className="w-full mb-4" />
            <div className="flex items-center gap-4">
              <Button onClick={handlePlayPause} variant="outline">
                <Play className="mr-2 h-4 w-4" /> Play Original
              </Button>
              <Button onClick={handleProcessAudio}>
                <Sparkles className="mr-2 h-4 w-4" /> Process & Pad Audio
              </Button>
              <Button onClick={handleDownload} disabled={!processedAudioBlob}>
                <Download className="mr-2 h-4 w-4" /> Download Processed
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AudioProcessor;
