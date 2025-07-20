import AudioProcessor from "./components/AudioProcessor";
import { ThemeProvider } from "./components/theme-provider";

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
              A simple tool to pad and test audio clips.
            </p>
          </div>
        </header>
        <main className="container mx-auto p-4">
          <AudioProcessor />
        </main>
      </div>
    </ThemeProvider>
  );
}

export default App;
