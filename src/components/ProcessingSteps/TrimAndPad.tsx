// src/components/AudioProcessor/ProcessingSteps/TrimAndPad.tsx
import React from "react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Scissors } from "lucide-react";

interface TrimPadSettings {
  enabled: boolean;
  paddingMs: number;
  thresholdDb: number;
  fadeInMs: number;
  fadeOutMs: number;
}

interface TrimAndPadProps {
  settings: TrimPadSettings;
  onSettingsChange: (newSettings: Partial<TrimPadSettings>) => void;
}

const TrimAndPad: React.FC<TrimAndPadProps> = ({
  settings,
  onSettingsChange,
}) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scissors className="h-5 w-5" />
            <span>Auto-Trim & Pad</span>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(checked) =>
              onSettingsChange({ enabled: checked })
            }
          />
        </CardTitle>
      </CardHeader>

      {settings.enabled && (
        <CardContent className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Silence Threshold ({settings.thresholdDb} dB)</Label>
            <Slider
              min={-60}
              max={0}
              step={1}
              value={[settings.thresholdDb]}
              onValueChange={([val]) => onSettingsChange({ thresholdDb: val })}
            />
          </div>
          <div className="space-y-2">
            <Label>Padding (ms)</Label>
            <Input
              type="number"
              value={settings.paddingMs}
              onChange={(e) =>
                onSettingsChange({ paddingMs: parseInt(e.target.value) || 0 })
              }
            />
            <p className="text-sm text-muted-foreground">
              Milliseconds before and after audio.
            </p>
          </div>
          <div className="pt-2">
            <Label>Micro-Fades</Label>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="fade-in">Fade-In (ms)</Label>
                <Input
                  id="fade-in"
                  type="number"
                  value={settings.fadeInMs}
                  onChange={(e) =>
                    onSettingsChange({
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
                  value={settings.fadeOutMs}
                  onChange={(e) =>
                    onSettingsChange({
                      fadeOutMs: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default TrimAndPad;
