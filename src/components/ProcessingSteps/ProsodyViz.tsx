// src/components/AudioProcessor/ProcessingSteps/ProsodyViz.tsx
import React from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProsodyVizSettings {
  enabled: boolean;
  showPitch: boolean;
  showIntensity: boolean;
}

interface ProsodyVizProps {
  settings: ProsodyVizSettings;
  onSettingsChange: (newSettings: Partial<ProsodyVizSettings>) => void;
}

const ProsodyViz: React.FC<ProsodyVizProps> = ({
  settings,
  onSettingsChange,
}) => {
  return (
    <div className="space-y-6 pt-4">
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="pitch-viz"
            checked={settings.showPitch}
            onCheckedChange={(checked) =>
              onSettingsChange({ showPitch: checked })
            }
          />
          <Label htmlFor="pitch-viz">Show Pitch Contour</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            id="intensity-viz"
            checked={settings.showIntensity}
            onCheckedChange={(checked) =>
              onSettingsChange({ showIntensity: checked })
            }
          />
          <Label htmlFor="intensity-viz">Show Intensity</Label>
        </div>
      </div>

      <div className="pt-4">
        <Button variant="outline" size="sm">
          Analyze Prosody
        </Button>
      </div>
    </div>
  );
};

export default ProsodyViz;
