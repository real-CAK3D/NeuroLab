import Phaser from "phaser";
import { useEffect, useRef } from "react";
import { FacilityScene } from "../game/FacilityScene";

export function PhaserFacility() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: mountRef.current,
      width: 1366,
      height: 768,
      backgroundColor: "#11151d",
      pixelArt: true,
      antialias: false,
      roundPixels: true,
      scene: new FacilityScene(),
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    });
    return () => {
      game.destroy(true);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="mx-auto aspect-[1366/768] w-full max-w-[1366px] overflow-hidden border-4 border-[#3f4f5a] bg-[#11151d] [image-rendering:pixelated]"
    />
  );
}
