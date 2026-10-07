import { GEN2_H, GEN2_TILE, GEN2_W } from "../game/gen2FacilityData";
import { DIR_ANGLE, DIR_LEFT_OF, DIR_OPPOSITE, DIR_RIGHT_OF, DIR_VEC, tileKey, type WalkDir, type WalkHost, type WalkNpc, type WalkView } from "./walkTypes";

/** One held control. up/down/left/right mean move in top-down view and forward/back/turn in first person. */
export type WalkToken = "up" | "down" | "left" | "right" | "sl" | "sr";

export type WalkEngineState = {
  view: WalkView;
  x: number;
  y: number;
  dir: WalkDir;
  /** What the player is facing right now (staff name, prop name) or "". */
  facing: string;
  /** Transient feedback line ("NOTHING THERE."). */
  message: string;
};

/** The first-person renderer plugs in through this interface (see raycaster.ts). */
export type FpRenderer = {
  resize(cssWidth: number, cssHeight: number): void;
  render(cam: { x: number; y: number; angle: number }, now: number): void;
  setNpcs(list: WalkNpc[], now: number): void;
  /** True while an NPC in view is still tweening between tiles (keeps frames coming). */
  isAnimating(cam: { x: number; y: number; angle: number }, now: number): boolean;
  dispose(): void;
};

export type WalkEngineOptions = {
  host: () => WalkHost;
  viewport: HTMLElement;
  board: HTMLElement;
  player: HTMLElement;
  playerSprite: HTMLElement;
  canvas: HTMLCanvasElement;
  overviewTransform: () => string;
  /** Mutable tile the NPC simulation treats as occupied (written on every step, cleared on dispose). */
  playerTile: { current: { x: number; y: number } | null };
  spawn: { x: number; y: number; dir: WalkDir };
  view: WalkView;
  createFp: (canvas: HTMLCanvasElement, host: () => WalkHost) => Promise<FpRenderer>;
  onState: (state: WalkEngineState) => void;
  onViewChange: (view: WalkView) => void;
  onExit: () => void;
};

const STEP_MS_TOP = 175;
const STEP_MS_FP = 230;
const TURN_MS_FP = 210;
const IDLE_FP_MS = 260;
const FACING_POLL_MS = 400;

const KEY_TOKENS: Record<string, WalkToken> = {
  arrowup: "up",
  w: "up",
  arrowdown: "down",
  s: "down",
  arrowleft: "left",
  a: "left",
  arrowright: "right",
  d: "right",
  q: "sl",
  e: "sr",
};

function easeInOut(t: number) {
  return t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);
}

function wrapAngle(angle: number) {
  let a = angle % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export class WalkEngine {
  private readonly opts: WalkEngineOptions;
  private px: number;
  private py: number;
  private dir: WalkDir;
  private view: WalkView;
  /** Continuous first-person heading in radians (follows `dir`, turning smoothly). */
  private heading: number;
  private move?: { fx: number; fy: number; tx: number; ty: number; t0: number; dur: number };
  private turn?: { from: number; to: number; t0: number; dur: number };
  private held: WalkToken[] = [];
  /** A tap shorter than one frame still takes one step. */
  private tap?: WalkToken;
  private raf = 0;
  private idleTimer = 0;
  private facingTimer = 0;
  private disposed = false;
  private fp?: FpRenderer;
  private fpLoading = false;
  private zoom = 4;
  private stepFlip = false;
  private lastFacing = "";
  private lastMessage = "";
  private messageUntil = 0;
  private lastEmit = "";
  private dirty = true;
  private resizeObserver?: ResizeObserver;
  private readonly onKeyDown = (event: KeyboardEvent) => this.handleKeyDown(event);
  private readonly onKeyUp = (event: KeyboardEvent) => this.handleKeyUp(event);
  private readonly onBlur = () => this.releaseAll();
  private readonly onVisibility = () => {
    if (document.hidden) this.releaseAll();
    else this.kick();
  };
  private readonly onResize = () => this.handleResize();

  constructor(opts: WalkEngineOptions) {
    this.opts = opts;
    this.px = opts.spawn.x;
    this.py = opts.spawn.y;
    this.dir = opts.spawn.dir;
    this.heading = DIR_ANGLE[this.dir];
    this.view = opts.view;
  }

  start() {
    const { player, board, viewport } = this.opts;
    this.opts.playerTile.current = { x: this.px, y: this.py };
    this.zoom = this.pickZoom();
    // Place the player and camera instantly, then switch the smooth transitions on.
    board.classList.remove("walk-cam");
    player.classList.remove("walk-player-smooth");
    this.placePlayer(false);
    this.applySpriteClasses(0);
    void board.offsetWidth;
    window.requestAnimationFrame(() => {
      if (this.disposed) return;
      board.classList.add("walk-cam");
      player.classList.add("walk-player-smooth");
    });
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    window.addEventListener("resize", this.onResize);
    document.addEventListener("visibilitychange", this.onVisibility);
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(viewport);
    }
    this.facingTimer = window.setInterval(() => this.refreshFacing(), FACING_POLL_MS);
    this.refreshFacing(true);
    this.setView(this.view, true);
    this.emit(true);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.resizeObserver?.disconnect();
    if (this.raf) window.cancelAnimationFrame(this.raf);
    if (this.idleTimer) window.clearTimeout(this.idleTimer);
    window.clearInterval(this.facingTimer);
    this.raf = 0;
    this.fp?.dispose();
    this.fp = undefined;
    this.held = [];
    this.opts.playerTile.current = null;
    this.opts.board.classList.remove("walk-cam");
    this.opts.board.style.transform = this.opts.overviewTransform();
  }

  // ---- public controls (keyboard handler and the on-screen pad both call these) ----

  press(token: WalkToken) {
    if (this.disposed) return;
    if (this.opts.host().inputBlocked()) return;
    this.held = [...this.held.filter((item) => item !== token), token];
    this.tap = token;
    this.kick();
  }

  release(token: WalkToken) {
    this.held = this.held.filter((item) => item !== token);
  }

  releaseAll() {
    this.held = [];
  }

  actionA() {
    if (this.disposed || this.opts.host().inputBlocked()) return;
    if (this.move || this.turn) return;
    const vec = DIR_VEC[this.dir];
    const message = this.opts.host().interact(this.px + vec.x, this.py + vec.y);
    this.setMessage(message ?? "");
    this.kick();
  }

  actionB() {
    if (this.disposed) return;
    if (this.opts.host().back()) return;
    this.opts.onExit();
  }

  toggleView() {
    this.requestView(this.view === "top" ? "fp" : "top");
  }

  requestView(view: WalkView) {
    if (view === this.view) return;
    this.opts.onViewChange(view);
    this.setView(view);
  }

  /** The dashboard's NPC list changed (a simulation tick). */
  npcsChanged() {
    if (this.disposed) return;
    if (this.view === "fp") {
      this.fp?.setNpcs(this.opts.host().getNpcs(), performance.now());
      this.dirty = true;
      this.kick();
    }
    this.refreshFacing();
  }

  /** The overview transform prop changed (window resize): re-apply the camera. */
  refreshCamera() {
    if (this.disposed) return;
    this.zoom = this.pickZoom();
    this.placePlayer(false);
  }

  setView(view: WalkView, initial = false) {
    if (this.disposed) return;
    const changed = view !== this.view;
    this.view = view;
    if (view === "fp") {
      void this.ensureFp();
    } else {
      this.snapHeading();
      this.placePlayer(false);
    }
    if (changed || initial) {
      this.dirty = true;
      this.kick();
      this.emit(true);
    }
  }

  // ---- input ----

  private handleKeyDown(event: KeyboardEvent) {
    if (this.disposed) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    const tag = target?.tagName;
    if (target && (["INPUT", "TEXTAREA", "SELECT"].includes(tag ?? "") || target.isContentEditable)) return;
    const key = event.key.toLowerCase();
    const token = KEY_TOKENS[key];
    const handled = !!token || key === "enter" || key === " " || key === "spacebar" || key === "escape" || key === "v";
    if (!handled) return;
    event.preventDefault();
    if (key === "escape") {
      if (!event.repeat) this.actionB();
      return;
    }
    if (this.opts.host().inputBlocked()) {
      this.releaseAll();
      return;
    }
    // Keep a focused toolbar button from also receiving the keystroke as a click.
    if (tag === "BUTTON") (target as HTMLElement).blur();
    if (token) {
      if (!event.repeat) this.press(token);
      return;
    }
    if (event.repeat) return;
    if (key === "v") this.toggleView();
    else this.actionA();
  }

  private handleKeyUp(event: KeyboardEvent) {
    const token = KEY_TOKENS[event.key.toLowerCase()];
    if (token) this.release(token);
  }

  // ---- loop ----

  private kick() {
    if (this.disposed || this.raf || document.hidden) return;
    this.raf = window.requestAnimationFrame((now) => this.frame(now));
  }

  private frame(now: number) {
    this.raf = 0;
    if (this.disposed || document.hidden) return;
    if (this.move && now >= this.move.t0 + this.move.dur) this.finishMove();
    if (this.turn && now >= this.turn.t0 + this.turn.dur) this.finishTurn();
    this.beginNext(now);

    const cam = this.camera(now);
    let animating = false;
    if (this.view === "fp" && this.fp) {
      const npcFrames = this.fp.isAnimating(cam, now);
      const needsDraw = this.dirty || !!this.move || !!this.turn || npcFrames;
      animating = !!this.move || !!this.turn || npcFrames;
      if (needsDraw) {
        this.fp.render(cam, now);
        this.dirty = false;
      }
    }
    if (this.messageUntil && now > this.messageUntil) this.setMessage("");

    const active = !!this.move || !!this.turn || this.held.length > 0 || !!this.tap || animating || this.dirty;
    if (active) this.kick();
    else this.scheduleIdle();
  }

  /** In first person keep a slow heartbeat so light shimmer and far NPC steps show up without a hot loop. */
  private scheduleIdle() {
    if (this.view !== "fp" || this.idleTimer || this.disposed) return;
    this.idleTimer = window.setTimeout(() => {
      this.idleTimer = 0;
      if (this.disposed || document.hidden) return;
      this.dirty = true;
      this.kick();
    }, IDLE_FP_MS);
  }

  private beginNext(now: number) {
    if (this.move || this.turn) return;
    if (this.held.length === 0 && !this.tap) return;
    if (this.opts.host().inputBlocked()) {
      this.held = [];
      this.tap = undefined;
      return;
    }
    const token = this.held[this.held.length - 1] ?? (this.tap as WalkToken);
    this.tap = undefined;
    if (this.view === "top") {
      if (token === "sl" || token === "sr") return;
      this.face(token);
      this.tryMove(token, now);
      return;
    }
    if (token === "left" || token === "right") {
      this.startTurn(token === "left" ? DIR_LEFT_OF[this.dir] : DIR_RIGHT_OF[this.dir], now);
    } else if (token === "up") {
      this.tryMove(this.dir, now);
    } else if (token === "down") {
      this.tryMove(DIR_OPPOSITE[this.dir], now);
    } else if (token === "sl") {
      this.tryMove(DIR_LEFT_OF[this.dir], now);
    } else if (token === "sr") {
      this.tryMove(DIR_RIGHT_OF[this.dir], now);
    }
  }

  private face(dir: WalkDir) {
    if (dir === this.dir) return;
    this.dir = dir;
    this.heading = DIR_ANGLE[dir];
    this.applySpriteClasses(0);
    this.setMessage("");
    this.dirty = true;
    this.refreshFacing();
    this.emit();
  }

  private canEnter(x: number, y: number) {
    if (x < 0 || y < 0 || x >= GEN2_W || y >= GEN2_H) return false;
    const host = this.opts.host();
    if (!host.walkable.has(tileKey(x, y))) return false;
    return !host.getNpcs().some((npc) => npc.x === x && npc.y === y);
  }

  private tryMove(moveDir: WalkDir, now: number) {
    const vec = DIR_VEC[moveDir];
    const nx = this.px + vec.x;
    const ny = this.py + vec.y;
    if (!this.canEnter(nx, ny)) return false;
    const dur = this.view === "top" ? STEP_MS_TOP : STEP_MS_FP;
    this.move = { fx: this.px, fy: this.py, tx: nx, ty: ny, t0: now, dur };
    this.px = nx;
    this.py = ny;
    this.opts.playerTile.current = { x: nx, y: ny };
    this.stepFlip = !this.stepFlip;
    this.applySpriteClasses(this.stepFlip ? 1 : 2);
    this.placePlayer(true);
    this.setMessage("");
    this.dirty = true;
    this.emit();
    return true;
  }

  private finishMove() {
    this.move = undefined;
    this.dirty = true;
    this.refreshFacing(true);
    if (this.held.length === 0) this.applySpriteClasses(0);
    this.emit();
  }

  private startTurn(target: WalkDir, now: number) {
    const from = this.heading;
    let to = DIR_ANGLE[target];
    // Take the short way round (always a 90 degree turn).
    to = from + wrapAngle(to - from);
    this.turn = { from, to, t0: now, dur: TURN_MS_FP };
    this.dir = target;
    this.applySpriteClasses(0);
    this.setMessage("");
    this.dirty = true;
    this.emit();
  }

  private finishTurn() {
    const turn = this.turn;
    this.turn = undefined;
    if (turn) this.heading = wrapAngle(turn.to);
    this.heading = DIR_ANGLE[this.dir];
    this.dirty = true;
    this.refreshFacing(true);
    this.emit();
  }

  private snapHeading() {
    this.turn = undefined;
    this.heading = DIR_ANGLE[this.dir];
  }

  private camera(now: number) {
    let x = this.px + 0.5;
    let y = this.py + 0.5;
    if (this.move) {
      const t = easeInOut((now - this.move.t0) / this.move.dur);
      x = this.move.fx + (this.move.tx - this.move.fx) * t + 0.5;
      y = this.move.fy + (this.move.ty - this.move.fy) * t + 0.5;
    }
    let angle = this.heading;
    if (this.turn) angle = this.turn.from + (this.turn.to - this.turn.from) * easeInOut((now - this.turn.t0) / this.turn.dur);
    return { x, y, angle };
  }

  // ---- top-down presentation ----

  private pickZoom() {
    return this.opts.viewport.clientWidth >= 1100 ? 4 : 3;
  }

  private handleResize() {
    if (this.disposed) return;
    this.zoom = this.pickZoom();
    this.placePlayer(false);
    this.fp?.resize(this.opts.viewport.clientWidth, this.opts.viewport.clientHeight);
    this.dirty = true;
    this.kick();
  }

  private placePlayer(animate: boolean) {
    void animate;
    const { player, board, viewport } = this.opts;
    player.style.left = `${this.px * GEN2_TILE + 1}px`;
    player.style.top = `${this.py * GEN2_TILE - 8}px`;
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const z = this.zoom;
    const worldW = GEN2_W * GEN2_TILE * z;
    const worldH = GEN2_H * GEN2_TILE * z;
    let tx = vw / 2 - (this.px * GEN2_TILE + GEN2_TILE / 2) * z;
    let ty = vh / 2 - (this.py * GEN2_TILE + GEN2_TILE / 2) * z;
    tx = worldW <= vw ? (vw - worldW) / 2 : Math.max(vw - worldW, Math.min(0, tx));
    ty = worldH <= vh ? (vh - worldH) / 2 : Math.max(vh - worldH, Math.min(0, ty));
    board.style.transform = `translate(${Math.round(tx)}px, ${Math.round(ty)}px) scale(${z})`;
  }

  private applySpriteClasses(step: 0 | 1 | 2) {
    const sprite = this.opts.playerSprite;
    sprite.classList.remove("face-up", "face-down", "face-left", "face-right", "step-0", "step-1", "step-2");
    sprite.classList.add(`face-${this.dir}`, `step-${step}`);
  }

  // ---- first person ----

  private async ensureFp() {
    if (this.fp) {
      this.fp.resize(this.opts.viewport.clientWidth, this.opts.viewport.clientHeight);
      this.fp.setNpcs(this.opts.host().getNpcs(), performance.now());
      this.dirty = true;
      this.kick();
      return;
    }
    if (this.fpLoading) return;
    this.fpLoading = true;
    try {
      const renderer = await this.opts.createFp(this.opts.canvas, this.opts.host);
      if (this.disposed) {
        renderer.dispose();
        return;
      }
      this.fp = renderer;
      renderer.resize(this.opts.viewport.clientWidth, this.opts.viewport.clientHeight);
      renderer.setNpcs(this.opts.host().getNpcs(), performance.now());
      this.dirty = true;
      this.kick();
    } catch {
      if (!this.disposed) {
        this.setMessage("FIRST-PERSON VIEW UNAVAILABLE.");
        this.requestView("top");
      }
    } finally {
      this.fpLoading = false;
    }
  }

  // ---- HUD feedback ----

  private refreshFacing(force = false) {
    if (this.disposed) return;
    const vec = DIR_VEC[this.dir];
    const label = this.opts.host().describe(this.px + vec.x, this.py + vec.y);
    if (label !== this.lastFacing || force) {
      this.lastFacing = label;
      this.emit();
    }
  }

  private setMessage(message: string) {
    this.messageUntil = message ? performance.now() + 2200 : 0;
    if (message !== this.lastMessage) {
      this.lastMessage = message;
      this.emit();
    }
  }

  private emit(force = false) {
    const state: WalkEngineState = { view: this.view, x: this.px, y: this.py, dir: this.dir, facing: this.lastFacing, message: this.lastMessage };
    const signature = `${state.view}|${state.x}|${state.y}|${state.dir}|${state.facing}|${state.message}`;
    if (!force && signature === this.lastEmit) return;
    this.lastEmit = signature;
    this.opts.onState(state);
  }
}
