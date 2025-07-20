// src/App.tsx

import { useState } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import AudioProcessor from "@/components/AudioProcessor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type ProcessedAudio } from "@/lib/types"; // We will create this type definition file
import SequenceTester from "@/components/SequenceTester";

function App() {
  // This state is "lifted up" to be shared between the two tabs.
  const [processedAudios, setProcessedAudios] = useState<ProcessedAudio[]>([]);

  // This function will be passed down to the AudioProcessor component
  // so it can add newly processed audio to our shared list.
  const addProcessedAudio = (audio: ProcessedAudio) => {
    setProcessedAudios((prev) => [...prev, audio]);
    alert(
      `"${audio.name}" has been processed and is now available in the Sequence Tester.`
    );
  };

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold tracking-tight">
              Voice Actor Audio Tool
            </h1>
            <p className="text-muted-foreground">
              Process your voice clips and test them in sequence.
            </p>
          </div>
        </header>
        <main className="container mx-auto p-4">
          <Tabs defaultValue="processor" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="processor">1. Audio Processing</TabsTrigger>
              <TabsTrigger value="tester">2. Sequence Tester</TabsTrigger>
            </TabsList>

            <TabsContent value="processor" className="mt-4">
              <AudioProcessor onAudioProcessed={addProcessedAudio} />
            </TabsContent>

            <TabsContent value="tester" className="mt-4">
              <SequenceTester availableAudios={processedAudios} />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </ThemeProvider>
  );
}

export default App;
