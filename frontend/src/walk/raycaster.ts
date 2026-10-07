import type { FpRenderer } from "./WalkEngine";
import type { WalkHost } from "./walkTypes";

export function createRaycaster(_canvas: HTMLCanvasElement, _host: () => WalkHost): Promise<FpRenderer> {
  return Promise.reject(new Error("first-person renderer not built yet"));
}
