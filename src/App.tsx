// src/App.tsx

import { ThemeProvider } from "@/components/theme-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AudioProcessor from "./components/AudioProcessor";
import SequenceTester from "./components/SequenceTester";
import AudioSplitter from "./components/AudioSplitter";
import BatchProcessor from "./components/BatchProcessor"; // Import new component

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
              Slice, process, and test your voice clips.
            </p>
          </div>
        </header>
        <main className="container mx-auto p-4">
          <Tabs defaultValue="batch" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="splitter">1. Splitter</TabsTrigger>
              <TabsTrigger value="batch">2. Batch Processor</TabsTrigger>
              <TabsTrigger value="processor">3. Single Processor</TabsTrigger>
              <TabsTrigger value="tester">4. Sequence Tester</TabsTrigger>
            </TabsList>

            <TabsContent value="splitter" className="mt-4">
              <AudioSplitter />
            </TabsContent>

            <TabsContent value="batch" className="mt-4">
              <BatchProcessor />
            </TabsContent>

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
