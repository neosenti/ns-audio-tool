// src/App.tsx

import { ThemeProvider } from "@/components/theme-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AudioProcessor from "./components/AudioProcessor";
import SequenceTester from "./components/SequenceTester";

function App() {
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
              <TabsTrigger value="processor">1. Audio Processor</TabsTrigger>
              <TabsTrigger value="tester">2. Sequence Tester</TabsTrigger>
            </TabsList>

            <TabsContent value="processor" className="mt-4">
              <AudioProcessor />
            </TabsContent>

            <TabsContent value="tester" className="mt-4">
              <SequenceTester />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </ThemeProvider>
  );
}

export default App;
