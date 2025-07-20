// src/components/AudioProcessor/ProcessingSteps/ProsodyViz.tsx
import React from "react";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Activity } from "lucide-react";

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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            <span>Prosody Visualization</span>
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
          <div className="space-y-3">
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

          <div className="pt-2">
            <Button variant="outline" size="sm">
              Analyze Prosody
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default ProsodyViz;
