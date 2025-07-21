import React, { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity } from "lucide-react";

interface ProsodyVizProps {
  audioBuffer: AudioBuffer | null;
  onAnalysisComplete: (data: {
    pitch: number[];
    intensity: number[];
    voiced: boolean[];
  }) => void;
  analysisData: {
    pitch: number[];
    intensity: number[];
    voiced: boolean[];
  } | null;
}

const ProsodyViz: React.FC<ProsodyVizProps> = ({
  audioBuffer,
  onAnalysisComplete,
  analysisData,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isAnalyzingRef = useRef(false);

  // Improved pitch detection using YIN algorithm
  const detectPitch = (buffer: Float32Array, sampleRate: number) => {
    const yinBuffer = new Float32Array(buffer.length / 2);
    const threshold = 0.15;
    let tau;

    // Step 1: Calculate difference function
    for (let t = 0; t < yinBuffer.length; t++) {
      yinBuffer[t] = 0;
      for (let j = 0; j < yinBuffer.length; j++) {
        const delta = buffer[j] - buffer[j + t];
        yinBuffer[t] += delta * delta;
      }
    }

    // Step 2: Cumulative mean normalized difference
    yinBuffer[0] = 1;
    let sum = 0;
    for (let t = 1; t < yinBuffer.length; t++) {
      sum += yinBuffer[t];
      yinBuffer[t] *= t / sum;
    }

    // Step 3: Absolute threshold
    tau = 2;
    while (tau < yinBuffer.length && yinBuffer[tau] > threshold) {
      tau++;
    }

    if (tau === yinBuffer.length || yinBuffer[tau] >= 1) {
      return -1; // No pitch detected
    }

    // Step 4: Parabolic interpolation for better accuracy
    let x0 = tau < 1 ? tau : tau - 1;
    let x2 = tau + 1 < yinBuffer.length ? tau + 1 : tau;
    let s0, s1, s2;

    s0 = yinBuffer[x0];
    s1 = yinBuffer[tau];
    s2 = yinBuffer[x2];

    const betterTau = tau + (s2 - s0) / (2 * (2 * s1 - s2 - s0));

    return sampleRate / betterTau;
  };

  const analyzeProsody = async () => {
    if (!audioBuffer || isAnalyzingRef.current) return;

    isAnalyzingRef.current = true;
    const pitchData: number[] = [];
    const intensityData: number[] = [];
    const voicedData: boolean[] = [];

    const windowSize = 1024;
    const hopSize = 512;
    const sampleRate = audioBuffer.sampleRate;
    const channelData = audioBuffer.getChannelData(0);

    for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
      const window = channelData.slice(i, i + windowSize);

      // Calculate intensity (RMS)
      let sum = 0;
      for (let j = 0; j < window.length; j++) {
        sum += window[j] * window[j];
      }
      const rms = Math.sqrt(sum / window.length);
      intensityData.push(rms);

      // Detect pitch
      const pitch = detectPitch(window, sampleRate);
      pitchData.push(pitch);
      voicedData.push(pitch > 0 && rms > 0.01);
    }

    onAnalysisComplete({
      pitch: pitchData,
      intensity: intensityData,
      voiced: voicedData,
    });
    isAnalyzingRef.current = false;
  };

  // Draw visualization
  useEffect(() => {
    if (!analysisData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Draw waveform background
    if (audioBuffer) {
      const channelData = audioBuffer.getChannelData(0);
      ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
      ctx.lineWidth = 1;
      ctx.beginPath();

      for (let i = 0; i < width; i++) {
        const index = Math.floor((i / width) * channelData.length);
        const value = channelData[index] * (height / 2);
        const y = height / 2 - value;

        if (i === 0) {
          ctx.moveTo(i, y);
        } else {
          ctx.lineTo(i, y);
        }
      }
      ctx.stroke();
    }

    // Normalize and draw pitch contour
    const pitchValues = analysisData.pitch
      .filter((_, i) => analysisData.voiced[i])
      .map((p) => Math.log2(p / 220) * 12); // Convert to semitones relative to A3 (220Hz)

    if (pitchValues.length > 0) {
      const minPitch = Math.min(...pitchValues);
      const maxPitch = Math.max(...pitchValues);
      const pitchRange = maxPitch - minPitch || 12; // 1 octave default range

      ctx.strokeStyle = "hsl(210, 80%, 50%)";
      ctx.lineWidth = 2;
      ctx.beginPath();

      analysisData.pitch.forEach((pitch, i) => {
        if (!analysisData.voiced[i]) return;

        const semitone = Math.log2(pitch / 220) * 12;
        const x = (i / analysisData.pitch.length) * width;
        const y =
          height - 20 - ((semitone - minPitch) / pitchRange) * (height - 40);

        if (i === 0 || !analysisData.voiced[i - 1]) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    }

    // Draw intensity
    const maxIntensity = Math.max(...analysisData.intensity);
    ctx.strokeStyle = "hsl(0, 80%, 50%)";
    ctx.lineWidth = 2;
    ctx.beginPath();

    analysisData.intensity.forEach((intensity, i) => {
      const x = (i / analysisData.intensity.length) * width;
      const y = height - 20 - (intensity / maxIntensity) * (height - 40);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Draw legend
    ctx.fillStyle = "black";
    ctx.font = "12px sans-serif";
    ctx.fillText("Pitch (semitones)", 10, 20);
    ctx.fillText("Intensity", 10, 40);

    // Draw pitch legend markers
    ctx.fillStyle = "hsl(210, 80%, 50%)";
    ctx.fillRect(120, 10, 20, 2);
    ctx.fillStyle = "hsl(0, 80%, 50%)";
    ctx.fillRect(120, 30, 20, 2);
  }, [analysisData, audioBuffer]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          <span>Prosody Analysis</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={analyzeProsody}
          disabled={!audioBuffer}
          className="w-full"
        >
          Analyze Prosody
        </Button>

        <div className="mt-4">
          <canvas
            ref={canvasRef}
            width={800}
            height={200}
            className="w-full h-48 border rounded bg-white"
          />
          <div className="text-sm text-muted-foreground mt-2">
            <p>
              • Blue line shows pitch variation (in semitones relative to A3)
            </p>
            <p>• Red line shows volume intensity</p>
            <p>• Gray background shows the original waveform</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProsodyViz;
