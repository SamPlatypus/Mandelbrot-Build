import { createFileRoute } from "@tanstack/react-router";
import { MandelbrotExplorer } from "@/components/mandelbrot-explorer";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <MandelbrotExplorer />;
}
