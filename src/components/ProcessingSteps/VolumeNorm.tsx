// src/components/AudioProcessor/ProcessingSteps/VolumeNorm.tsx
import React from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Volume2 } from "lucide-react";

interface VolumeNormSettings {
  enabled: boolean;
  targetDb: number;
}

interface VolumeNormProps {
  settings: VolumeNormSettings;
  onSettingsChange: (newSettings: Partial<VolumeNormSettings>) => void;
}

const VolumeNorm: React.FC<VolumeNormProps> = ({
  settings,
  onSettingsChange,
}) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            <span>Volume Normalization</span>
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
            <Label>Target Volume ({settings.targetDb} dB)</Label>
            <Slider
              min={-24}
              max={0}
              step={0.5}
              value={[settings.targetDb]}
              onValueChange={([val]) => onSettingsChange({ targetDb: val })}
            />
            <p className="text-sm text-muted-foreground">
              Normalize audio to this target volume level
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default VolumeNorm;
