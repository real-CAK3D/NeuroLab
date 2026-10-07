import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { gen2Rooms } from "../game/gen2FacilityData";
import { WalkEngine, type FpRenderer, type WalkEngineState, type WalkToken } from "./WalkEngine";
import type { WalkDir, WalkHost, WalkView } from "./walkTypes";

type WalkModeProps = {
  hostRef: MutableRefObject<WalkHost>;
  /** Changes whenever the NPC simulation ticks (wakes the first-person renderer). */
  npcs: unknown;
  view: WalkView;
  full: boolean;
  /** true / false forces the on-screen pad, null follows the device. */
  pad: boolean | null;
  viewportRef: RefObject<HTMLDivElement | null>;
  boardRef: RefObject<HTMLDivElement | null>;
  playerRef: RefObject<HTMLDivElement | null>;
  spriteRef: RefObject<HTMLSpanElement | null>;
  overviewTransform: string;
  playerTile: MutableRefObject<{ x: number; y: number } | null>;
  spawn: { x: number; y: number; dir: WalkDir };
  onViewChange: (view: WalkView) => void;
  onFullChange: (full: boolean) => void;
  onPadChange: (pad: boolean | null) => void;
  onExit: () => void;
};

function roomNameAt(x: number, y: number) {
  return gen2Rooms.find((room) => x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h)?.label ?? "HALLWAY";
}

function useTouchLayout() {
  const query = () => typeof window !== "undefined" && (window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 900);
  const [touch, setTouch] = useState(query);
  useEffect(() => {
    const update = () => setTouch(query());
    const media = window.matchMedia("(pointer: coarse)");
    media.addEventListener?.("change", update);
    window.addEventListener("resize", update);
    return () => {
      media.removeEventListener?.("change", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  return touch;
}

/** Facility walk mode: owns the engine (input, movement, camera), the first-person canvas, the HUD and the touch pad. */
export function WalkMode(props: WalkModeProps) {
  const { hostRef, npcs, view, full, pad, viewportRef, boardRef, playerRef, spriteRef, overviewTransform, playerTile, spawn } = props;
  const engineRef = useRef<WalkEngine | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const [state, setState] = useState<WalkEngineState>({ view, x: spawn.x, y: spawn.y, dir: spawn.dir, facing: "", message: "" });
  const touch = useTouchLayout();
  const padVisible = pad ?? touch;

  useEffect(() => {
    const viewport = viewportRef.current;
    const board = boardRef.current;
    const player = playerRef.current;
    const sprite = spriteRef.current;
    const canvas = canvasRef.current;
    if (!viewport || !board || !player || !sprite || !canvas) return undefined;
    const engine = new WalkEngine({
      host: () => hostRef.current,
      viewport,
      board,
      player,
      playerSprite: sprite,
      canvas,
      overviewTransform: () => latest.current.overviewTransform,
      playerTile,
      spawn,
      view: latest.current.view,
      createFp: async (target, host): Promise<FpRenderer> => {
        const module = await import("./raycaster");
        return module.createRaycaster(target, host);
      },
      onState: (next) => setState(next),
      onViewChange: (next) => latest.current.onViewChange(next),
      onExit: () => latest.current.onExit(),
    });
    engineRef.current = engine;
    engine.start();
    return () => {
      engine.dispose();
      if (engineRef.current === engine) engineRef.current = null;
    };
    // The engine lives exactly as long as walk mode; its inputs are read through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.setView(view);
  }, [view]);

  useEffect(() => {
    engineRef.current?.npcsChanged();
  }, [npcs]);

  useLayoutEffect(() => {
    engineRef.current?.refreshCamera();
  }, [overviewTransform, full]);

  useEffect(() => {
    if (!full) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [full]);

  useEffect(() => {
    // Bring the board into view when entering on desktop (touch layouts go fullscreen instead).
    if (!full) viewportRef.current?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roomName = roomNameAt(state.x, state.y);
  const press = (token: WalkToken) => engineRef.current?.press(token);
  const release = (token: WalkToken) => engineRef.current?.release(token);
  const tapButton = (event: ReactPointerEvent<HTMLButtonElement> | React.MouseEvent<HTMLButtonElement>, action: () => void) => {
    action();
    event.currentTarget.blur();
  };

  return (
    <div className={`walk-layer ${view === "fp" ? "is-fp" : "is-top"}`} onClick={(event) => event.stopPropagation()} onContextMenu={(event) => event.preventDefault()}>
      <canvas ref={canvasRef} className="walk-canvas" hidden={view !== "fp"} onClick={() => engineRef.current?.actionA()} />
      {view === "fp" ? <div className="walk-reticle" aria-hidden="true" /> : null}

      <div className="walk-hud" aria-live="polite">
        <div className="walk-hud-room">{roomName}</div>
        <div className="walk-hud-hint">A: INTERACT&nbsp;&nbsp;V: VIEW&nbsp;&nbsp;ESC: EXIT</div>
        {state.message ? <div className="walk-hud-note">{state.message}</div> : state.facing ? <div className="walk-hud-note is-facing">A: {state.facing}</div> : null}
      </div>

      <div className="walk-toolbar">
        <button type="button" onClick={(event) => tapButton(event, () => engineRef.current?.toggleView())} title="Switch top-down / first-person (V)">VIEW: {view === "fp" ? "1ST" : "TOP"}</button>
        <button type="button" className={padVisible ? "is-active" : ""} onClick={(event) => tapButton(event, () => props.onPadChange(!padVisible))} title="Show or hide the on-screen pad">PAD</button>
        <button type="button" className={full ? "is-active" : ""} onClick={(event) => tapButton(event, () => props.onFullChange(!full))} title="Fill the screen">FULL</button>
        <button type="button" className="is-exit" onClick={(event) => tapButton(event, () => props.onExit())} title="Leave walk mode (Esc)">EXIT</button>
      </div>

      {padVisible ? (
        <>
          <div className="walk-pad walk-dpad" role="group" aria-label="Direction pad">
            <PadButton label="Up" token="up" className="pad-up" press={press} release={release} />
            <PadButton label="Left" token="left" className="pad-left" press={press} release={release} />
            <PadButton label="Right" token="right" className="pad-right" press={press} release={release} />
            <PadButton label="Down" token="down" className="pad-down" press={press} release={release} />
            <span className="pad-hub" aria-hidden="true" />
          </div>
          <div className="walk-pad walk-actions" role="group" aria-label="Action buttons">
            <ActionButton label="B" className="pad-b" onPress={() => engineRef.current?.actionB()} />
            <ActionButton label="A" className="pad-a" onPress={() => engineRef.current?.actionA()} />
          </div>
        </>
      ) : null}
    </div>
  );
}

function PadButton({ label, token, className, press, release }: { label: string; token: WalkToken; className: string; press: (token: WalkToken) => void; release: (token: WalkToken) => void }) {
  const down = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // capture is best effort
    }
    event.currentTarget.classList.add("is-down");
    press(token);
  };
  const up = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.currentTarget.classList.remove("is-down");
    release(token);
  };
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      className={`pad-btn ${className}`}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onLostPointerCapture={up}
      onContextMenu={(event) => event.preventDefault()}
    />
  );
}

function ActionButton({ label, className, onPress }: { label: string; className: string; onPress: () => void }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={`${label} button`}
      className={`pad-btn pad-round ${className}`}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.classList.add("is-down");
        onPress();
      }}
      onPointerUp={(event) => event.currentTarget.classList.remove("is-down")}
      onPointerCancel={(event) => event.currentTarget.classList.remove("is-down")}
      onPointerLeave={(event) => event.currentTarget.classList.remove("is-down")}
      onContextMenu={(event) => event.preventDefault()}
    >
      {label}
    </button>
  );
}
