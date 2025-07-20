// src/components/AudioProcessor/ProcessingSteps/VolumeNorm.tsx
import React from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
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
    <div className="space-y-6 pt-4">
      <fieldset
        disabled={!settings.enabled}
        className="disabled:opacity-50 space-y-6"
      >
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
      </fieldset>
    </div>
  );
};

export default VolumeNorm;
