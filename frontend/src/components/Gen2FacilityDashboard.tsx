import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  GEN2_H,
  GEN2_TILE,
  GEN2_W,
  gen2Hallways,
  gen2Npcs,
  gen2PropBlocksMovement,
  gen2Props,
  gen2Rooms,
  type Gen2Direction,
  type Gen2Npc,
  type Gen2NpcRole,
  type Gen2Prop,
  type Gen2Room,
} from "../game/gen2FacilityData";
import { gen2BossHotKeys, gen2BreakWindowAt, gen2ChatTopics, gen2DefaultSchedule, gen2FormatClock, gen2FormatClock12, gen2Hash01, gen2NormalizeSchedule, gen2OnShift, gen2ParseClock, gen2ScheduleBlock, gen2PerformanceBriefs, gen2ReportLogPath, gen2RoomOperations, gen2RoomVitals, gen2SimTraitFor, gen2WorkerIdentity, gen2WorkerProfiles, type Gen2RoomVital, type Gen2Schedule } from "../game/gen2OperationsData";
import type { Gen2HotKey } from "../game/gen2OperationsData";
import { AmbienceOverlay, BirthdayDecor, HolidayDecor, isNight } from "../life/decor";
import { PersonaEditor, type PersonaDrafts } from "../life/PersonaEditor";
import { useBirthdays, useLifeCalendar, useRosterSync } from "../life/useLifeData";
import { chipText, holidayBadge, lifeNow, smallTalkLines, weatherKind } from "../life/calendarLogic";
import { FRIEND_AT, RARE_AT, banterQueuedFor, isFriend, pairAffinity, pumpBanter, takeBanter, type BanterCandidate } from "../life/banterQueue";
import { fileMemory } from "../life/lifeMemory";
import { LIFE_DRY, lifeParam, putPersona, type Persona } from "../life/lifeApi";
import { CELEBRATE_HOLD, LIFE_TALK, activeHold, activeMoment, setMoment } from "../life/moments";
import { LifecyclePanel } from "./LifecyclePanel";
import { WalkMode } from "../walk/WalkMode";
import { TalkDialog } from "../talk/TalkDialog";
import type { TalkBrief } from "../talk/talkBrief";
import type { WalkDir, WalkHost, WalkNpc, WalkPlantLook, WalkView } from "../walk/walkTypes";
import { lifecycleMockEnabled, mockLifecycleSnapshot } from "../game/lifecycleMock";
import {
  deriveLifeEvents,
  isLifecycleSnapshot,
  lifeActiveKeys,
  lifeBatchRooms,
  lifePropState,
  lifeRoomPhase,
  lifeVitals,
  reduceLifeState,
  type LifeBubble,
  type LifeSelection,
  type LifeState,
  type PendingTask,
  type TaskCargo,
  type TaskStop,
} from "../game/lifecycleLogic";
import {
  applyActivityStateSnapshot,
  applyFacilityLayoutSnapshot,
  applyStaffConfigSnapshot,
  chatWithOllama,
  getDockerStats,
  getFacilityDevices,
  getActivityStateSnapshot,
  getFacilityLayoutSnapshot,
  getHostStats,
  getLifecycle,
  getOllamaModels,
  getStaffConfigSnapshot,
  undoActivityStateSnapshot,
  undoFacilityLayoutSnapshot,
  undoStaffConfigSnapshot,
  type DockerStats,
  type FacilityDeviceTelemetry,
  type FacilityDevices,
  type FacilityLayoutSnapshot,
  type FacilityLayoutRoom,
  type HostStats,
  type LifecycleSnapshot,
  type StaffConfigSnapshot,
  type OllamaModels,
} from "../utils/api";

type ActivityInventory = {
  packaging: number;
  extractionBatches: number;
  rdSamples: number;
  rdPassed: number;
  rdFailed: number;
  salesStock: number;
  managerRequests: number;
};

type ActivityEvent = {
  id: string;
  tick: number;
  roomId: string;
  kind: "packaging" | "extraction" | "research" | "test" | "sales" | "manager" | "control";
  message: string;
};

type ActivityState = {
  tick: number;
  phaseLabel: string;
  inventory: ActivityInventory;
  feed: ActivityEvent[];
};

type ActivityControl = "seed-packaging" | "force-extraction" | "force-rd-pass" | "force-rd-fail" | "clear-manager-requests";
type ActivityScenario = "normal-shift" | "rd-failure-storm" | "sales-push" | "manager-sweep";
type ActivityRoomBadge = { label: string; tone: "ready" | "warn" | "busy" };

type NpcNeeds = { energy: number; social: number; hunger: number; bladder: number };
type ErrandKind = "coffee" | "water" | "fridge" | "microwave" | "bathroom" | "sit" | "phone" | "desk" | "seek" | "work" | "leave";
type NpcErrand = {
  kind: ErrandKind;
  x: number;
  y: number;
  face?: Gen2Direction;
  seat?: boolean;
  stage: "go" | "use";
  left: number;
  timeout: number;
  partnerId?: string;
  /** Birthday gathering: ignores the break room's 3-person limit. */
  party?: boolean;
};
/** `script`/`t` are set for AI banter: one entry per turn (empty when the partner speaks), TURN_TICKS ticks each. */
type NpcChat = { with: string; left: number; say: string; side: "l" | "r"; script?: string[]; t?: number };
type NpcSim = {
  needs: NpcNeeds;
  errand?: NpcErrand;
  chat?: NpcChat;
  chatCd: number;
  errandCd: number;
  recent: Record<string, number>;
  via?: { x: number; y: number };
  legFor: number;
  /** "work": hop between stations in the home room. "trip": walk the production/handoff route once. */
  mode: "work" | "trip";
  tripIdx: number;
  tripCd: number;
  /** Break window already used, as "day:slot". */
  lastBreak: string;
  /** Absolute minute (epoch minutes) until which the worker is on a scheduled break. */
  breakUntil: number;
  breakRetry: number;
  /** Event-driven lifecycle job (sterilize a room, carry a batch, ...). Paused by breaks and needs, dropped at shift end. */
  task?: NpcTask;
  /** Was on shift at the previous tick (detects shift start / end). */
  wasOn?: boolean;
  /** Local day number on which the worker clocked out and walked to the screening-room door; they idle there until the next shift. */
  parkedDay?: number;
};
/** A running lifecycle job: a list of stops (see TaskStop), the current stop, and what the worker carries. */
type NpcTask = {
  id: string;
  key: string;
  label: string;
  stops: TaskStop[];
  idx: number;
  stage: "pick" | "go" | "use";
  spot?: { x: number; y: number; face?: Gen2Direction };
  left: number;
  waited: number;
  timeout: number;
  carrying?: TaskCargo;
};
type NpcSimContext = {
  incidentPhase: number;
  stress: Record<string, number>;
  hot: string[];
  alerts: number;
  schedules: Record<string, Gen2Schedule>;
  homes: Record<string, string>;
  /** Facility clock: minute of day (fractional), epoch minutes, local day number. */
  minute: number;
  abs: number;
  day: number;
  /** Lifecycle keys that are true right now ("phase:grow1:sterilizing", "stage:B-0001:trimming") and batch -> room. */
  lifeActive: ReadonlySet<string>;
  batchRoom: Record<string, string>;
  /** True for real-time ticks (false while replaying saved time on load), so one-off bubbles are not spammed. */
  live: boolean;
};

type LiveNpc = Gen2Npc & {
  routeIndex: number;
  stepFrame: 0 | 1 | 2;
  pause: number;
  sim?: NpcSim;
};

type GrowOpsStaff = {
  id: string;
  name: string;
  sex: string;
  age: number;
  workEthic: "LOW" | "STEADY" | "HIGH" | "EXCELLENT";
  evaluation: string;
  department: string;
  title: string;
  role: Gen2NpcRole;
  stationRoomId: string;
  personality: string;
  currentAction: string;
  steadyMood: string;
  busyMood: string;
  reportTarget: string;
  breakPolicy: string;
  hatColor: string;
  shoeColor: string;
  custom: boolean;
  /** Shift hours and break slots (minutes since midnight). */
  schedule?: Gen2Schedule;
};

type VacantDuty = {
  id: string;
  staff: GrowOpsStaff;
  npc: LiveNpc;
};

type FacilityRoomDraft = {
  id: string;
  label: string;
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
  notes: string;
};

type GrowOpsTab = "staff" | "facility";

type Selection =
  | { type: "room"; title: string; lines: string[] }
  | { type: "staff"; title: string; lines: string[] }
  | { type: "plant"; title: string; lines: string[] }
  | { type: "equipment"; title: string; lines: string[] };

type ContextMenuState = {
  x: number;
  y: number;
  title: string;
  items: Array<{ label: string; action: () => void }>;
};

type TerminalSession = {
  title: string;
  model: string;
  lines: string[];
};

type TerminalMessage = {
  speaker: "system" | "user" | "model";
  text: string;
};

type PokemonDialogState = {
  title: string;
  message: string;
  selectedIndex: number;
  spriteRole?: Gen2Npc["role"];
  options: Array<{ label: string; detail: string }>;
};

type SpriteDialogMirrorState = {
  title: string;
  line: string;
  detail: string;
  spriteRole: Gen2Npc["role"];
};

type LiveRoomVital = Gen2RoomVital & {
  online?: boolean;
  memoryPercent?: number | null;
  deviceName?: string;
  /** Lifecycle text for the room (kept next to the real device telemetry, never replacing it). */
  lifePrimary?: string;
  lifeSecondary?: string;
  lifeDetail?: string[];
  lifePhase?: string;
};

type RoomVitals = Record<string, LiveRoomVital>;

const worldWidth = GEN2_W * GEN2_TILE;
const worldHeight = GEN2_H * GEN2_TILE;
const MOVEMENT_TICK_MS = 430;
const NPC_STORAGE_KEY = "gen2-facility-npcs-v6";
const STAFF_STORAGE_KEY = "gen2-grow-ops-staff-v1";
const DUTY_STORAGE_KEY = "gen2-grow-ops-vacant-duties-v2";
const FACILITY_DRAFT_STORAGE_KEY = "gen2-grow-ops-facility-drafts-v1";
const rd2TerminalKeys = ["rd2-61-45", "rd2-65-45", "rd2-69-45", "rd2-73-45", "rd2-77-45"];
const REQUIRED_STAFF_IDS = new Set(["boss", "screenHr", "cultManager", "opsManager", "salesRep"]);
const SECURITY_MONITOR_VIEWS = [
  { title: "CLONE ROOM", rooms: ["clone"] },
  { title: "MOTHER ROOM", rooms: ["mother"] },
  { title: "GROW ROOM 1", rooms: ["grow1"] },
  { title: "GROW ROOM 2", rooms: ["grow2"] },
  { title: "GROW ROOM 3", rooms: ["grow3"] },
  { title: "GROW ROOM 4", rooms: ["grow4"] },
  { title: "VM DRY ROOMS", rooms: ["vmCreations", "soil"] },
  { title: "POTTING", rooms: ["potting"] },
  { title: "PROCESSING", rooms: ["trim"] },
  { title: "PACKAGING", rooms: ["pack"] },
  { title: "EXTRACTION", rooms: ["extract"] },
  { title: "LOADING / WAREHOUSE", rooms: ["dock", "warehouse"] },
  { title: "SALES DEPT", rooms: ["sales"] },
  { title: "R&D LAB", rooms: ["rd1"] },
  { title: "R&D TEST", rooms: ["rd2"] },
  { title: "UNASSIGNED", rooms: [] },
] as const;

const LifeContext = createContext<{ life?: LifeState; bubbles: LifeBubble[] }>({ bubbles: [] });
const LIFE_SEEN_KEY = "gen2-lifecycle-seen-v1";
const LIFE_MOCK = lifecycleMockEnabled();

function loadLifeSeen() {
  try {
    const raw = JSON.parse(window.localStorage.getItem(LIFE_SEEN_KEY) ?? "[]");
    return new Set<string>(Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function persistLifeSeen(seen: Set<string>) {
  try {
    const list = [...seen];
    window.localStorage.setItem(LIFE_SEEN_KEY, JSON.stringify(list.slice(-400)));
    if (list.length > 600) {
      seen.clear();
      for (const item of list.slice(-400)) seen.add(item);
    }
  } catch {
    // storage unavailable: events simply are not remembered across reloads
  }
}

// ---------------------------------------------------------------------------
// Staff "little life": birthdays, promotions, memories filed from floor events (see src/life/)
// ---------------------------------------------------------------------------

const BDAY_DONE_KEY = "gen2-life-bday-done-v1";
const TITLES_KEY = "gen2-life-titles-v1";
const PARTY_CAKE = { x: 79, y: 32 };
const PROMOTION_TITLE = /manager|lead|senior|supervisor|head|chief|director|captain/i;
const JOB_MEMORY_LABEL = /^(STERILIZE|MOP|HARVEST|PLANT|POT|TRIM|PACK|EXTRACT|PROMOTE)\b/;

type PartyState = { id: string; dayKey: string; phase: "gather" | "sing"; startedAt: number; attendees: string[] };

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable: the celebration may repeat after a reload
  }
}

function dayKeyOf(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Sends the birthday guests to free tiles around the cake. Each gets a "seek" errand (no bubble, ignores the break room limit). */
function assignPartyErrands(list: LiveNpc[], ids: string[]): LiveNpc[] {
  const reach = getReach();
  const breakRoom = gen2Rooms.find((room) => room.id === "break");
  const doorX = breakRoom ? breakRoom.x + (breakRoom.doors[0]?.at ?? 0) : 0;
  const spots: Spot[] = [];
  for (const key of reach) {
    const [x, y] = key.split(",").map(Number);
    if (!isBreakRoomTile(x, y)) continue;
    const distance = Math.abs(x - PARTY_CAKE.x) + Math.abs(y - PARTY_CAKE.y);
    if (distance < 1 || distance > 6) continue;
    if (breakRoom && y <= breakRoom.y + 2 && Math.abs(x - doorX) <= 2) continue; // keep the door clear
    spots.push({ x, y, face: faceToward({ x, y }, PARTY_CAKE, "down"), roomId: "break" });
  }
  let out = list;
  for (const id of ids) {
    const index = out.findIndex((npc) => npc.id === id);
    const npc = out[index];
    if (!npc?.sim) continue;
    const spot = pickSpot(spots, npc, out, id, PARTY_CAKE);
    if (!spot) continue;
    if (out === list) out = list.slice();
    out[index] = { ...npc, pause: 0, sim: { ...npc.sim, chat: undefined, task: undefined, mode: "work", errand: { kind: "seek", x: spot.x, y: spot.y, face: spot.face, stage: "go", left: 260, timeout: 300, party: true }, via: undefined, legFor: -1 } };
  }
  return out;
}

/** Plausible pairs for an AI banter exchange: same room, same department or both in the break room, friends first. */
function buildBanterCandidates(list: LiveNpc[], ctx: NpcSimContext, staffMap: Record<string, GrowOpsStaff>, logs: Record<string, { items: string[] }>): BanterCandidate[] {
  const eligible = list.filter((npc) => npc.sim && npc.id !== "boss" && gen2OnShift(scheduleOf(npc, ctx), ctx.minute) && !isCriticalNow(npc, ctx) && !TALK_HOLD.has(npc.id));
  const brief = (npc: LiveNpc) => {
    const info = staffMap[npc.id] ?? defaultGrowOpsStaff(npc);
    const last = logs[npc.id]?.items[logs[npc.id].items.length - 1]?.replace(/^[^:]+:\d\d [AP]M: /, "");
    return { id: npc.id, name: info.name, title: info.title, department: info.department, mood: moodText(npc, info).toLowerCase(), action: npcDoingLabel(npc).toLowerCase(), recent: last ? [last] : undefined };
  };
  const out: BanterCandidate[] = [];
  for (let i = 0; i < eligible.length; i += 1) {
    for (let j = i + 1; j < eligible.length; j += 1) {
      const a = eligible[i];
      const b = eligible[j];
      const roomA = roomAt(a.x, a.y)?.id;
      const sameRoom = !!roomA && roomA === roomAt(b.x, b.y)?.id;
      const sameDept = departmentOf(a) === departmentOf(b);
      const breakBoundBoth = [a, b].every((npc) => isBreakRoomTile(npc.x, npc.y) || (npc.sim?.errand?.stage === "go" && isBreakRoomTile(npc.sim.errand.x, npc.sim.errand.y)));
      if (!sameRoom && !sameDept && !breakBoundBoth) continue;
      const close = Math.abs(a.x - b.x) + Math.abs(a.y - b.y) <= 6;
      const score = (sameRoom ? 3 : 0) + (breakBoundBoth ? 3 : 0) + (sameDept ? 1.5 : 0) + (close ? 3 : 0) + pairAffinity(a.id, b.id, sameDept) * 2 - banterQueuedFor(a.id, b.id) * 2;
      out.push({ a: brief(a), b: brief(b), place: breakBoundBoth ? "the break room" : sameRoom ? roomLabel(roomA as string).toLowerCase() : "the hallway", score });
    }
  }
  return out.sort((x, y) => y.score - x.score).slice(0, 12);
}

function releaseParty(list: LiveNpc[], ids: string[]): LiveNpc[] {
  const set = new Set(ids);
  return list.map((npc) => (set.has(npc.id) && npc.sim?.errand?.party ? { ...npc, sim: { ...npc.sim, errand: { ...npc.sim.errand, left: Math.min(npc.sim.errand.left, 10) } } } : npc));
}

export function Gen2FacilityDashboard() {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [fitZoom, setFitZoom] = useState(0.62);
  const [fitPan, setFitPan] = useState({ x: 0, y: 0 });
  const [focusedRoomId, setFocusedRoomId] = useState<string | undefined>();
  const [selection, setSelection] = useState<Selection | undefined>();
  const [contextMenu, setContextMenu] = useState<ContextMenuState | undefined>();
  const [terminalSession, setTerminalSession] = useState<TerminalSession | undefined>();
  const [dialog, setDialog] = useState<PokemonDialogState | undefined>();
  const [spriteDialogMirror, setSpriteDialogMirror] = useState<SpriteDialogMirrorState | undefined>();
  const [staffBattleId, setStaffBattleId] = useState<string | undefined>();
  const [highlightRouteId, setHighlightRouteId] = useState<string | undefined>();
  const [growOpsOpen, setGrowOpsOpen] = useState(false);
  const [growOpsInitialTab, setGrowOpsInitialTab] = useState<GrowOpsTab>("staff");
  const [growOpsFocusStaffId, setGrowOpsFocusStaffId] = useState<string | undefined>();
  const [hostStats, setHostStats] = useState<HostStats | undefined>();
  const [dockerStats, setDockerStats] = useState<DockerStats | undefined>();
  const [ollamaModels, setOllamaModels] = useState<OllamaModels | undefined>();
  const [facilityDevices, setFacilityDevices] = useState<FacilityDevices | undefined>();
  const [activitySnapshotStatus, setActivitySnapshotStatus] = useState("Activity snapshots not loaded yet.");
  const [activityHistoryCount, setActivityHistoryCount] = useState(0);
  const [isSavingActivity, setIsSavingActivity] = useState(false);
  const [activityLabOpen, setActivityLabOpen] = useState(false);
  const [intercomNotice, setIntercomNotice] = useState("INTERCOM STANDBY — route arrivals and manual lab controls will appear here.");
  const [clockText, setClockText] = useState(() => gen2FormatClock12(clockMinuteNow()));
  const [productionPhase, setProductionPhase] = useState(0);
  const [incidentPhase, setIncidentPhase] = useState(0);
  const [incidentTargetRoom, setIncidentTargetRoom] = useState<"rd1" | "rd2">("rd1");
  const [npcs, setNpcs] = useState<LiveNpc[]>(() => loadPersistedNpcs());
  const [staff, setStaff] = useState<Record<string, GrowOpsStaff>>(() => loadGrowOpsStaff());
  const [vacantDuties, setVacantDuties] = useState<VacantDuty[]>(() => loadVacantDuties());
  const walkable = useMemo(() => buildWalkable(), []);
  const focusedRoom = focusedRoomId ? gen2Rooms.find((room) => room.id === focusedRoomId) : undefined;
  const staffBattleNpc = staffBattleId ? npcs.find((npc) => npc.id === staffBattleId) : undefined;
  const [life, setLife] = useState<LifeState | undefined>();
  const [lifeBubbles, setLifeBubbles] = useState<LifeBubble[]>([]);
  const [lifecycleOpen, setLifecycleOpen] = useState(false);
  const npcsRef = useRef<LiveNpc[]>(npcs);
  const lifePrevRef = useRef<LifeState | undefined>(undefined);
  const lifeIssuedRef = useRef<Set<string>>(new Set());
  const lifeSeenRef = useRef<Set<string>>(loadLifeSeen());
  const pendingTasksRef = useRef<PendingTask[]>([]);
  npcsRef.current = npcs;
  const lifeContext = useMemo(() => ({ life, bubbles: lifeBubbles }), [life, lifeBubbles]);
  const overviewTransform = `translate(${fitPan.x}px, ${fitPan.y}px) scale(${fitZoom})`;
  const roomVitals = useMemo(() => buildLiveRoomVitals(hostStats, dockerStats, ollamaModels, facilityDevices, life?.snap), [hostStats, dockerStats, ollamaModels, facilityDevices, life]);
  const [activityState, setActivityState] = useState<ActivityState>(() => loadPersistedActivityState(npcs));
  const previousNpcRoomsRef = useRef<Record<string, string | undefined>>(roomMapForNpcs(npcs));
  const simContextRef = useRef<NpcSimContext>(EMPTY_SIM_CONTEXT);

  // Facility walk mode: the player is one more entity on the floor. The NPC sim only needs to know which tile is reserved.
  const [walk, setWalk] = useState<WalkState>({ active: false, view: "top", full: false, pad: null, spawn: { x: 0, y: 0, dir: "right" } });
  const boardRef = useRef<HTMLDivElement | null>(null);
  const walkPlayerRef = useRef<HTMLDivElement | null>(null);
  const walkSpriteRef = useRef<HTMLSpanElement | null>(null);
  const playerTileRef = useRef<{ x: number; y: number } | null>(null);
  const walkAvoidRef = useRef<{ key: string; set: Set<string> } | undefined>(undefined);
  const walkNpcCacheRef = useRef<{ src: LiveNpc[]; staff: Record<string, GrowOpsStaff>; out: WalkNpc[] } | undefined>(undefined);
  const walkHostRef = useRef<WalkHost>(undefined as unknown as WalkHost);

  // Talk to staff (Pokemon-style dialog backed by POST /api/npc/chat).
  const [talk, setTalk] = useState<{ npcId: string; x: number; y: number; interrupt?: string } | undefined>();
  const talkNpc = talk ? npcs.find((npc) => npc.id === talk.npcId) : undefined;
  const workLogRef = useRef<Record<string, { sig?: WorkerSig; items: string[] }>>({});

  // ---- staff life: calendar, weather, birthdays, promotions, memories, AI banter (see src/life/) ----
  const { info: lifeCal, now: lifeClockDate } = useLifeCalendar();
  const staffRef = useRef(staff);
  staffRef.current = staff;
  const staffIds = npcs.map((npc) => npc.id);
  const { birthdays, setBirthday } = useBirthdays(staffIds);
  useRosterSync(npcs.map((npc) => {
    const info = staff[npc.id] ?? defaultGrowOpsStaff(npc);
    return { id: npc.id, name: info.name, title: info.title, department: info.department };
  }));
  const lifeDecor = lifeCal?.decor ?? null;
  const lifeNight = isNight(lifeClockDate);
  const lifeWeather = weatherKind(lifeCal?.weather ?? null);
  const holidayChip = lifeCal ? holidayBadge(lifeCal) : undefined;
  const birthdayMock = lifeParam("birthdayMock");
  const todayKey = dayKeyOf(lifeClockDate);
  const todayBirthdayIds = staffIds.filter((id) => (birthdayMock ? id === birthdayMock : birthdays[id]?.m === lifeClockDate.getMonth() + 1 && birthdays[id]?.d === lifeClockDate.getDate()));
  const todayBirthdayKey = todayBirthdayIds.join("|");
  const todayBirthdayRef = useRef<string[]>([]);
  todayBirthdayRef.current = todayBirthdayIds;
  const partyRef = useRef<PartyState | null>(null);
  const memoryTrackRef = useRef<Record<string, { task?: { key: string; label: string; idx: number; total: number }; crit?: boolean }>>({});
  const birthdayStations = useMemo(() => todayBirthdayIds.map((id) => {
    const home = staff[id]?.stationRoomId ?? gen2WorkerProfiles[id]?.stationRoomId;
    const spot = home ? favoriteSpots(id, home)[0] : undefined;
    const live = npcsRef.current.find((npc) => npc.id === id);
    return { id, x: spot?.x ?? live?.x ?? PARTY_CAKE.x, y: spot?.y ?? live?.y ?? PARTY_CAKE.y };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [todayBirthdayKey, staff]);
  const upcomingBirthdays = useMemo(() => {
    const today = new Date(lifeClockDate.getFullYear(), lifeClockDate.getMonth(), lifeClockDate.getDate());
    return staffIds.flatMap((id) => {
      const entry = birthdayMock === id ? { m: lifeClockDate.getMonth() + 1, d: lifeClockDate.getDate() } : birthdays[id];
      if (!entry) return [];
      let next = new Date(today.getFullYear(), entry.m - 1, entry.d);
      if (next < today) next = new Date(today.getFullYear() + 1, entry.m - 1, entry.d);
      const days = Math.round((next.getTime() - today.getTime()) / 86_400_000);
      return days <= 7 ? [{ name: staff[id]?.name ?? humanizeNpcId(id), days, label: next.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase() }] : [];
    }).sort((a, b) => a.days - b.days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [birthdays, staff, todayKey, staffIds.join("|")]);
  const memoryReal = (id: string) => !LIFE_MOCK && !!staffRef.current[id];

  // weather / holiday small talk for the canned sprite chat
  useEffect(() => {
    LIFE_TALK.lines = smallTalkLines(lifeCal);
  }, [lifeCal]);

  // Prefetch AI banter for one plausible pair every ~60-90 s (sooner when the break room fills up); never blocks the sim.
  useEffect(() => {
    const timer = window.setInterval(() => {
      const list = npcsRef.current;
      const ctx = withClock(simContextRef.current, Date.now());
      const breakers = list.filter((npc) => isBreakRoomTile(npc.x, npc.y) || (npc.sim?.errand && npc.sim.errand.stage === "go" && isBreakRoomTile(npc.sim.errand.x, npc.sim.errand.y)));
      pumpBanter(() => buildBanterCandidates(list, ctx, staffRef.current, workLogRef.current), breakers.length >= 2);
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  // Notable floor events become memories: a finished lifecycle job, responding to the alarm. Deduped by event key.
  useEffect(() => {
    const ctx = withClock(simContextRef.current, Date.now());
    for (const npc of npcs) {
      const record = (memoryTrackRef.current[npc.id] ??= {});
      const task = npc.sim?.task;
      if (task) record.task = { key: task.key, label: task.label, idx: task.idx, total: task.stops.length };
      else if (record.task) {
        const finished = record.task;
        record.task = undefined;
        if (finished.idx >= finished.total - 1 && JOB_MEMORY_LABEL.test(finished.label)) fileMemory(npc.id, `job:${finished.key}`, "job", `I finished a job on the floor: ${finished.label.toLowerCase()}.`, 2, memoryReal(npc.id));
      }
      const critical = isCriticalNow(npc, ctx);
      if (critical && !record.crit) {
        if (npc.id === "researcher" || npc.id === "rdSafety") fileMemory(npc.id, `fire:${ctx.day}`, "fire", "I responded when the fire alarm went off in the R&D labs.", 3, memoryReal(npc.id));
        else fileMemory(npc.id, `alert:${ctx.day}`, "security", "I handled a security alert on the floor and everything turned out fine.", 2, memoryReal(npc.id));
      }
      record.crit = critical;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [npcs]);

  // Promotion / new-role moment: compare each worker's title with the one remembered in localStorage.
  const titleSignature = npcs.map((npc) => `${npc.id}=${(staff[npc.id] ?? defaultGrowOpsStaff(npc)).title}`).join("|");
  useEffect(() => {
    const stored = readJson<Record<string, string>>(TITLES_KEY, {});
    const next = { ...stored };
    const changes: Array<{ id: string; from: string; to: string }> = [];
    for (const npc of npcsRef.current) {
      const title = (staffRef.current[npc.id] ?? defaultGrowOpsStaff(npc)).title;
      if (stored[npc.id] === undefined) next[npc.id] = title;
      else if (stored[npc.id] !== title) {
        changes.push({ id: npc.id, from: stored[npc.id], to: title });
        next[npc.id] = title;
      }
    }
    writeJson(TITLES_KEY, next);
    if (!changes.length) return;
    // (not cancelled on cleanup: the titles were already stored above, so a React dev double-mount must not swallow the moment)
    window.setTimeout(() => changes.forEach((change) => celebratePromotion(change.id, change.from, change.to)), 900);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleSignature]);

  function celebratePromotion(id: string, from: string, to: string) {
    const list = npcsRef.current;
    const hero = list.find((npc) => npc.id === id);
    if (!hero) return;
    const promoted = PROMOTION_TITLE.test(to) && !PROMOTION_TITLE.test(from);
    const name = staffRef.current[id]?.name ?? humanizeNpcId(id);
    const now = Date.now();
    setMoment(id, `${promoted ? "PROMOTED" : "NEW ROLE"}: ${to.toUpperCase().slice(0, 26)}`, 7500, { mark: true, tone: "promo" });
    CELEBRATE_HOLD.set(id, { face: "down", until: now + 8000 });
    const ctx = withClock(simContextRef.current, now);
    const neighbors = list
      .filter((other) => other.id !== id && other.sim && gen2OnShift(scheduleOf(other, ctx), ctx.minute) && !isCriticalNow(other, ctx) && !TALK_HOLD.has(other.id))
      .map((other) => ({ other, dist: Math.abs(other.x - hero.x) + Math.abs(other.y - hero.y) }))
      .filter((item) => item.dist <= 14)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 2);
    neighbors.forEach(({ other }, index) => {
      window.setTimeout(() => {
        setMoment(other.id, "CONGRATS!", 3800, { tone: "cheer" });
        CELEBRATE_HOLD.set(other.id, { face: faceToward(other, hero, other.dir), until: Date.now() + 5200 });
      }, 1300 + index * 900);
    });
    setIntercomNotice(`${promoted ? "PROMOTION" : "NEW ROLE"}: ${name.toUpperCase()} IS NOW ${to.toUpperCase()}.`);
  }

  // Birthday gathering: mid-shift on the birthday, the worker's coworkers join them in the break room (once per day, persisted).
  useEffect(() => {
    if (LIFE_DRY) (window as unknown as Record<string, unknown>).__lifeCelebrate = (id: string, from: string, to: string) => celebratePromotion(id, from, to);
    if (LIFE_DRY) (window as unknown as Record<string, unknown>).__lifeSetNpcs = setNpcs; // dev aid for scripted-chat tests
    if (LIFE_DRY) (window as unknown as Record<string, unknown>).__lifeParty = () => ({ party: partyRef.current, today: todayBirthdayRef.current, checks: todayBirthdayRef.current.map((id) => { const npc = npcsRef.current.find((item) => item.id === id); const ctx = withClock(simContextRef.current, Date.now()); return npc ? { task: npc.sim?.task?.label, critical: isCriticalNow(npc, ctx), onShift: gen2OnShift(scheduleOf(npc, ctx), ctx.minute), minute: ctx.minute } : "missing"; }), npcs: npcsRef.current.filter((npc) => partyRef.current?.attendees.includes(npc.id)).map((npc) => `${npc.id}@${npc.x},${npc.y} ${npc.sim?.errand ? `${npc.sim.errand.kind}/${npc.sim.errand.stage}/${npc.sim.errand.party ? "P" : "-"}->${npc.sim.errand.x},${npc.sim.errand.y} left${npc.sim.errand.left} to${npc.sim.errand.timeout}` : "no-errand"}`) });
    const timer = window.setInterval(() => {
      const now = Date.now();
      const date = lifeNow();
      const dayKey = dayKeyOf(date);
      const list = npcsRef.current;
      const ctx = withClock(simContextRef.current, now);
      const party = partyRef.current;
      const mock = !!lifeParam("birthdayMock");
      if (!party) {
        const done = readJson<Record<string, string[]>>(BDAY_DONE_KEY, {});
        for (const id of todayBirthdayRef.current) {
          if ((done[dayKey] ?? []).includes(id)) continue;
          const npc = list.find((item) => item.id === id);
          if (!npc?.sim || npc.sim.task || isCriticalNow(npc, ctx)) continue;
          const schedule = scheduleOf(npc, ctx);
          if (!gen2OnShift(schedule, ctx.minute)) continue;
          if (!mock) {
            const allDay = schedule.shiftStart === schedule.shiftEnd || (schedule.shiftStart === 0 && schedule.shiftEnd >= 1440);
            const middle = allDay ? 14 * 60 : (schedule.shiftStart + schedule.shiftEnd) / 2;
            if (ctx.minute < middle || ctx.minute > middle + 150) continue;
          }
          const sameDept = (other: LiveNpc) => departmentOf(other) === departmentOf(npc);
          const guests = list
            .filter((other) => other.id !== id && other.sim && other.id !== "boss" && !other.sim.task && !TALK_HOLD.has(other.id) && gen2OnShift(scheduleOf(other, ctx), ctx.minute) && !isCriticalNow(other, ctx))
            .map((other) => ({ id: other.id, score: (sameDept(other) ? 2 : 0) + pairAffinity(id, other.id, sameDept(other)) * 2 + Math.random() }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map((item) => item.id);
          const attendees = [id, ...guests];
          writeJson(BDAY_DONE_KEY, { [dayKey]: [...(done[dayKey] ?? []), id] });
          partyRef.current = { id, dayKey, phase: "gather", startedAt: now, attendees };
          setNpcs((current) => assignPartyErrands(current, attendees));
          setIntercomNotice(`BREAK ROOM: SURPRISE BIRTHDAY GATHERING FOR ${(staffRef.current[id]?.name ?? humanizeNpcId(id)).toUpperCase()}!`);
          break;
        }
        return;
      }
      const arrived = party.attendees.filter((id) => {
        const npc = list.find((item) => item.id === id);
        const errand = npc?.sim?.errand;
        return !!npc && !!errand?.party && errand.stage === "use" && npc.x === errand.x && npc.y === errand.y;
      });
      if (party.phase === "gather") {
        if (arrived.length >= Math.max(2, Math.ceil(party.attendees.length * 0.7)) || now - party.startedAt > 60_000) {
          party.phase = "sing";
          party.startedAt = now;
          const hero = staffRef.current[party.id]?.name ?? humanizeNpcId(party.id);
          const enabled = memoryReal(party.id);
          arrived.forEach((id, index) => {
            if (id === party.id) return;
            window.setTimeout(() => setMoment(id, `HAPPY BIRTHDAY ${hero.toUpperCase().slice(0, 12)}!`, 3600, { tone: "party" }), index * 900);
            fileMemory(id, `bdayparty:${party.dayKey}:${party.id}`, "birthday", `I was at ${hero}'s birthday gathering in the break room.`, 2, memoryReal(id));
          });
          window.setTimeout(() => setMoment(party.id, "THANKS, EVERYONE!", 4500, { tone: "party" }), Math.max(3400, arrived.length * 900 + 600));
          fileMemory(party.id, `bday:${party.dayKey}`, "birthday", "My coworkers gathered in the break room with a cake for my birthday.", 3, enabled);
        }
      } else if (now - party.startedAt > 11_000) {
        const attendees = party.attendees;
        partyRef.current = null;
        setNpcs((current) => releaseParty(current, attendees));
      }
    }, 2000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Per-worker rolling "what did you do lately" log, derived from changes in the sim state (rooms, breaks, chats, lifecycle jobs, trips, incidents).
  useEffect(() => {
    const stamp = gen2FormatClock12(clockMinuteNow());
    const logs = workLogRef.current;
    for (const npc of npcs) {
      if (!npc.sim) continue;
      const entry = (logs[npc.id] ??= { items: [] });
      const sig = workerSig(npc, isCriticalNow(npc, simContextRef.current));
      const events = diffWorkerSig(entry.sig, sig);
      entry.sig = sig;
      for (const text of events) {
        if (text.startsWith("walked into") && entry.items[entry.items.length - 1]?.includes(": walked into")) entry.items.pop();
        entry.items.push(`${stamp}: ${text}`);
        if (entry.items.length > 6) entry.items.shift();
      }
    }
    if (talk) {
      if (!talkNpc) closeTalk();
      else if ((talkNpc.x !== talk.x || talkNpc.y !== talk.y) && !talk.interrupt) setTalk({ ...talk, interrupt: "Sorry, I have to run! Duty calls." });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [npcs]);

  useLayoutEffect(() => {
    function fitBoard() {
      const viewport = viewportRef.current?.getBoundingClientRect();
      if (!viewport) return;
      const nextZoom = Math.min(viewport.width / worldWidth, viewport.height / worldHeight) * 0.97;
      const clamped = Math.max(0.42, Math.min(0.88, nextZoom));
      setFitZoom(clamped);
      setFitPan({
        x: (viewport.width - worldWidth * clamped) / 2,
        y: (viewport.height - worldHeight * clamped) / 2,
      });
    }
    fitBoard();
    window.addEventListener("resize", fitBoard);
    return () => window.removeEventListener("resize", fitBoard);
  }, []);

  simContextRef.current = useMemo(() => buildSimContext(roomVitals, incidentPhase, staff, life?.snap), [roomVitals, incidentPhase, staff, life]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now();
      const ctx = withClock(simContextRef.current, now);
      const dispatched = dispatchLifeTasks(npcsRef.current, pendingTasksRef.current, ctx, now);
      pendingTasksRef.current = dispatched.remaining;
      for (const key of dispatched.dropped) lifeIssuedRef.current.delete(key);
      if (LIFE_MOCK) {
        // dev aid for ?lifecycleMock=1: window.__lifeTasks() lists running and queued jobs
        (window as unknown as Record<string, unknown>).__lifeTasks = () => ({
          running: npcsRef.current.filter((npc) => npc.sim?.task).map((npc) => `${npc.id}@${npc.x},${npc.y}: ${npc.sim?.task?.label} stop ${npc.sim?.task?.idx} ${npc.sim?.task?.stage} carry=${npc.sim?.task?.carrying ?? "-"}`),
          queued: pendingTasksRef.current.map((task) => `${task.label} <- ${task.candidates.join("/")}`),
        });
      }
      // The tile under the walking player (when walk mode is on) is treated as a wall so NPCs re-path around it.
      setNpcs((current) => advanceAllNpcs(applyTaskAssignments(current, dispatched.assignments), walkableAvoiding(walkable, playerTileRef.current, walkAvoidRef), simContextRef.current, now));
    }, MOVEMENT_TICK_MS);
    return () => window.clearInterval(interval);
  }, [walkable]);

  // Crop lifecycle feed (GET /api/lifecycle every 5 s, or the ?lifecycleMock=1 synthetic feed). Fails soft: while the
  // endpoint is unreachable the facility keeps its demo behaviour.
  useEffect(() => {
    let alive = true;
    let failures = 0;
    const mock = lifecycleMockEnabled();
    async function pollLifecycle() {
      try {
        const snap: unknown = mock ? mockLifecycleSnapshot(Date.now()) : await getLifecycle();
        if (!alive) return;
        if (!isLifecycleSnapshot(snap)) throw new Error("unexpected lifecycle payload");
        failures = 0;
        const now = Date.now();
        setLife((current) => reduceLifeState(current, snap as LifecycleSnapshot, now, mock));
      } catch {
        failures += 1;
        if (alive && failures >= 6) setLife(undefined);
      }
    }
    pollLifecycle();
    const interval = window.setInterval(pollLifecycle, mock ? 1000 : 5000);
    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, []);

  // Turn snapshot changes into worker tasks and speech bubbles (see deriveLifeEvents).
  useEffect(() => {
    if (!life) {
      lifePrevRef.current = undefined;
      return;
    }
    const previous = lifePrevRef.current;
    if (previous === life) return;
    lifePrevRef.current = life;
    const now = Date.now();
    const events = deriveLifeEvents(previous, life, lifeIssuedRef.current, lifeSeenRef.current, now);
    if (events.tasks.length) pendingTasksRef.current = [...pendingTasksRef.current, ...events.tasks];
    if (events.bubbles.length) setLifeBubbles((current) => [...current.filter((bubble) => bubble.until > now), ...events.bubbles]);
    if (events.notices.length) setIntercomNotice(`LIFECYCLE: ${events.notices[events.notices.length - 1]}`);
    if (events.seenAdd.length) persistLifeSeen(lifeSeenRef.current);
  }, [life]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now();
      setLifeBubbles((current) => (current.some((bubble) => bubble.until <= now) ? current.filter((bubble) => bubble.until > now) : current));
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setClockText(gen2FormatClock12(clockMinuteNow())), 15000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setProductionPhase((current) => (current + 1) % 6), 3200);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setIncidentPhase((current) => (current + 1) % 16), 4000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (incidentPhase === 13) setIncidentTargetRoom((current) => current === "rd1" ? "rd2" : "rd1");
  }, [incidentPhase]);

  useEffect(() => {
    persistNpcs(npcs);
  }, [npcs]);

  useEffect(() => {
    persistGrowOpsStaff(staff);
  }, [staff]);

  useEffect(() => {
    persistVacantDuties(vacantDuties);
  }, [vacantDuties]);

  useEffect(() => {
    const previousRooms = previousNpcRoomsRef.current;
    const nextRooms = roomMapForNpcs(npcs);
    const arrivals = npcs
      .map((npc) => ({ npc, fromRoomId: previousRooms[npc.id], toRoomId: nextRooms[npc.id] }))
      .filter((arrival) => arrival.toRoomId && arrival.toRoomId !== arrival.fromRoomId);
    previousNpcRoomsRef.current = nextRooms;
    for (const arrival of arrivals) {
      if (arrival.toRoomId !== "rd1" && arrival.toRoomId !== "rd2") continue;
      const day = withClock(simContextRef.current, Date.now()).day;
      if (arrival.toRoomId === "rd1") fileMemory(arrival.npc.id, `rd1:${day}`, "research", "I carried an extract sample into the R&D lab for testing.", 1, memoryReal(arrival.npc.id));
      else fileMemory(arrival.npc.id, `rd2:${day}`, "research", "I took a batch through the R&D test room today.", 1, memoryReal(arrival.npc.id));
    }
    if (arrivals.length) {
      setActivityState((current) => {
        const next = advanceActivityState(current, arrivals, productionPhase, incidentPhase);
        if (next.feed[0]?.id !== current.feed[0]?.id) setIntercomNotice(`INTERCOM: ${next.feed[0].message}`);
        return next;
      });
    }
  }, [npcs, productionPhase, incidentPhase]);

  useEffect(() => {
    setActivityState((current) => current.phaseLabel === activityPhaseLabel(productionPhase) ? current : { ...current, phaseLabel: activityPhaseLabel(productionPhase) });
  }, [productionPhase]);

  useEffect(() => {
    persistActivityState(activityState);
  }, [activityState]);

  useEffect(() => {
    let alive = true;
    async function pollSystemStats() {
      try {
        const [host, docker, models, devices] = await Promise.allSettled([getHostStats(), getDockerStats(), getOllamaModels(), getFacilityDevices()]);
        if (!alive) return;
        setHostStats(host.status === "fulfilled" ? host.value : undefined);
        setDockerStats(docker.status === "fulfilled" ? docker.value : undefined);
        setOllamaModels(models.status === "fulfilled" ? models.value : undefined);
        setFacilityDevices(devices.status === "fulfilled" ? devices.value : undefined);
      } catch {
        if (alive) {
          setHostStats(undefined);
          setDockerStats(undefined);
          setOllamaModels(undefined);
          setFacilityDevices(undefined);
        }
      }
    }
    pollSystemStats();
    const interval = window.setInterval(pollSystemStats, 5000);
    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let active = true;
    getActivityStateSnapshot()
      .then((state) => {
        if (!active) return;
        setActivityHistoryCount(state.history.length);
        setActivitySnapshotStatus(state.current ? `Activity checkpoint ${state.current.id} loaded (${state.history.length} undo point${state.history.length === 1 ? "" : "s"}).` : "No activity checkpoint yet. Save one when the floor loop looks good.");
      })
      .catch((error) => {
        if (active) setActivitySnapshotStatus(`Activity snapshot load failed: ${error instanceof Error ? error.message : String(error)}`);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(tagName ?? "")) return;
      if (dialog) {
        if (event.key === "Escape") {
          setDialog(undefined);
          return;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowRight") {
          event.preventDefault();
          setDialog((current) => current ? { ...current, selectedIndex: (current.selectedIndex + 1) % current.options.length } : current);
          return;
        }
        if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
          event.preventDefault();
          setDialog((current) => current ? { ...current, selectedIndex: (current.selectedIndex - 1 + current.options.length) % current.options.length } : current);
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          chooseDialogOption(dialog.selectedIndex);
          return;
        }
      }
      const hotKey = gen2BossHotKeys.find((item) => item.key === event.key);
      if (hotKey) {
        event.preventDefault();
        openHotKeyDialog(hotKey);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dialog]);

  async function saveActivityCheckpoint() {
    setIsSavingActivity(true);
    setActivitySnapshotStatus("Saving activity engine checkpoint...");
    try {
      const state = await applyActivityStateSnapshot({ state: activityState as unknown as Record<string, unknown>, note: `Activity engine tick ${activityState.tick}: ${activityState.phaseLabel}` });
      setActivityHistoryCount(state.history.length);
      setActivitySnapshotStatus(`Saved ${state.current?.id ?? "activity checkpoint"}. Undo points: ${state.history.length}.`);
    } catch (error) {
      setActivitySnapshotStatus(`Activity save failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsSavingActivity(false);
    }
  }

  function runActivityControl(control: ActivityControl) {
    const result = applyManualActivityControl(activityState, control);
    setActivityState(result.state);
    setIntercomNotice(result.event.message);
    setActivitySnapshotStatus(`Manual Activity Lab control queued: ${result.event.message}`);
  }

  function runActivityScenario(scenario: ActivityScenario) {
    const result = applyActivityScenario(activityState, scenario);
    setActivityState(result.state);
    setIntercomNotice(result.event.message);
    setActivitySnapshotStatus(`Activity Lab scenario loaded: ${result.event.message}`);
  }

  async function undoActivityCheckpoint() {
    setIsSavingActivity(true);
    setActivitySnapshotStatus("Restoring previous activity checkpoint...");
    try {
      const state = await undoActivityStateSnapshot();
      setActivityHistoryCount(state.history.length);
      if (state.current?.state) setActivityState(coerceActivityState(state.current.state, activityState));
      setActivitySnapshotStatus(`Restored ${state.current?.id ?? "activity checkpoint"}. Undo points left: ${state.history.length}.`);
    } catch (error) {
      setActivitySnapshotStatus(`Activity undo failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsSavingActivity(false);
    }
  }

  function enterFacility() {
    if (walk.active) return;
    setFocusedRoomId(undefined);
    setContextMenu(undefined);
    let spawn = pickWalkSpawn(npcsRef.current, walkable);
    // dev aid: ?walkAt=x,y,dir starts the walk at a given tile (e.g. ?walkAt=57,20,down)
    const walkAt = new URLSearchParams(window.location.search).get("walkAt")?.split(",");
    if (walkAt && walkAt.length >= 2 && walkable.has(tileKey(Number(walkAt[0]), Number(walkAt[1])))) {
      const dir = (["up", "down", "left", "right"] as const).find((item) => item === walkAt[2]) ?? "down";
      spawn = { x: Number(walkAt[0]), y: Number(walkAt[1]), dir };
    }
    const touch = typeof window !== "undefined" && (window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 900);
    setWalk({ active: true, view: "top", full: touch, pad: null, spawn });
    setIntercomNotice("VISITOR BADGE ISSUED: ENTERED THE FACILITY AT THE SCREENING ROOM.");
    setSelection(actionSelection("FACILITY WALK", ["ARROWS / WASD OR THE PAD TO MOVE", "A: INTERACT   B: BACK / EXIT", "V: SWITCH TOP-DOWN / FIRST PERSON"]));
  }

  function exitFacility() {
    setWalk((current) => (current.active ? { ...current, active: false } : current));
  }

  function walkBack() {
    if (talk) {
      // the on-screen B button: hand it to the dialog like the Escape key
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      return true;
    }
    if (contextMenu) { setContextMenu(undefined); return true; }
    if (terminalSession) { setTerminalSession(undefined); return true; }
    if (dialog) { setDialog(undefined); return true; }
    if (growOpsOpen) { setGrowOpsOpen(false); return true; }
    if (activityLabOpen) { setActivityLabOpen(false); return true; }
    if (lifecycleOpen) { setLifecycleOpen(false); return true; }
    if (selection || staffBattleId) {
      setSelection(undefined);
      setStaffBattleId(undefined);
      setHighlightRouteId(undefined);
      return true;
    }
    return false;
  }

  function walkPropAt(x: number, y: number) {
    const covering = gen2Props.filter((prop) => !WALK_IGNORED_PROPS.has(prop.kind) && propCoversTile(prop, x, y));
    covering.sort((a, b) => Number(gen2PropBlocksMovement(b)) - Number(gen2PropBlocksMovement(a)) || (a.w ?? 1) * (a.h ?? 1) - (b.w ?? 1) * (b.h ?? 1));
    return covering[0];
  }

  function walkInteract(x: number, y: number): string | undefined {
    const npc = npcsRef.current.find((item) => item.x === x && item.y === y);
    if (npc) {
      openTalk(npc);
      return undefined;
    }
    const prop = walkPropAt(x, y);
    if (!prop) return "NOTHING THERE.";
    setContextMenu(undefined);
    if (prop.kind === "terminal" && prop.room === "rd2") {
      openTerminal(prop);
      return undefined;
    }
    setSelection(walkSelectionFor(prop));
    return undefined;
  }

  /** The same card content for A, the caption strip and the first-person text faces. */
  function walkSelectionFor(prop: Gen2Prop): Selection {
    const lifeProp = lifePropState(prop, life, Date.now());
    if (lifeProp?.selection) return lifeSelectionToSelection(lifeProp.selection);
    if (prop.kind === "wallSign") return actionSelection("WALL SIGN", [(prop.label ?? "SIGN").toUpperCase(), `ROOM: ${roomLabel(prop.room ?? "")}`, ...walkVitalLines(prop.room)]);
    if (prop.kind === "clock") return actionSelection("WALL CLOCK", [`TIME: ${gen2FormatClock12(clockMinuteNow())}`]);
    if (prop.kind === "whiteboard") return actionSelection(`${roomLabel(prop.room ?? "")} WHITEBOARD`, walkWhiteboardLines(prop.room));
    if (prop.kind === "bulletin") return actionSelection("BULLETIN BOARD", walkNoticeLines(prop.room));
    return propSelection(prop, roomVitals);
  }

  function walkVitalLines(roomId?: string) {
    const vital = roomId ? roomVitals[roomId] : undefined;
    if (!vital) return [];
    return [vital.lifePrimary, vital.lifeSecondary, vital.primary, vital.secondary].filter((line): line is string => !!line);
  }

  function walkWhiteboardLines(roomId?: string) {
    const op = roomId ? gen2RoomOperations[roomId] : undefined;
    if (!op) return ["NOTES", "NOTHING WRITTEN HERE"];
    return [...walkVitalLines(roomId).slice(0, 2), `JOB: ${op.title}`, `OWNER: ${op.owner}`, ...op.watches.slice(0, 3).map((item) => `- ${item}`), `ALERT: ${op.alertRules[0] ?? "NONE"}`];
  }

  function walkNoticeLines(roomId?: string) {
    const op = roomId ? gen2RoomOperations[roomId] : undefined;
    if (!op) return ["NOTICES", "NO NEW NOTICES"];
    return ["NOTICES", op.title, `OWNER ${op.owner}`, `REPORTS TO ${op.reportTo}`];
  }

  function walkCaption(x: number, y: number) {
    const npc = npcsRef.current.find((item) => item.x === x && item.y === y);
    if (npc) {
      const profile = staff[npc.id] ?? defaultGrowOpsStaff(npc);
      return `${profile.name.toUpperCase()}, ${profile.title}. DOING: ${npcDoingLabel(npc)}. MOOD: ${moodText(npc, profile)}. NEED: ${npcNeedHint(npc)}.`;
    }
    const prop = walkPropAt(x, y);
    if (!prop) return "";
    if (prop.kind === "terminal" && prop.room === "rd2") {
      const model = modelTerminalFor(prop, ollamaModels);
      return `${model?.title ?? "MODEL TERMINAL"}: MODEL ${model?.model ?? "UNKNOWN"}. ${model?.detail ?? ""}`.trim();
    }
    const card = walkSelectionFor(prop);
    return `${card.title}: ${card.lines.slice(0, 6).join(" / ")}`;
  }

  function walkDescribe(x: number, y: number) {
    const npc = npcsRef.current.find((item) => item.x === x && item.y === y);
    if (npc) return `TALK TO ${(staff[npc.id]?.name ?? humanizeNpcId(npc.id)).toUpperCase()}`;
    const prop = walkPropAt(x, y);
    if (!prop) return "";
    if (prop.kind === "terminal" && prop.room === "rd2") return "USE MODEL TERMINAL";
    if (isPlant(prop)) return "CHECK PLANT";
    return `CHECK ${prop.kind.replace(/([A-Z])/g, " $1").toUpperCase()}`;
  }

  walkHostRef.current = {
    walkable,
    getNpcs: () => {
      const cache = walkNpcCacheRef.current;
      if (cache && cache.src === npcs && cache.staff === staff) return cache.out;
      const out = npcs.map((npc): WalkNpc => ({
        id: npc.id,
        x: npc.x,
        y: npc.y,
        dir: npc.dir,
        stepFrame: npc.stepFrame,
        role: npc.role,
        hatColor: staff[npc.id]?.hatColor ?? roleColor(npc.role),
        shoeColor: staff[npc.id]?.shoeColor ?? (npc.role === "boss" ? "#8a5a2b" : roleColor(npc.role)),
      }));
      walkNpcCacheRef.current = { src: npcs, staff, out };
      return out;
    },
    plantLook: (prop) => walkPlantLook(prop, life, roomVitals),
    caption: walkCaption,
    clock: () => {
      const date = new Date();
      return { hours: date.getHours(), minutes: date.getMinutes(), text: gen2FormatClock12(date.getHours() * 60 + date.getMinutes()) };
    },
    readout: (prop) => {
      if (prop.kind === "monitor") {
        const view = monitorViewFor(prop, roomVitals);
        return [view.title, ...view.lines];
      }
      if (prop.kind === "whiteboard") return [`${roomLabel(prop.room ?? "")} BOARD`, ...walkWhiteboardLines(prop.room)];
      if (prop.kind === "terminal") {
        const model = prop.room === "rd2" ? modelTerminalFor(prop, ollamaModels) : undefined;
        if (model) return [model.title, `MODEL ${model.model}`, model.detail];
      }
      const card = walkSelectionFor(prop);
      return [card.title, ...card.lines];
    },
    signLines: (roomId) => [(gen2Rooms.find((room) => room.id === roomId)?.label ?? roomId).toUpperCase(), ...walkVitalLines(roomId).slice(0, 2)],
    noticeLines: (roomId) => walkNoticeLines(roomId),
    interact: walkInteract,
    describe: walkDescribe,
    back: walkBack,
    inputBlocked: () => !!terminalSession || !!dialog || growOpsOpen || !!talk,
  };

  function openRoom(room: Gen2Room) {
    if (walk.active) {
      setSelection(roomSelection(room, roomVitals));
      setContextMenu(undefined);
      return;
    }
    setFocusedRoomId(room.id);
    setSelection(roomSelection(room, roomVitals));
    setContextMenu(undefined);
  }

  function closeRoom() {
    setFocusedRoomId(undefined);
    setSelection(undefined);
    setContextMenu(undefined);
  }

  function openContextMenu(event: React.MouseEvent, menu: Omit<ContextMenuState, "x" | "y">) {
    event.preventDefault();
    event.stopPropagation();
    const rect = viewportRef.current?.getBoundingClientRect();
    const localX = rect ? event.clientX - rect.left : event.clientX;
    const localY = rect ? event.clientY - rect.top : event.clientY;
    const menuWidth = 190;
    const menuHeight = Math.max(132, menu.items.length * 32 + 34);
    const maxX = rect ? rect.width - menuWidth - 8 : 1120;
    const maxY = rect ? rect.height - menuHeight - 8 : 500;
    const nextX = localX + menuWidth > (rect?.width ?? 1120) ? localX - menuWidth - 6 : localX + 4;
    const nextY = localY + menuHeight > (rect?.height ?? 620) ? localY - menuHeight - 6 : localY + 4;
    setContextMenu({ ...menu, x: Math.max(8, Math.min(nextX, maxX)), y: Math.max(8, Math.min(nextY, maxY)) });
  }

  function openTerminal(prop: Gen2Prop) {
    const configured = modelTerminalFor(prop, ollamaModels);
    const modelIndex = Math.max(1, ((prop.x + prop.y) % 4) + 1);
    setTerminalSession({
      title: configured?.title ?? `R&D TEST TERMINAL ${modelIndex}`,
      model: configured?.model ?? `ollama-model-${modelIndex}`,
      lines: [
        `BOOT ${configured?.model ?? modelIndex}: READY`,
        configured?.detail ?? "MODEL LIST UNAVAILABLE",
        "DOUBLE-CLICK TERMINAL LINKED",
        "MODEL CHAT SHELL ACTIVE",
      ],
    });
  }

  function openGrowOps(tab: GrowOpsTab = "staff", staffId?: string) {
    setGrowOpsInitialTab(tab);
    setGrowOpsFocusStaffId(staffId);
    setGrowOpsOpen(true);
    if (staffId) setStaffBattleId(staffId);
    setContextMenu(undefined);
  }

  function openHotKeyDialog(hotKey: Gen2HotKey) {
    setContextMenu(undefined);
    setDialog({
      title: `BOSS HOT KEY ${hotKey.key}`,
      message: hotKey.message,
      selectedIndex: 0,
      spriteRole: "boss",
      options: [
        { label: hotKey.label, detail: hotKey.expectedResponse },
        { label: "Log WO", detail: `Append owner instruction to ${gen2ReportLogPath}.` },
        { label: "Cancel", detail: "No instruction sent." },
      ],
    });
  }

  function chooseDialogOption(index: number) {
    setDialog((current) => {
      if (!current) return current;
      const option = current.options[index] ?? current.options[0];
      setSpriteDialogMirror({ title: current.title, line: current.message, detail: option.detail, spriteRole: current.spriteRole ?? "secretary" });
      setSelection(actionSelection(current.title, [current.message, `SELECTED: ${option.label}`, option.detail]));
      return undefined;
    });
  }

  function openTalk(npc: LiveNpc) {
    const player = walk.active ? playerTileRef.current : null;
    const face = player ? faceToward(npc, player, "down") : "down";
    TALK_HOLD.clear();
    TALK_HOLD.set(npc.id, face);
    setNpcs((current) => current.map((item) => (item.id === npc.id ? { ...item, dir: face, stepFrame: 0 } : item)));
    setContextMenu(undefined);
    if (walk.active) setSelection(undefined);
    setTalk({ npcId: npc.id, x: npc.x, y: npc.y });
  }

  function closeTalk() {
    TALK_HOLD.clear();
    setTalk(undefined);
  }

  /** The brief POSTed to /api/npc/chat: the worker's live profile and state, the roster, who is nearby, and their recent / upcoming lists. */
  function buildTalkBrief(npcId: string): TalkBrief {
    const live = (npcsRef.current.find((item) => item.id === npcId) ?? npcs.find((item) => item.id === npcId)) as LiveNpc;
    const profile = staff[live.id] ?? defaultGrowOpsStaff(live);
    const block = scheduleBlockFor(live, profile);
    const schedule = profile.schedule ?? gen2DefaultSchedule(live.id, profile.department);
    const roomName = roomAt(live.x, live.y)?.label ?? "the hallway";
    const recent = (workLogRef.current[live.id]?.items ?? []).slice(-6);
    const upcoming: string[] = [];
    const task = live.sim?.task;
    if (task) {
      const left = task.stops.length - task.idx - 1;
      upcoming.push(`finish the lifecycle job "${task.label}"${left > 0 ? ` (${left} more stop${left === 1 ? "" : "s"})` : ""}`);
    }
    for (const queued of pendingTasksRef.current) if (queued.candidates.includes(live.id)) upcoming.push(`take on the lifecycle job "${queued.label}" once free`);
    const errand = live.sim?.errand;
    if (errand && errand.stage === "go" && errand.kind !== "work") upcoming.push(`${ERRAND_LABELS[errand.kind][0].toLowerCase()} right now`);
    if (live.route.length > 1) {
      const start = live.sim?.mode === "trip" ? (live.sim.tripIdx ?? 0) : live.routeIndex;
      const stops = Array.from({ length: Math.min(3, live.route.length) }, (_, i) => live.route[(start + i) % live.route.length]).map((stop) => roomAt(stop.x, stop.y)?.label ?? "the hallway");
      const unique = stops.filter((label, i) => stops.indexOf(label) === i);
      upcoming.push(`${live.sim?.mode === "trip" ? "heading on a handoff round via" : "next handoff round passes"} ${unique.join(", then ")}`);
    }
    if (live.id !== "boss") upcoming.push(`next scheduled break: ${block.nextBreakLabel}`);
    if (schedule.shiftEnd < 1440) upcoming.push(`shift ends at ${gen2FormatClock12(schedule.shiftEnd)}`);
    const nearby = npcsRef.current
      .filter((other) => other.id !== live.id && (other.x - live.x) ** 2 + (other.y - live.y) ** 2 <= 36)
      .sort((a, b) => (a.x - live.x) ** 2 + (a.y - live.y) ** 2 - ((b.x - live.x) ** 2 + (b.y - live.y) ** 2))
      .slice(0, 6)
      .map((other) => ({ name: staff[other.id]?.name ?? npcName(other.id), doing: npcDoingLabel(other).toLowerCase() }));
    return {
      npc: {
        // ?lifeDry=1: talk to a throwaway "zz-test-" twin so the chat's own memory / roster writes never touch real staff
        id: LIFE_DRY ? `zz-test-${live.id}` : live.id,
        name: profile.name,
        title: profile.title,
        department: profile.department,
        room: roomName,
        sex: profile.sex,
        age: profile.age,
        personality: profile.personality,
        mood: moodText(live, profile),
        workEthic: profile.workEthic,
        action: npcDoingLabel(live).toLowerCase(),
        need: npcNeedHint(live).toLowerCase(),
        block: scheduleBlockText(live, profile),
        nextBreak: block.nextBreakLabel,
        recent: recent.length ? recent : [`has been working around ${roomName} since the visitor arrived`],
        upcoming: upcoming.slice(0, 6),
      },
      roster: LIFE_DRY ? [] : npcs.map((other) => {
        const info = staff[other.id] ?? defaultGrowOpsStaff(other);
        return { id: other.id, name: info.name, title: info.title, department: info.department };
      }),
      nearby,
    };
  }

  function openStaffBattle(npc: LiveNpc) {
    const profile = staff[npc.id] ?? defaultGrowOpsStaff(npc);
    setStaffBattleId(npc.id);
    setSpriteDialogMirror(spriteDialogFor(npc, profile, incidentPhase, incidentTargetRoom));
    setSelection(staffSelection(npc, profile));
    setContextMenu(undefined);
  }

  function saveGrowOpsStaff(nextStaff: GrowOpsStaff, dutyId?: string) {
    const existing = npcs.find((npc) => npc.id === nextStaff.id);
    setStaff((current) => ({ ...current, [nextStaff.id]: cleanGrowOpsStaff(nextStaff) }));
    if (existing) {
      setNpcs((current) => current.map((npc) => npc.id === nextStaff.id ? { ...npc, role: nextStaff.role } : npc));
      setSelection(actionSelection("GROW OPS SAVED", [`STAFF: ${nextStaff.name.toUpperCase()}`, `TITLE: ${nextStaff.title.toUpperCase()}`, `DEPT: ${nextStaff.department.toUpperCase()}`, "STATUS: UPDATED"]));
      return;
    }
    const duty = vacantDuties.find((item) => item.id === dutyId);
    const hire = createScreeningHire(nextStaff, duty?.npc);
    setNpcs((current) => [...current, hire]);
    if (duty) setVacantDuties((current) => current.filter((item) => item.id !== duty.id));
    setStaffBattleId(hire.id);
    setSelection(actionSelection("NEW HIRE SCREENED", [`STAFF: ${nextStaff.name.toUpperCase()}`, `TITLE: ${nextStaff.title.toUpperCase()}`, "ENTRY: SCREENING ROOM", "STATUS: WALKING IN"]));
  }

  function removeGrowOpsStaff(id: string) {
    const npc = npcs.find((item) => item.id === id);
    if (!npc || REQUIRED_STAFF_IDS.has(npc.id)) return;
    const removedStaff = staff[id] ?? defaultGrowOpsStaff(npc);
    setVacantDuties((current) => [...current.filter((item) => item.id !== npc.id), { id: npc.id, staff: removedStaff, npc }]);
    setNpcs((current) => current.filter((item) => item.id !== id));
    if (staffBattleId === id) setStaffBattleId(undefined);
    setSelection(actionSelection("DUTY SLOT VACANT", [`REMOVED: ${removedStaff.name.toUpperCase()}`, `SLOT: ${removedStaff.title.toUpperCase()}`, "ROUTE: PRESERVED", "REASSIGN: SCREEN A NEW SPRITE"]));
  }

  return (
    <LifeContext.Provider value={lifeContext}>
    <section className="mx-auto max-w-[1430px] px-4 pb-8">
      <div className="gb-shell">
        <div className="gb-topbar">
          <div>
            <h2>GEN 2 FACILITY MAP</h2>
            <span>RETRO OVERWORLD DASHBOARD</span>
          </div>
          <div className="gb-stats">
            <span className="life-chip" title={lifeCal?.weather?.text ?? "Today's date and the weather in Lewiston, Maine"}>{chipText(lifeClockDate, lifeCal?.weather ?? null)}</span>
            {holidayChip ? <span className="life-badge" title="Next holiday">{holidayChip}</span> : null}
            <span>CLOCK {clockText}</span>
            {life ? <span title="Facility crop lifecycle clock">LIFE {life.snap.simLabel} X{life.snap.scale}</span> : null}
            <button type="button" className={lifecycleOpen ? "is-active" : ""} onClick={() => setLifecycleOpen((open) => !open)}>LIFECYCLE</button>
            <button type="button" className={`walk-enter ${walk.active ? "is-active" : ""}`} onClick={(event) => { event.currentTarget.blur(); if (walk.active) exitFacility(); else enterFacility(); }} title="Walk around the live facility as a visitor (arrows / WASD, V switches first person)">{walk.active ? "EXIT FACILITY" : "ENTER FACILITY"}</button>
            <span>{gen2Rooms.length} ROOMS</span>
            <span>{npcs.length} STAFF</span>
            <span>{Object.keys(gen2RoomOperations).length} JOBS</span>
            <span>{focusedRoom ? "ROOM VIEW" : "FULL VIEW"}</span>
          </div>
        </div>

        <div ref={viewportRef} style={clockHandStyle()} className={`gen2-viewport ${focusedRoom && !walk.active ? "is-detail" : ""} ${walk.active ? "is-walk" : ""} ${walk.active && walk.view === "fp" ? "is-walk-fp" : ""} ${walk.active && walk.full ? "is-walk-full" : ""}`} onClick={() => setContextMenu(undefined)} onContextMenu={(event) => event.preventDefault()}>
          {!focusedRoom || walk.active ? (
            <div ref={boardRef} className={`gen2-board ${lifeNight ? "life-night" : ""} ${lifeWeather !== "clear" ? `life-wx-${lifeWeather}` : ""}`} style={{ width: worldWidth, height: worldHeight, transform: overviewTransform }}>
              {gen2Hallways.map((hall, index) => (
                <HallView key={`hall-${index}`} hall={hall} />
              ))}
              {gen2Rooms.map((room) => (
                <RoomView key={room.id} room={room} roomVitals={roomVitals} activityState={activityState} onOpen={openRoom} onGrowOps={() => openGrowOps("staff")} onFacilityEditor={() => openGrowOps("facility")} onLifecycle={() => setLifecycleOpen(true)} onSelect={setSelection} onContextMenu={openContextMenu} />
              ))}
              {gen2Props.map((prop, index) => (
                <PropView key={`${prop.kind}-${index}`} prop={prop} roomVitals={roomVitals} productionPhase={productionPhase} incidentPhase={incidentPhase} incidentTargetRoom={incidentTargetRoom} onSelect={setSelection} onContextMenu={openContextMenu} onTerminalOpen={openTerminal} onFacilityEditor={() => openGrowOps("facility")} />
              ))}
              <HolidayDecor decor={lifeDecor} />
              <BirthdayDecor stations={birthdayStations} cake={todayBirthdayIds.length ? PARTY_CAKE : null} />
              <AmbienceOverlay date={lifeClockDate} />
              {npcs.map((npc) => (
                <NpcView key={npc.id} npc={npc} staff={staff[npc.id]} incidentPhase={incidentPhase} incidentTargetRoom={incidentTargetRoom} selected={staffBattleId === npc.id} onSelect={setSelection} onStaffOpen={openStaffBattle} onTalk={openTalk} onStaffEdit={(npc) => openGrowOps("staff", npc.id)} onContextMenu={openContextMenu} />
              ))}
              <LifeBubbles />
              <RoutePathOverlay npc={npcs.find((item) => item.id === highlightRouteId)} />
              {walk.active ? (
                <div ref={walkPlayerRef} className="gen2-npc-wrap walk-player" aria-hidden="true" style={{ left: walk.spawn.x * GEN2_TILE + 1, top: walk.spawn.y * GEN2_TILE - 8 }}>
                  <span ref={walkSpriteRef} className={`gen2-npc role-visitor face-${walk.spawn.dir} step-0`} />
                </div>
              ) : null}
            </div>
          ) : (
            <RoomDetail room={focusedRoom} npcs={npcs} staff={staff} roomVitals={roomVitals} activityState={activityState} productionPhase={productionPhase} incidentPhase={incidentPhase} incidentTargetRoom={incidentTargetRoom} selectedNpcId={staffBattleId} onBack={closeRoom} onGrowOps={() => openGrowOps("staff")} onFacilityEditor={() => openGrowOps("facility")} onSelect={setSelection} onStaffOpen={openStaffBattle} onTalk={openTalk} onStaffEdit={(npc) => openGrowOps("staff", npc.id)} onContextMenu={openContextMenu} onTerminalOpen={openTerminal} highlightedRouteId={highlightRouteId} />
          )}
          {walk.active ? (
            <WalkMode
              hostRef={walkHostRef}
              npcs={npcs}
              view={walk.view}
              full={walk.full}
              pad={walk.pad}
              viewportRef={viewportRef}
              boardRef={boardRef}
              playerRef={walkPlayerRef}
              spriteRef={walkSpriteRef}
              overviewTransform={overviewTransform}
              playerTile={playerTileRef}
              spawn={walk.spawn}
              onViewChange={(view) => setWalk((current) => (current.view === view ? current : { ...current, view }))}
              onFullChange={(full) => setWalk((current) => ({ ...current, full }))}
              onPadChange={(pad) => setWalk((current) => ({ ...current, pad }))}
              onExit={exitFacility}
            />
          ) : null}
          {walk.active && selection ? (
            <div className="walk-card" onClick={(event) => event.stopPropagation()}>
              <SelectionCard selection={selection} />
            </div>
          ) : null}
          {contextMenu ? <ContextMenu menu={contextMenu} onClose={() => setContextMenu(undefined)} /> : null}
          {terminalSession ? <TerminalPanel session={terminalSession} onClose={() => setTerminalSession(undefined)} /> : null}
          {talk && talkNpc ? <TalkDialog key={talk.npcId} speaker={(staff[talk.npcId]?.name ?? humanizeNpcId(talk.npcId)).toUpperCase()} getBrief={() => buildTalkBrief(talk.npcId)} interrupt={talk.interrupt} onStats={() => { const target = talkNpc; closeTalk(); openStaffBattle(target); }} onClose={closeTalk} /> : null}
          {dialog ? <PokemonDialog dialog={dialog} onChoose={chooseDialogOption} onHover={(index) => setDialog((current) => current ? { ...current, selectedIndex: index } : current)} /> : null}
          {activityLabOpen ? <ActivityLabDrawer activityState={activityState} intercomNotice={intercomNotice} onRunControl={runActivityControl} onRunScenario={runActivityScenario} onSaveActivity={saveActivityCheckpoint} onUndoActivity={undoActivityCheckpoint} onClose={() => setActivityLabOpen(false)} isSavingActivity={isSavingActivity} activityHistoryCount={activityHistoryCount} /> : null}
          {lifecycleOpen ? <LifecyclePanel life={life} calendar={{ dateText: `${lifeClockDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`.toUpperCase(), weatherText: lifeCal?.weather?.text, holidays: (lifeCal?.holidays ?? []).filter((item) => item.daysUntil >= 0).slice(0, 4), birthdays: upcomingBirthdays, decor: lifeDecor }} onClose={() => setLifecycleOpen(false)} /> : null}
          {growOpsOpen ? <GrowOpsPanel initialTab={growOpsInitialTab} focusStaffId={growOpsFocusStaffId} npcs={npcs} staff={staff} vacantDuties={vacantDuties} onPersonaSaved={(id, persona) => setBirthday(id, persona.birthdayMonth, persona.birthdayDay)} onClose={() => setGrowOpsOpen(false)} onSave={saveGrowOpsStaff} onRemove={removeGrowOpsStaff} onRestoreStaff={(nextStaff) => setStaff(Object.fromEntries(Object.entries(nextStaff).map(([id, item]) => [id, cleanGrowOpsStaff({ ...(item as GrowOpsStaff), id })])))} onPreviewRoute={(id) => { setHighlightRouteId(id); setStaffBattleId(id); }} onClearRoutePreview={() => setHighlightRouteId(undefined)} /> : null}
        </div>

        <div className="gen2-info-row">
          <div className="gen2-message-stack">
            <div className="gb-message">
              {focusedRoom ? "RIGHT-CLICK STAFF, PLANTS, COMPUTERS, OR EQUIPMENT FOR QUICK ACTIONS." : "RIGHT-CLICK A ROOM TO ZOOM INTO AN EXPLODED VIEW OR OPEN QUICK ACTIONS."}
            </div>
            <div className="gb-message activity-intercom">{intercomNotice}</div>
            {staffBattleNpc ? <WorkerBattlePanel npc={staffBattleNpc} staff={staff[staffBattleNpc.id]} mirror={spriteDialogMirror} onRouteView={() => setHighlightRouteId(staffBattleNpc.id)} onClose={() => { setStaffBattleId(undefined); setHighlightRouteId(undefined); }} docked /> : null}
          </div>
          <OperationsDeck activityState={activityState} activityStatus={activitySnapshotStatus} activityHistoryCount={activityHistoryCount} isSavingActivity={isSavingActivity} onHotKey={openHotKeyDialog} onOpenActivityLab={() => setActivityLabOpen(true)} onSaveActivity={saveActivityCheckpoint} onUndoActivity={undoActivityCheckpoint} />
          <SelectionCard selection={selection} />
        </div>
      </div>
    </section>
    </LifeContext.Provider>
  );
}


function SpriteDialogMirror({ mirror }: { mirror?: SpriteDialogMirrorState }) {
  if (!mirror) {
    return (
      <div className="sprite-dialog-mirror is-empty">
        <strong>SPRITE COMMS</strong>
        <span>CLICK A STAFF SPRITE TO MIRROR ITS CHAT LINE HERE.</span>
      </div>
    );
  }

  return (
    <div className="sprite-dialog-mirror">
      <span className={`gen2-npc role-${mirror.spriteRole} face-down step-0`} aria-hidden="true" />
      <div>
        <strong>{mirror.title}</strong>
        <span>“{mirror.line}”</span>
        <em>{mirror.detail}</em>
      </div>
    </div>
  );
}

const ACTIVITY_STORAGE_KEY = "neurolab_gen2_activity_state_v1";

function defaultActivityState(npcs: LiveNpc[]): ActivityState {
  const roomCounts = countNpcsByRoom(npcs);
  const packagingWorkers = roomCounts.pack ?? 0;
  const extractionWorkers = roomCounts.extract ?? 0;
  const rdWorkers = (roomCounts.rd1 ?? 0) + (roomCounts.rd2 ?? 0);
  return {
    tick: 0,
    phaseLabel: "PACKAGING QUEUE",
    inventory: {
      packaging: 8 + packagingWorkers,
      extractionBatches: 2 + extractionWorkers,
      rdSamples: 1 + rdWorkers,
      rdPassed: 0,
      rdFailed: 0,
      salesStock: 4,
      managerRequests: 0,
    },
    feed: [
      { id: "activity-boot", tick: 0, roomId: "ops", kind: "manager", message: "Activity loop online; waiting for staff route arrivals." },
      { id: "activity-seed-pack", tick: 0, roomId: "pack", kind: "packaging", message: "Packaging seeded starter inventory for extraction handoff." },
    ],
  };
}

function loadPersistedActivityState(npcs: LiveNpc[]) {
  const fallback = defaultActivityState(npcs);
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(ACTIVITY_STORAGE_KEY);
    if (!stored) return fallback;
    return coerceActivityState(JSON.parse(stored), fallback);
  } catch {
    return fallback;
  }
}

function persistActivityState(state: ActivityState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(state));
}

function coerceActivityState(value: unknown, fallback: ActivityState): ActivityState {
  const state = value as Partial<ActivityState> | undefined;
  const inventory = state?.inventory as Partial<ActivityInventory> | undefined;
  const safeInventory: ActivityInventory = {
    packaging: finiteInventory(inventory?.packaging, fallback.inventory.packaging),
    extractionBatches: finiteInventory(inventory?.extractionBatches, fallback.inventory.extractionBatches),
    rdSamples: finiteInventory(inventory?.rdSamples, fallback.inventory.rdSamples),
    rdPassed: finiteInventory(inventory?.rdPassed, fallback.inventory.rdPassed),
    rdFailed: finiteInventory(inventory?.rdFailed, fallback.inventory.rdFailed),
    salesStock: finiteInventory(inventory?.salesStock, fallback.inventory.salesStock),
    managerRequests: finiteInventory(inventory?.managerRequests, fallback.inventory.managerRequests),
  };
  const feed = Array.isArray(state?.feed) ? state.feed.filter(isActivityEvent).slice(0, 30) : fallback.feed;
  return {
    tick: Number.isFinite(state?.tick) ? Number(state?.tick) : fallback.tick,
    phaseLabel: typeof state?.phaseLabel === "string" ? state.phaseLabel : fallback.phaseLabel,
    inventory: safeInventory,
    feed,
  };
}

function finiteInventory(value: unknown, fallback: number) {
  return Number.isFinite(value) ? Math.max(0, Math.round(Number(value))) : fallback;
}

function isActivityEvent(event: unknown): event is ActivityEvent {
  const item = event as ActivityEvent;
  return typeof item?.id === "string" && Number.isFinite(item.tick) && typeof item.roomId === "string" && typeof item.message === "string";
}

function advanceActivityState(current: ActivityState, arrivals: Array<{ npc: LiveNpc; fromRoomId?: string; toRoomId?: string }>, productionPhase: number, incidentPhase: number): ActivityState {
  let next: ActivityState = { ...current, tick: current.tick + 1, phaseLabel: activityPhaseLabel(productionPhase), inventory: { ...current.inventory }, feed: [...current.feed] };
  for (const arrival of arrivals) {
    const event = activityEventForArrival(arrival.npc, arrival.fromRoomId, arrival.toRoomId, next.tick, incidentPhase);
    if (!event) continue;
    next = applyActivityEvent(next, event);
  }
  return { ...next, feed: next.feed.slice(0, 30) };
}

function applyActivityEvent(state: ActivityState, event: ActivityEvent): ActivityState {
  const inventory = { ...state.inventory };
  if (event.kind === "packaging") inventory.packaging += 2;
  if (event.kind === "extraction") {
    inventory.packaging = Math.max(0, inventory.packaging - 1);
    inventory.extractionBatches += 1;
  }
  if (event.kind === "research") {
    inventory.extractionBatches = Math.max(0, inventory.extractionBatches - 1);
    inventory.rdSamples += 1;
  }
  if (event.kind === "test") {
    inventory.rdSamples = Math.max(0, inventory.rdSamples - 1);
    if (event.message.includes("FAILED")) {
      inventory.rdFailed += 1;
      inventory.managerRequests += 1;
    } else {
      inventory.rdPassed += 1;
    }
  }
  if (event.kind === "sales") {
    inventory.rdPassed = Math.max(0, inventory.rdPassed - 1);
    inventory.salesStock += 1;
  }
  if (event.kind === "manager") inventory.managerRequests = Math.max(0, inventory.managerRequests - 1);
  return { ...state, inventory, feed: [event, ...state.feed] };
}

function applyManualActivityControl(current: ActivityState, control: ActivityControl): { state: ActivityState; event: ActivityEvent } {
  const inventory = { ...current.inventory };
  const tick = current.tick + 1;
  let message = "Manual Activity Lab pulse queued.";
  if (control === "seed-packaging") {
    inventory.packaging += 5;
    message = "INTERCOM: Packaging seeded +5 units for extraction crews.";
  }
  if (control === "force-extraction") {
    inventory.packaging = Math.max(0, inventory.packaging - 1);
    inventory.extractionBatches += 1;
    message = "INTERCOM: Extraction batch forced from available packaging stock.";
  }
  if (control === "force-rd-pass") {
    inventory.rdSamples = Math.max(0, inventory.rdSamples - 1);
    inventory.rdPassed += 1;
    message = "INTERCOM: R&D test manually passed; pass ticket released.";
  }
  if (control === "force-rd-fail") {
    inventory.rdSamples = Math.max(0, inventory.rdSamples - 1);
    inventory.rdFailed += 1;
    inventory.managerRequests += 1;
    message = "INTERCOM: R&D test manually failed; manager request queued.";
  }
  if (control === "clear-manager-requests") {
    const cleared = inventory.managerRequests;
    inventory.managerRequests = 0;
    message = `INTERCOM: Manager queue cleared (${cleared} request${cleared === 1 ? "" : "s"}).`;
  }
  const event: ActivityEvent = { id: `manual-${tick}-${control}`, tick, roomId: "ops", kind: "control", message };
  return {
    event,
    state: { ...current, tick, phaseLabel: "MANUAL LAB CONTROL", inventory, feed: [event, ...current.feed].slice(0, 30) },
  };
}

function applyActivityScenario(current: ActivityState, scenario: ActivityScenario): { state: ActivityState; event: ActivityEvent } {
  const inventory = { ...current.inventory };
  const tick = current.tick + 1;
  let message = "INTERCOM: Activity scenario loaded.";
  let phaseLabel = "SCENARIO LOADED";
  if (scenario === "normal-shift") {
    inventory.packaging += 3;
    inventory.extractionBatches += 1;
    inventory.rdSamples += 1;
    phaseLabel = "NORMAL SHIFT";
    message = "INTERCOM: Normal production shift staged across Packaging, Extraction, and R&D.";
  }
  if (scenario === "rd-failure-storm") {
    inventory.rdSamples = Math.max(0, inventory.rdSamples - 2);
    inventory.rdFailed += 3;
    inventory.managerRequests += 3;
    phaseLabel = "R&D FAILURE STORM";
    message = "INTERCOM: R&D failure storm queued; managers requested on deck.";
  }
  if (scenario === "sales-push") {
    inventory.rdPassed += 2;
    inventory.salesStock += 6;
    phaseLabel = "SALES PUSH";
    message = "INTERCOM: Sales push loaded; passed inventory moved toward Sales stock.";
  }
  if (scenario === "manager-sweep") {
    const cleared = inventory.managerRequests;
    inventory.managerRequests = 0;
    inventory.rdFailed = Math.max(0, inventory.rdFailed - 1);
    phaseLabel = "MANAGER SWEEP";
    message = `INTERCOM: Manager sweep completed; cleared ${cleared} request${cleared === 1 ? "" : "s"}.`;
  }
  const event: ActivityEvent = { id: `scenario-${tick}-${scenario}`, tick, roomId: "ops", kind: "control", message };
  return { event, state: { ...current, tick, phaseLabel, inventory, feed: [event, ...current.feed].slice(0, 30) } };
}

function activityBadgeForRoom(roomId: string, state: ActivityState): ActivityRoomBadge | undefined {
  const inv = state.inventory;
  if (roomId === "pack") return inv.packaging < 3 ? { label: "LOW PKG", tone: "warn" } : { label: `${inv.packaging} PKG`, tone: "ready" };
  if (roomId === "extract") return inv.extractionBatches > 4 ? { label: "EXT STACK", tone: "busy" } : inv.packaging < 1 ? { label: "WAIT PKG", tone: "warn" } : { label: `${inv.extractionBatches} EXT`, tone: "ready" };
  if (roomId === "rd1") return inv.extractionBatches < 1 ? { label: "WAIT EXT", tone: "warn" } : { label: `${inv.rdSamples} SAMPLE`, tone: "ready" };
  if (roomId === "rd2") return inv.managerRequests > 0 || inv.rdFailed > 2 ? { label: `${inv.managerRequests} MGR`, tone: "warn" } : { label: `${inv.rdPassed} PASS`, tone: "ready" };
  if (roomId === "sales") return inv.salesStock > 8 ? { label: "SALES FULL", tone: "busy" } : { label: `${inv.salesStock} STOCK`, tone: "ready" };
  if (["ops", "cultMgr", "boss"].includes(roomId) && inv.managerRequests > 0) return { label: `${inv.managerRequests} REQ`, tone: "warn" };
  return undefined;
}

function activityEventForArrival(npc: LiveNpc, fromRoomId: string | undefined, toRoomId: string | undefined, tick: number, incidentPhase: number): ActivityEvent | undefined {
  if (!toRoomId || toRoomId === fromRoomId) return undefined;
  const name = gen2WorkerIdentity[npc.id]?.name ?? npc.id.replace(/([A-Z])/g, " $1");
  const cargo = visibleCargo(npc, incidentPhase);
  if (toRoomId === "pack") return { id: `pkg-${tick}-${npc.id}`, tick, roomId: toRoomId, kind: "packaging", message: `${name} staged ${cargo === "package" ? "sealed" : "fresh"} packages for extraction.` };
  if (toRoomId === "extract") return { id: `ext-${tick}-${npc.id}`, tick, roomId: toRoomId, kind: "extraction", message: `${name} delivered package feedstock; extraction batch started.` };
  if (toRoomId === "rd1") return { id: `rd-${tick}-${npc.id}`, tick, roomId: toRoomId, kind: "research", message: `${name} moved extract into R&D sample intake.` };
  if (toRoomId === "rd2") {
    const failed = incidentPhase % 7 === 0;
    return { id: `test-${tick}-${npc.id}`, tick, roomId: toRoomId, kind: "test", message: failed ? `${name} R&D TEST FAILED; manager request queued.` : `${name} cleared R&D TEST; pass ticket released.` };
  }
  if (toRoomId === "sales") return { id: `sales-${tick}-${npc.id}`, tick, roomId: toRoomId, kind: "sales", message: `${name} pushed passed inventory into Sales stock.` };
  if (["ops", "cultMgr", "boss"].includes(toRoomId)) return { id: `mgr-${tick}-${npc.id}`, tick, roomId: toRoomId, kind: "manager", message: `${name} checked the manager queue after ${fromRoomId ? roomLabel(fromRoomId) : "floor"}.` };
  return undefined;
}

function activityPhaseLabel(productionPhase: number) {
  return ["PACKAGING QUEUE", "EXTRACTION RUN", "R&D SAMPLE", "TEST REVIEW", "SALES READY", "MANAGER SWEEP"][productionPhase] ?? "LIVE LOOP";
}

function roomMapForNpcs(npcs: LiveNpc[]) {
  return npcs.reduce<Record<string, string | undefined>>((rooms, npc) => {
    rooms[npc.id] = roomAt(npc.x, npc.y)?.id;
    return rooms;
  }, {});
}

function countNpcsByRoom(npcs: LiveNpc[]) {
  return npcs.reduce<Record<string, number>>((counts, npc) => {
    const room = roomAt(npc.x, npc.y)?.id;
    if (room) counts[room] = (counts[room] ?? 0) + 1;
    return counts;
  }, {});
}

function OperationsDeck({
  activityState,
  activityStatus,
  activityHistoryCount,
  isSavingActivity,
  onHotKey,
  onOpenActivityLab,
  onSaveActivity,
  onUndoActivity,
}: {
  activityState: ActivityState;
  activityStatus: string;
  activityHistoryCount: number;
  isSavingActivity: boolean;
  onHotKey: (hotKey: Gen2HotKey) => void;
  onOpenActivityLab: () => void;
  onSaveActivity: () => void;
  onUndoActivity: () => void;
}) {
  const inv = activityState.inventory;
  return (
    <div className="gen2-ops-deck">
      <strong>HOT KEYS</strong>
      <div className="gen2-hot-grid">
        {gen2BossHotKeys.map((hotKey) => (
          <button type="button" key={hotKey.key} title={`${hotKey.message} ${hotKey.expectedResponse}`} onClick={() => onHotKey(hotKey)}>
            {hotKey.key} {hotKey.label}
          </button>
        ))}
      </div>
      <div className="activity-engine-card">
        <div className="activity-engine-title">
          <strong>ACTIVITY ENGINE</strong>
          <span>{activityState.phaseLabel} · TICK {activityState.tick}</span>
        </div>
        <em className="activity-engine-subtitle">Route arrivals and manual lab controls mutate inventory and feed entries.</em>
        <div className="activity-inventory-grid">
          <span><b>{inv.packaging}</b> PKG</span>
          <span><b>{inv.extractionBatches}</b> EXT</span>
          <span><b>{inv.rdSamples}</b> R&D</span>
          <span><b>{inv.rdPassed}</b> PASS</span>
          <span><b>{inv.rdFailed}</b> FAIL</span>
          <span><b>{inv.salesStock}</b> SALES</span>
        </div>
        <div className="activity-feed-list">
          {activityState.feed.map((event) => <span key={event.id} className={`activity-feed-${event.kind}`}>{event.message}</span>)}
        </div>
        <div className="activity-snapshot-bar">
          <button type="button" onClick={onOpenActivityLab}>OPEN ACTIVITY LAB</button>
          <button type="button" onClick={onSaveActivity} disabled={isSavingActivity}>SAVE LOOP</button>
          <button type="button" onClick={onUndoActivity} disabled={isSavingActivity || activityHistoryCount < 1}>UNDO LOOP</button>
          <em>{activityStatus}</em>
        </div>
      </div>
      <em>WO LOG: {gen2ReportLogPath}</em>
      <em>{gen2PerformanceBriefs[0]}</em>
    </div>
  );
}

function ActivityLabDrawer({
  activityState,
  intercomNotice,
  isSavingActivity,
  activityHistoryCount,
  onRunControl,
  onRunScenario,
  onSaveActivity,
  onUndoActivity,
  onClose,
}: {
  activityState: ActivityState;
  intercomNotice: string;
  isSavingActivity: boolean;
  activityHistoryCount: number;
  onRunControl: (control: ActivityControl) => void;
  onRunScenario: (scenario: ActivityScenario) => void;
  onSaveActivity: () => void;
  onUndoActivity: () => void;
  onClose: () => void;
}) {
  const inv = activityState.inventory;
  return (
    <div className="activity-lab-drawer" role="dialog" aria-label="Activity Lab Controls">
      <div className="activity-lab-title">
        <div>
          <strong>ACTIVITY LAB</strong>
          <span>{activityState.phaseLabel} · TICK {activityState.tick}</span>
        </div>
        <button type="button" onClick={onClose}>CLOSE</button>
      </div>
      <div className="activity-intercom-screen">{intercomNotice}</div>
      <div className="activity-lab-inventory">
        <span><b>{inv.packaging}</b><em>Packaging</em></span>
        <span><b>{inv.extractionBatches}</b><em>Extraction</em></span>
        <span><b>{inv.rdSamples}</b><em>R&D samples</em></span>
        <span><b>{inv.rdPassed}</b><em>Pass tickets</em></span>
        <span><b>{inv.rdFailed}</b><em>Failed tests</em></span>
        <span><b>{inv.salesStock}</b><em>Sales stock</em></span>
        <span><b>{inv.managerRequests}</b><em>Mgr queue</em></span>
      </div>
      <strong className="activity-lab-section-title">MANUAL CONTROLS</strong>
      <div className="activity-control-grid">
        <button type="button" onClick={() => onRunControl("seed-packaging")}>SEED PACKAGING</button>
        <button type="button" onClick={() => onRunControl("force-extraction")}>FORCE EXTRACTION BATCH</button>
        <button type="button" onClick={() => onRunControl("force-rd-pass")}>FORCE R&D PASS</button>
        <button type="button" onClick={() => onRunControl("force-rd-fail")}>FORCE R&D FAIL</button>
        <button type="button" onClick={() => onRunControl("clear-manager-requests")}>CLEAR MANAGER REQUESTS</button>
      </div>
      <strong className="activity-lab-section-title">SCENARIO PRESETS</strong>
      <div className="activity-control-grid activity-scenario-grid">
        <button type="button" onClick={() => onRunScenario("normal-shift")}>NORMAL SHIFT</button>
        <button type="button" onClick={() => onRunScenario("rd-failure-storm")}>R&D FAILURE STORM</button>
        <button type="button" onClick={() => onRunScenario("sales-push")}>SALES PUSH</button>
        <button type="button" onClick={() => onRunScenario("manager-sweep")}>MANAGER SWEEP</button>
      </div>
      <div className="activity-lab-feed">
        {activityState.feed.map((event) => (
          <span key={event.id} className={`activity-feed-${event.kind}`}>
            <b>#{event.tick}</b> {roomLabel(event.roomId)} — {event.message}
          </span>
        ))}
      </div>
      <div className="activity-lab-actions">
        <button type="button" onClick={onSaveActivity} disabled={isSavingActivity}>SAVE LOOP</button>
        <button type="button" onClick={onUndoActivity} disabled={isSavingActivity || activityHistoryCount < 1}>UNDO LOOP</button>
      </div>
    </div>
  );
}

function GrowOpsPanel({
  initialTab = "staff",
  focusStaffId,
  npcs,
  staff,
  vacantDuties,
  onPersonaSaved,
  onClose,
  onSave,
  onRemove,
  onRestoreStaff,
  onPreviewRoute,
  onClearRoutePreview,
}: {
  initialTab?: GrowOpsTab;
  focusStaffId?: string;
  npcs: LiveNpc[];
  staff: Record<string, GrowOpsStaff>;
  vacantDuties: VacantDuty[];
  onPersonaSaved?: (id: string, persona: Persona) => void;
  onClose: () => void;
  onSave: (nextStaff: GrowOpsStaff, dutyId?: string) => void;
  onRemove: (id: string) => void;
  onRestoreStaff: (nextStaff: Record<string, unknown>) => void;
  onPreviewRoute: (id: string) => void;
  onClearRoutePreview: () => void;
}) {
  const firstStaffId = npcs[0]?.id ?? "boss";
  const [selectedId, setSelectedId] = useState(firstStaffId);
  const [isCreating, setIsCreating] = useState(false);
  const [dutyId, setDutyId] = useState("");
  const [draft, setDraft] = useState<GrowOpsStaff>(() => staff[firstStaffId] ?? defaultGrowOpsStaff(npcs[0] ?? gen2Npcs[0]));
  const [savedMessage, setSavedMessage] = useState("CHANGES WAIT FOR SAVE.");
  const [activeTab, setActiveTab] = useState<GrowOpsTab>(initialTab);
  const [staffSnapshot, setStaffSnapshot] = useState<StaffConfigSnapshot | null>(null);
  const [staffHistoryCount, setStaffHistoryCount] = useState(0);
  const [staffSnapshotStatus, setStaffSnapshotStatus] = useState("Staff snapshots not loaded yet.");
  const [isApplyingStaff, setIsApplyingStaff] = useState(false);
  const selectedNpc = npcs.find((npc) => npc.id === selectedId);
  const personaDrafts = useRef<PersonaDrafts>(new Map());
  const [personaRevision, setPersonaRevision] = useState(0);

  /** Writes the personality edits (if any) for a worker; called by SAVE and APPLY STAFF SNAPSHOT. */
  async function savePersona(id: string): Promise<string> {
    const patch = personaDrafts.current.get(id);
    if (!patch) return "";
    try {
      const saved = await putPersona(id, patch);
      if (!saved) return " PERSONALITY NOT WRITTEN (?lifeDry=1).";
      personaDrafts.current.delete(id);
      onPersonaSaved?.(id, saved);
      setPersonaRevision((value) => value + 1);
      return " PERSONALITY SAVED.";
    } catch {
      return " PERSONALITY SAVE FAILED.";
    }
  }

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (focusStaffId && npcs.some((npc) => npc.id === focusStaffId)) loadExisting(focusStaffId);
  }, [focusStaffId]);

  function loadExisting(id: string) {
    const npc = npcs.find((item) => item.id === id);
    if (!npc) return;
    setSelectedId(id);
    setDraft(staff[id] ?? defaultGrowOpsStaff(npc));
    setIsCreating(false);
    setDutyId("");
    setSavedMessage("EDITING EXISTING STAFF.");
  }

  function beginHire() {
    const hireNumber = npcs.filter((npc) => npc.id.startsWith("screenedHire")).length + 1;
    const id = `screenedHire${Date.now().toString(36)}${hireNumber}`;
    setSelectedId(id);
    setDraft(newGrowOpsHire(id));
    setIsCreating(true);
    setDutyId("");
    setSavedMessage("NEW HIRE WILL ENTER THROUGH SCREENING.");
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    const next = cleanGrowOpsStaff({ ...draft, custom: isCreating || draft.custom });
    setDraft(next);
    onSave(next, isCreating ? dutyId : undefined);
    setIsCreating(false);
    setSavedMessage(`${next.name.toUpperCase()} SAVED.`);
    void savePersona(next.id).then((note) => { if (note) setSavedMessage(`${next.name.toUpperCase()} SAVED.${note}`); });
  }

  function setField<K extends keyof GrowOpsStaff>(key: K, value: GrowOpsStaff[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  const schedule = draft.schedule ?? gen2DefaultSchedule(draft.id, draft.department);
  const [clockText, setClockText] = useState(() => gen2FormatClock12(clockMinuteNow()));
  useEffect(() => {
    const interval = window.setInterval(() => setClockText(gen2FormatClock12(clockMinuteNow())), 15000);
    return () => window.clearInterval(interval);
  }, []);
  function setSchedule(next: Gen2Schedule) {
    setField("schedule", next);
  }

  useEffect(() => {
    let active = true;
    getStaffConfigSnapshot()
      .then((state) => {
        if (!active) return;
        setStaffSnapshot(state.current);
        setStaffHistoryCount(state.history.length);
        setStaffSnapshotStatus(state.current ? `Backend staff snapshot ${state.current.id} loaded (${state.history.length} undo point${state.history.length === 1 ? "" : "s"}).` : "No backend staff snapshot yet. Apply will create one.");
      })
      .catch((error) => {
        if (active) setStaffSnapshotStatus(`Staff snapshot load failed: ${error instanceof Error ? error.message : String(error)}`);
      });
    return () => { active = false; };
  }, []);

  async function applyStaffSnapshot() {
    const next = cleanGrowOpsStaff({ ...draft, custom: isCreating || draft.custom });
    const nextStaff = { ...staff, [next.id]: next };
    setIsApplyingStaff(true);
    setStaffSnapshotStatus("Saving backend staff snapshot...");
    try {
      onSave(next, isCreating ? dutyId : undefined);
      const state = await applyStaffConfigSnapshot({ staff: nextStaff, note: `Staff editor apply: ${next.name}` });
      setStaffSnapshot(state.current);
      setStaffHistoryCount(state.history.length);
      setStaffSnapshotStatus(`Applied staff snapshot ${state.current?.id ?? "unknown"}. Undo points: ${state.history.length}.`);
      setDraft(next);
      setIsCreating(false);
      void savePersona(next.id);
    } catch (error) {
      setStaffSnapshotStatus(`Staff apply failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsApplyingStaff(false);
    }
  }

  async function undoStaffSnapshot() {
    setIsApplyingStaff(true);
    setStaffSnapshotStatus("Restoring previous backend staff snapshot...");
    try {
      const state = await undoStaffConfigSnapshot();
      setStaffSnapshot(state.current);
      setStaffHistoryCount(state.history.length);
      if (state.current?.staff) onRestoreStaff(state.current.staff);
      setStaffSnapshotStatus(`Restored ${state.current?.id ?? "previous staff snapshot"}. Undo points left: ${state.history.length}.`);
    } catch (error) {
      setStaffSnapshotStatus(`Staff undo failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsApplyingStaff(false);
    }
  }

  return (
    <div className="grow-ops-panel" onClick={(event) => event.stopPropagation()}>
      <div className="grow-ops-title">
        <div>
          <strong>GROW OPS</strong>
          <span>{activeTab === "staff" ? "STAFF / CHARACTER EDITOR" : "FACILITY / ROOM EDITOR"}</span>
        </div>
        <div className="grow-ops-title-controls">
          <button type="button" className="grow-ops-close" onClick={onClose}>CLOSE</button>
          <div className="grow-ops-title-actions" aria-label="Grow Ops editor tabs">
            <button type="button" className={activeTab === "staff" ? "is-active" : ""} onClick={() => setActiveTab("staff")}>STAFF</button>
            <button type="button" className={activeTab === "facility" ? "is-active" : ""} onClick={() => setActiveTab("facility")}>FACILITY</button>
          </div>
        </div>
      </div>
      {activeTab === "staff" ? (
      <div className="grow-ops-body">
        <aside className="grow-ops-roster">
          <button type="button" className="grow-ops-new" onClick={beginHire}>+ NEW SPRITE</button>
          {npcs.map((npc) => {
            const item = staff[npc.id] ?? defaultGrowOpsStaff(npc);
            return (
              <button type="button" key={npc.id} className={selectedId === npc.id && !isCreating ? "is-active" : ""} onClick={() => loadExisting(npc.id)}>
                <span className="grow-ops-roster-sprite"><i className={`gen2-npc role-${item.role} face-down step-0`} style={staffStyle(item)} /></span>
                <b>{item.name}</b>
                <em>{item.title}</em>
              </button>
            );
          })}
        </aside>
        <form className="grow-ops-form" onSubmit={save}>
          <div className="grow-ops-preview">
            <span className="grow-ops-preview-stage"><i className={`gen2-npc role-${draft.role} face-down step-1 activity-busy`} style={staffStyle(draft)} /></span>
            <div>
              <strong>{isCreating ? "SCREEN NEW HIRE" : "EDIT STAFF"}</strong>
              <em>{savedMessage}</em>
            </div>
          </div>
          {selectedNpc ? <StaffRoutePreview npc={selectedNpc} staff={draft} onPreview={() => onPreviewRoute(selectedNpc.id)} onClear={onClearRoutePreview} /> : null}
          <div className="staff-snapshot-panel">
            <strong>STAFF SNAPSHOT</strong>
            <span>{staffSnapshot ? `${staffSnapshot.id} @ ${new Date(staffSnapshot.savedAt).toLocaleTimeString()}` : "none yet"}</span>
            <span>UNDO POINTS: {staffHistoryCount}</span>
            <span>{staffSnapshotStatus}</span>
          </div>
          <div className="grow-ops-grid">
            <label>NAME<input value={draft.name} onChange={(event) => setField("name", event.target.value)} required maxLength={24} /></label>
            <label>TITLE<input value={draft.title} onChange={(event) => setField("title", event.target.value)} required maxLength={34} /></label>
            <label>DEPARTMENT<input value={draft.department} onChange={(event) => setField("department", event.target.value)} required maxLength={26} /></label>
            <label>ROLE
              <select value={draft.role} onChange={(event) => setField("role", event.target.value as Gen2NpcRole)}>
                {(["cultivation", "processing", "science", "security", "logistics", "maintenance", "secretary", "executive", "boss"] as Gen2NpcRole[]).map((role) => <option value={role} key={role}>{role}</option>)}
              </select>
            </label>
            <label>SEX<input value={draft.sex} onChange={(event) => setField("sex", event.target.value)} required maxLength={12} /></label>
            <label>AGE<input type="number" min={18} max={99} value={draft.age} onChange={(event) => setField("age", Number(event.target.value))} /></label>
            <label>WORK ETHIC
              <select value={draft.workEthic} onChange={(event) => setField("workEthic", event.target.value as GrowOpsStaff["workEthic"])}>
                {["LOW", "STEADY", "HIGH", "EXCELLENT"].map((ethic) => <option value={ethic} key={ethic}>{ethic}</option>)}
              </select>
            </label>
            <label>REPORTS TO<input value={draft.reportTarget} onChange={(event) => setField("reportTarget", event.target.value)} maxLength={28} /></label>
            {isCreating ? (
              <label className="grow-ops-wide">DUTY SLOT
                <select value={dutyId} onChange={(event) => setDutyId(event.target.value)}>
                  <option value="">NEW FLOATING ROUTE</option>
                  {vacantDuties.map((duty) => <option value={duty.id} key={duty.id}>{duty.staff.title} / {duty.staff.department}</option>)}
                </select>
              </label>
            ) : null}
            <label>HAT COLOR<input type="color" value={draft.hatColor} onChange={(event) => setField("hatColor", event.target.value)} /></label>
            <label>SHOE COLOR<input type="color" value={draft.shoeColor} onChange={(event) => setField("shoeColor", event.target.value)} /></label>
            <label className="grow-ops-wide">CURRENT ACTION<input value={draft.currentAction} onChange={(event) => setField("currentAction", event.target.value)} maxLength={54} /></label>
            <label className="grow-ops-wide">PERSONALITY<input value={draft.personality} onChange={(event) => setField("personality", event.target.value)} maxLength={72} /></label>
          </div>
          <div className="grow-ops-schedule">
            <strong>SCHEDULE <em>FACILITY CLOCK {clockText}</em></strong>
            <div className="grow-ops-grid">
              <label>SHIFT START<input type="time" value={gen2FormatClock(schedule.shiftStart)} onChange={(event) => setSchedule({ ...schedule, shiftStart: gen2ParseClock(event.target.value, schedule.shiftStart) })} /></label>
              <label>SHIFT END<input type="time" value={gen2FormatClock(schedule.shiftEnd)} onChange={(event) => setSchedule({ ...schedule, shiftEnd: gen2ParseClock(event.target.value, schedule.shiftEnd) })} /></label>
              {schedule.breaks.map((slot) => (
                <div className="grow-ops-break-slot" key={slot.id}>
                  <span>{slot.label}</span>
                  <label>START<input type="time" value={gen2FormatClock(slot.start)} onChange={(event) => setSchedule({ ...schedule, breaks: schedule.breaks.map((item) => item.id === slot.id ? { ...item, start: gen2ParseClock(event.target.value, item.start) } : item) })} /></label>
                  <label>MIN<input type="number" min={0} max={90} value={slot.length} onChange={(event) => setSchedule({ ...schedule, breaks: schedule.breaks.map((item) => item.id === slot.id ? { ...item, length: Math.max(0, Math.min(90, Number(event.target.value) || 0)) } : item) })} /></label>
                </div>
              ))}
            </div>
            <span className="grow-ops-schedule-note">SHIFT 00:00-00:00 = ALL DAY. BREAKS WAIT UP TO 12 MIN IF THE BREAK ROOM IS FULL (MAX 3).</span>
          </div>
          <PersonaEditor staffId={selectedId} staffName={draft.name} staffTitle={draft.title} isNew={isCreating} drafts={personaDrafts.current} revision={personaRevision} />
          <div className="grow-ops-actions">
            <button type="submit" disabled={isApplyingStaff}>SAVE</button>
            <button type="button" onClick={applyStaffSnapshot} disabled={isApplyingStaff}>APPLY STAFF SNAPSHOT</button>
            <button type="button" onClick={undoStaffSnapshot} disabled={isApplyingStaff || staffHistoryCount < 1}>UNDO STAFF SNAPSHOT</button>
            <button type="button" onClick={() => isCreating ? beginHire() : loadExisting(selectedId)} disabled={isApplyingStaff}>RESET DRAFT</button>
            {!isCreating && !REQUIRED_STAFF_IDS.has(selectedId) ? <button type="button" className="grow-ops-remove" onClick={() => onRemove(selectedId)} disabled={isApplyingStaff}>REMOVE SPRITE</button> : null}
          </div>
        </form>
      </div>
      ) : (
        <FacilityEditorPanel />
      )}
    </div>
  );
}

function StaffRoutePreview({ npc, staff, onPreview, onClear }: { npc: LiveNpc; staff: GrowOpsStaff; onPreview: () => void; onClear: () => void }) {
  const routeRooms = npc.route.map((step) => roomAt(step.x, step.y)?.label ?? `X${step.x} Y${step.y}`);
  return (
    <div className="staff-route-preview">
      <div>
        <strong>ROUTE / CARGO PREVIEW</strong>
        <span>{staff.name} starts X{npc.x} Y{npc.y} facing {npc.dir.toUpperCase()}.</span>
        <span>CARGO: {npc.cargo ? npc.cargo.toUpperCase() : "NONE"} / CARRY FLAG: {npc.carry ? "ON" : "OFF"}</span>
      </div>
      <ol>
        {npc.route.slice(0, 6).map((step, index) => <li key={`${npc.id}-route-${index}`}>{index + 1}. {routeRooms[index]} — X{step.x} Y{step.y}{step.face ? ` / FACE ${step.face.toUpperCase()}` : ""}</li>)}
      </ol>
      <div className="staff-route-actions">
        <button type="button" onClick={onPreview}>TEST ROUTE VIEW</button>
        <button type="button" onClick={onClear}>CLEAR ROUTE VIEW</button>
      </div>
    </div>
  );
}

function FacilityEditorPanel() {
  const [drafts, setDrafts] = useState<Record<string, FacilityRoomDraft>>(() => loadFacilityRoomDrafts());
  const [selectedRoomId, setSelectedRoomId] = useState("screen");
  const [layoutSnapshot, setLayoutSnapshot] = useState<FacilityLayoutSnapshot | null>(null);
  const [layoutHistory, setLayoutHistory] = useState<FacilityLayoutSnapshot[]>([]);
  const [layoutHistoryCount, setLayoutHistoryCount] = useState(0);
  const [layoutStatus, setLayoutStatus] = useState("Backend snapshots not loaded yet.");
  const [layoutImportText, setLayoutImportText] = useState("");
  const [isApplyingLayout, setIsApplyingLayout] = useState(false);
  const selectedRoom = gen2Rooms.find((room) => room.id === selectedRoomId) ?? gen2Rooms[0];
  const roomProps = gen2Props.filter((prop) => prop.room === selectedRoom.id);
  const draft = drafts[selectedRoom.id] ?? roomToFacilityDraft(selectedRoom);

  useEffect(() => {
    let active = true;
    getFacilityLayoutSnapshot()
      .then((state) => {
        if (!active) return;
        setLayoutSnapshot(state.current);
        setLayoutHistory(state.history);
        setLayoutHistoryCount(state.history.length);
        if (state.current) setLayoutStatus(`Backend snapshot ${state.current.id} loaded (${state.history.length} undo point${state.history.length === 1 ? "" : "s"}).`);
        else setLayoutStatus("No backend snapshot yet. Apply will create the first restore point.");
      })
      .catch((error) => {
        if (active) setLayoutStatus(`Backend snapshot load failed: ${error instanceof Error ? error.message : String(error)}`);
      });
    return () => { active = false; };
  }, []);

  function setDraftField<K extends keyof FacilityRoomDraft>(key: K, value: FacilityRoomDraft[K]) {
    setDrafts((current) => ({ ...current, [selectedRoom.id]: { ...(current[selectedRoom.id] ?? roomToFacilityDraft(selectedRoom)), [key]: value } }));
  }

  function saveDraft() {
    const next = { ...drafts, [selectedRoom.id]: cleanFacilityRoomDraft(draft) };
    setDrafts(next);
    persistFacilityRoomDrafts(next);
    setLayoutStatus(`Local draft saved for ${selectedRoom.label}.`);
  }

  async function applyDraft() {
    const next = { ...drafts, [selectedRoom.id]: cleanFacilityRoomDraft(draft) };
    setDrafts(next);
    persistFacilityRoomDrafts(next);
    setIsApplyingLayout(true);
    setLayoutStatus("Validating and saving backend layout snapshot...");
    try {
      const state = await applyFacilityLayoutSnapshot({
        rooms: buildFacilityLayoutRooms(next),
        drafts: next,
        note: next[selectedRoom.id]?.notes || `Facility editor apply: ${selectedRoom.label}`,
      });
      setLayoutSnapshot(state.current);
      setLayoutHistory(state.history);
      setLayoutHistoryCount(state.history.length);
      const warningCount = state.current?.validation.warnings.length ?? 0;
      setLayoutStatus(`Applied backend snapshot ${state.current?.id ?? "unknown"}. Undo points: ${state.history.length}. Warnings: ${warningCount}.`);
    } catch (error) {
      setLayoutStatus(`Apply failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsApplyingLayout(false);
    }
  }

  async function undoSnapshot() {
    setIsApplyingLayout(true);
    setLayoutStatus("Restoring previous backend layout snapshot...");
    try {
      const state = await undoFacilityLayoutSnapshot();
      setLayoutSnapshot(state.current);
      setLayoutHistory(state.history);
      setLayoutHistoryCount(state.history.length);
      const restoredDrafts = facilityDraftsFromSnapshot(state.current);
      setDrafts(restoredDrafts);
      persistFacilityRoomDrafts(restoredDrafts);
      setLayoutStatus(`Restored ${state.current?.id ?? "previous snapshot"}. Undo points left: ${state.history.length}.`);
    } catch (error) {
      setLayoutStatus(`Undo failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsApplyingLayout(false);
    }
  }

  function exportLayout() {
    const payload = {
      exportedAt: new Date().toISOString(),
      source: "NeuroLab Facility Editor",
      current: layoutSnapshot,
      draftRooms: buildFacilityLayoutRooms(drafts),
      drafts,
    };
    const content = JSON.stringify(payload, null, 2);
    if (typeof window !== "undefined" && typeof Blob !== "undefined") {
      const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `neurolab-facility-layout-${Date.now()}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    }
    setLayoutImportText(content);
    setLayoutStatus("Exported layout JSON and copied it into the import/export buffer.");
  }

  function importLayoutDraft() {
    try {
      const parsed = JSON.parse(layoutImportText) as Record<string, unknown>;
      const importedDrafts = facilityDraftsFromImport(parsed);
      if (!Object.keys(importedDrafts).length) throw new Error("No rooms or drafts found in JSON.");
      setDrafts(importedDrafts);
      persistFacilityRoomDrafts(importedDrafts);
      const firstImportedId = Object.keys(importedDrafts)[0];
      if (firstImportedId) setSelectedRoomId(firstImportedId);
      setLayoutStatus(`Imported ${Object.keys(importedDrafts).length} room drafts. Review, then APPLY SNAPSHOT to persist backend state.`);
    } catch (error) {
      setLayoutStatus(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function loadSnapshotIntoDrafts(snapshot: FacilityLayoutSnapshot) {
    const restoredDrafts = facilityDraftsFromSnapshot(snapshot);
    setDrafts(restoredDrafts);
    persistFacilityRoomDrafts(restoredDrafts);
    setLayoutStatus(`Loaded ${snapshot.id} into local drafts. Use APPLY SNAPSHOT if you want it current again.`);
  }

  function resetDraft() {
    setDrafts((current) => {
      const next = { ...current };
      delete next[selectedRoom.id];
      persistFacilityRoomDrafts(next);
      return next;
    });
    setLayoutStatus(`Local draft reset for ${selectedRoom.label}. Backend snapshot unchanged.`);
  }

  return (
    <div className="grow-ops-facility">
      <aside className="facility-room-list">
        {gen2Rooms.map((room) => (
          <button type="button" key={room.id} className={selectedRoom.id === room.id ? "is-active" : ""} onClick={() => setSelectedRoomId(room.id)}>
            <b>{(drafts[room.id]?.label ?? room.label)}</b>
            <em>{room.id} / {room.kind}</em>
          </button>
        ))}
      </aside>
      <section className="facility-editor-form">
        <div className="facility-editor-preview">
          <div className={`facility-mini-room gen2-floor-${floorFor(selectedRoom)}`}>
            <span>{draft.label}</span>
            {roomProps.slice(0, 8).map((prop, index) => (
              <i key={`${prop.kind}-${index}`} className={`facility-mini-prop prop-${prop.kind}`} style={{ left: `${Math.max(4, Math.min(88, ((prop.x - selectedRoom.x) / selectedRoom.w) * 92))}%`, top: `${Math.max(20, Math.min(82, ((prop.y - selectedRoom.y) / selectedRoom.h) * 78 + 12))}%` }} />
            ))}
          </div>
          <div>
            <strong>ROOM EDITOR</strong>
            <span>Draft room/facility edits here before applying them to the live map data.</span>
            <em>Props detected: {roomProps.length}. Doors: {selectedRoom.doors.length}.</em>
          </div>
        </div>
        <div className="grow-ops-grid facility-grid">
          <label>ROOM<select value={selectedRoom.id} onChange={(event) => setSelectedRoomId(event.target.value)}>{gen2Rooms.map((room) => <option value={room.id} key={room.id}>{room.label}</option>)}</select></label>
          <label>LABEL<input value={draft.label} onChange={(event) => setDraftField("label", event.target.value)} maxLength={34} /></label>
          <label>KIND<input value={draft.kind} onChange={(event) => setDraftField("kind", event.target.value)} maxLength={24} /></label>
          <label>X<input type="number" value={draft.x} onChange={(event) => setDraftField("x", Number(event.target.value))} /></label>
          <label>Y<input type="number" value={draft.y} onChange={(event) => setDraftField("y", Number(event.target.value))} /></label>
          <label>WIDTH<input type="number" min={4} value={draft.w} onChange={(event) => setDraftField("w", Number(event.target.value))} /></label>
          <label>HEIGHT<input type="number" min={4} value={draft.h} onChange={(event) => setDraftField("h", Number(event.target.value))} /></label>
          <label className="grow-ops-wide">NOTES<input value={draft.notes} onChange={(event) => setDraftField("notes", event.target.value)} maxLength={90} placeholder="ROOM CHANGE NOTES..." /></label>
        </div>
        <div className="facility-editor-summary">
          <span>LIVE MAP: {selectedRoom.w}x{selectedRoom.h} @ X{selectedRoom.x} Y{selectedRoom.y}</span>
          <span>DRAFT: {draft.w}x{draft.h} @ X{draft.x} Y{draft.y}</span>
          <span>SNAPSHOT: {layoutSnapshot ? `${layoutSnapshot.id} @ ${new Date(layoutSnapshot.savedAt).toLocaleTimeString()}` : "none yet"}</span>
          <span>UNDO POINTS: {layoutHistoryCount}</span>
          <span>{layoutStatus}</span>
        </div>
        <div className="facility-validation-panel">
          <strong>VALIDATION</strong>
          {layoutSnapshot?.validation.failures.length ? layoutSnapshot.validation.failures.slice(0, 4).map((failure) => <span className="facility-validation-fail" key={failure}>FAIL: {failure}</span>) : <span className="facility-validation-pass">No backend validation failures on current snapshot.</span>}
          {layoutSnapshot?.validation.warnings.slice(0, 5).map((warning) => <span key={warning}>WARN: {warning}</span>)}
        </div>
        <div className="facility-history-panel">
          <strong>SNAPSHOT HISTORY</strong>
          {layoutHistory.length ? layoutHistory.slice(0, 4).map((snapshot) => (
            <button type="button" key={snapshot.id} onClick={() => loadSnapshotIntoDrafts(snapshot)}>
              <b>{snapshot.id}</b>
              <span>{snapshot.note || "Facility snapshot"}</span>
            </button>
          )) : <span>No restore points yet. Apply twice to create undo history.</span>}
        </div>
        <div className="facility-import-export">
          <label>IMPORT / EXPORT JSON<textarea value={layoutImportText} onChange={(event) => setLayoutImportText(event.target.value)} placeholder="Paste a NeuroLab facility layout export here, or click EXPORT JSON to fill this buffer." /></label>
        </div>
        <div className="grow-ops-actions facility-actions">
          <button type="button" onClick={saveDraft} disabled={isApplyingLayout}>SAVE ROOM DRAFT</button>
          <button type="button" onClick={applyDraft} disabled={isApplyingLayout}>APPLY SNAPSHOT</button>
          <button type="button" onClick={undoSnapshot} disabled={isApplyingLayout || layoutHistoryCount < 1}>UNDO SNAPSHOT</button>
          <button type="button" onClick={exportLayout} disabled={isApplyingLayout}>EXPORT JSON</button>
          <button type="button" onClick={importLayoutDraft} disabled={isApplyingLayout || !layoutImportText.trim()}>IMPORT DRAFT</button>
          <button type="button" onClick={resetDraft} disabled={isApplyingLayout}>RESET ROOM</button>
        </div>
      </section>
    </div>
  );
}

function RoomDetail({
  room,
  npcs,
  staff,
  roomVitals,
  activityState,
  productionPhase,
  incidentPhase,
  incidentTargetRoom,
  selectedNpcId,
  onBack,
  onGrowOps,
  onFacilityEditor,
  onSelect,
  onStaffOpen,
  onTalk,
  onStaffEdit,
  onContextMenu,
  onTerminalOpen,
  highlightedRouteId,
}: {
  room: Gen2Room;
  npcs: LiveNpc[];
  staff: Record<string, GrowOpsStaff>;
  roomVitals: RoomVitals;
  activityState: ActivityState;
  productionPhase: number;
  incidentPhase: number;
  incidentTargetRoom: "rd1" | "rd2";
  selectedNpcId?: string;
  onBack: () => void;
  onGrowOps: () => void;
  onFacilityEditor: () => void;
  onSelect: (selection: Selection) => void;
  onStaffOpen: (npc: LiveNpc) => void;
  onTalk: (npc: LiveNpc) => void;
  onStaffEdit: (npc: LiveNpc) => void;
  onContextMenu: (event: React.MouseEvent, menu: Omit<ContextMenuState, "x" | "y">) => void;
  onTerminalOpen: (prop: Gen2Prop) => void;
  highlightedRouteId?: string;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageSize, setStageSize] = useState({ width: 920, height: 520 });
  const roomProps = gen2Props.filter((prop) => prop.x >= room.x && prop.x < room.x + room.w && prop.y >= room.y && prop.y < room.y + room.h);
  const roomNpcs = npcs.filter((npc) => npc.x >= room.x && npc.x < room.x + room.w && npc.y >= room.y && npc.y < room.y + room.h);
  const roomWidth = room.w * GEN2_TILE;
  const roomHeight = room.h * GEN2_TILE;
  const scale = Math.max(1, Math.min(3.1, (stageSize.width - 48) / roomWidth, (stageSize.height - 48) / roomHeight));
  const roomLeft = (stageSize.width - roomWidth * scale) / 2;
  const roomTop = (stageSize.height - roomHeight * scale) / 2;

  useLayoutEffect(() => {
    function measureStage() {
      const stage = stageRef.current?.getBoundingClientRect();
      if (!stage) return;
      setStageSize({ width: stage.width, height: stage.height });
    }
    measureStage();
    window.addEventListener("resize", measureStage);
    return () => window.removeEventListener("resize", measureStage);
  }, [room.id]);

  return (
    <div className="gen2-detail">
      <div className="gen2-detail-header">
        <div>
          <strong>{room.label}</strong>
          <span>{room.kind.toUpperCase()} DETAIL</span>
        </div>
        <button type="button" className="gb-view-button is-active" onClick={onBack}>
          Return View
        </button>
        {room.id === "screen" ? <button type="button" className="gb-view-button" onClick={onGrowOps}>Grow Ops</button> : null}
      </div>
      <div ref={stageRef} className="gen2-detail-stage">
        <div className={`gen2-detail-room gen2-floor-${floorFor(room)} room-kind-${room.kind} ${roomOfflineClass(room, roomVitals)}`} style={{ left: roomLeft, top: roomTop, width: roomWidth, height: roomHeight, transform: `scale(${scale})` }}>
          <RoomFrame room={room} roomVitals={roomVitals} activityState={activityState} />
          {roomProps.map((prop, index) => (
            <PropView key={`${room.id}-${prop.kind}-${index}`} prop={{ ...prop, x: prop.x - room.x, y: prop.y - room.y }} originalProp={prop} roomVitals={roomVitals} productionPhase={productionPhase} incidentPhase={incidentPhase} incidentTargetRoom={incidentTargetRoom} onSelect={onSelect} onContextMenu={onContextMenu} onTerminalOpen={onTerminalOpen} onFacilityEditor={onFacilityEditor} detail />
          ))}
          {roomNpcs.map((npc) => (
            <NpcView key={`${room.id}-${npc.id}`} npc={{ ...npc, x: npc.x - room.x, y: npc.y - room.y }} originalNpc={npc} staff={staff[npc.id]} incidentPhase={incidentPhase} incidentTargetRoom={incidentTargetRoom} selected={selectedNpcId === npc.id} onSelect={onSelect} onStaffOpen={onStaffOpen} onTalk={onTalk} onStaffEdit={onStaffEdit} onContextMenu={onContextMenu} detail />
          ))}
          <LifeBubbles room={room} />
          <RoutePathOverlay npc={roomNpcs.find((item) => item.id === highlightedRouteId)} origin={{ x: room.x, y: room.y }} />
        </div>
      </div>
    </div>
  );
}

/** Short-lived speech bubbles pinned to a spot on the floor (mother retired / promoted). */
function LifeBubbles({ room }: { room?: Gen2Room }) {
  const { bubbles } = useContext(LifeContext);
  const now = Date.now();
  return (
    <>
      {bubbles.filter((bubble) => bubble.until > now && (!room || bubble.room === room.id)).map((bubble) => (
        <span key={bubble.id} className="gen2-bubble life-bubble" style={{ left: (bubble.x - (room?.x ?? 0)) * GEN2_TILE + 8, top: (bubble.y - (room?.y ?? 0)) * GEN2_TILE - 14 }}>
          {bubble.text}
        </span>
      ))}
    </>
  );
}

function HallView({ hall }: { hall: { x: number; y: number; w: number; h: number } }) {
  return (
    <div className="gen2-hall-wrap" style={rect(hall)}>
      <div className="gen2-hall gen2-floor-lab" />
    </div>
  );
}

function RoomView({
  room,
  roomVitals,
  activityState,
  onOpen,
  onGrowOps,
  onFacilityEditor,
  onLifecycle,
  onSelect,
  onContextMenu,
}: {
  room: Gen2Room;
  roomVitals: RoomVitals;
  activityState: ActivityState;
  onOpen: (room: Gen2Room) => void;
  onGrowOps: () => void;
  onFacilityEditor: () => void;
  onLifecycle: () => void;
  onSelect: (selection: Selection) => void;
  onContextMenu: (event: React.MouseEvent, menu: Omit<ContextMenuState, "x" | "y">) => void;
}) {
  return (
    <div
      className={`gen2-room gen2-floor-${floorFor(room)} room-kind-${room.kind} ${roomOfflineClass(room, roomVitals)}`}
      style={rect(room)}
      onClick={() => onSelect(roomSelection(room, roomVitals))}
      onContextMenu={(event) =>
        onContextMenu(event, {
          title: room.label,
          items: [
            { label: "Zoom room", action: () => onOpen(room) },
            { label: "Room stats", action: () => onSelect(roomSelection(room, roomVitals)) },
            { label: "Lifecycle", action: onLifecycle },
            ...(room.id === "screen" ? [{ label: "Grow Ops", action: onGrowOps }] : []),
            { label: "Flag cleaning", action: () => onSelect(actionSelection("ROOM ACTION", [`${room.label}`, "CLEANING FLAG SET", "PRIORITY: NORMAL"])) },
            { label: "Send staff", action: () => onSelect(actionSelection("DISPATCH", [`TARGET: ${room.label}`, "AVAILABLE STAFF: AUTO", "STATUS: QUEUED"])) },
          ],
        })
      }
    >
      <RoomFrame room={room} roomVitals={roomVitals} activityState={activityState} />
    </div>
  );
}

function RoomFrame({ room, roomVitals, activityState }: { room: Gen2Room; roomVitals: RoomVitals; activityState?: ActivityState }) {
  const vitals = roomVitals[room.id];
  const activityBadge = activityState ? activityBadgeForRoom(room.id, activityState) : undefined;
  const washPhase = vitals?.lifePhase && ["sterilizing", "cleaning", "sterile"].includes(vitals.lifePhase) ? vitals.lifePhase : undefined;
  return (
    <>
      <div className="gen2-label">{room.label}</div>
      {activityBadge ? <div className={`activity-room-badge tone-${activityBadge.tone}`}>{activityBadge.label}</div> : null}
      {washPhase ? (
        <div className={`life-wash is-${washPhase}`} aria-hidden="true">
          <i style={{ left: "12%", top: "22%" }} />
          <i style={{ left: "46%", top: "58%", animationDelay: "-0.5s" }} />
          <i style={{ left: "78%", top: "30%", animationDelay: "-0.9s" }} />
          <i style={{ left: "28%", top: "74%", animationDelay: "-0.2s" }} />
          <b />
          <b />
        </div>
      ) : null}
      {vitals ? (
        <div className={`gen2-room-vitals vitals-${vitals.status.toLowerCase()} ${vitals.lifePrimary ? "has-life" : ""}`}>
          {vitals.lifePrimary ? (
            <>
              <strong>{vitals.lifePrimary}</strong>
              <span>{vitals.lifeSecondary}</span>
              <span className="vital-device">{vitals.primary} {vitals.secondary}</span>
            </>
          ) : (
            <>
              <strong>{vitals.primary}</strong>
              <span>{vitals.secondary}</span>
            </>
          )}
        </div>
      ) : null}
      {room.doors.map((door, index) => (
        <div key={`${room.id}-door-${index}`} className={`gen2-door gen2-door-${door.side}`} style={doorStyle(room, door)} />
      ))}
      <div className="gen2-wall-top" />
      <div className="gen2-wall-left" />
      <div className="gen2-wall-right" />
      <div className="gen2-wall-bottom" />
    </>
  );
}

function PropView({
  prop,
  originalProp,
  roomVitals,
  productionPhase,
  incidentPhase,
  incidentTargetRoom,
  onSelect,
  onContextMenu,
  onTerminalOpen,
  onFacilityEditor,
  detail = false,
}: {
  prop: Gen2Prop;
  originalProp?: Gen2Prop;
  roomVitals: RoomVitals;
  productionPhase: number;
  incidentPhase: number;
  incidentTargetRoom: "rd1" | "rd2";
  onSelect: (selection: Selection) => void;
  onContextMenu: (event: React.MouseEvent, menu: Omit<ContextMenuState, "x" | "y">) => void;
  onTerminalOpen: (prop: Gen2Prop) => void;
  onFacilityEditor?: () => void;
  detail?: boolean;
}) {
  const w = (prop.w ?? 1) * GEN2_TILE;
  const h = (prop.h ?? 1) * GEN2_TILE;
  const source = originalProp ?? prop;
  const { life } = useContext(LifeContext);
  const lifeProp = lifePropState(source, life, Date.now());
  const selectionFor = (): Selection => (lifeProp?.selection ? lifeSelectionToSelection(lifeProp.selection) : propSelection(source, roomVitals));
  const environment = lifeProp?.ownsLook ? "" : environmentClass(source, roomVitals, incidentPhase, incidentTargetRoom);
  const stressed = !lifeProp?.ownsLook && isStressedPlant(source, roomVitals);
  const production = lifeProp?.ownsProduction || lifeProp?.ownsLook ? "" : productionClass(source, productionPhase, incidentPhase, incidentTargetRoom);

  return (
    <button
      type="button"
      data-label={prop.label}
      data-tag={lifeProp?.tag}
      className={`gen2-prop prop-${prop.kind} ${prop.variant ? `variant-${prop.variant}` : ""} ${spriteClass(source, lifeProp?.stage)} ${stressed ? "is-stressed-plant" : ""} ${environment} ${production} ${lifeProp?.classes ?? ""} ${detail ? "is-detail-prop" : ""}`}
      style={{ left: prop.x * GEN2_TILE, top: prop.y * GEN2_TILE, width: w, height: h, ...(lifeProp?.style as CSSProperties | undefined) }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(selectionFor());
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        if (source.kind === "terminal" && source.room === "rd2") onTerminalOpen(source);
        if (source.kind === "crate" || source.kind === "shelf") onSelect(selectionFor());
      }}
      onContextMenu={(event) =>
        onContextMenu(event, {
          title: source.kind.toUpperCase(),
          items: [
            { label: "Inspect stats", action: () => onSelect(selectionFor()) },
            ...(source.kind === "terminal" && source.room === "rd2" ? [{ label: "Open model chat", action: () => onTerminalOpen(source) }] : []),
            ...(source.kind === "crate" || source.kind === "shelf" ? [{ label: "Open logs", action: () => onSelect(selectionFor()) }] : []),
            ...(source.kind === "desk" && source.room === "screen" && onFacilityEditor ? [{ label: "Room editor", action: onFacilityEditor }] : []),
            { label: "Maintenance", action: () => onSelect(actionSelection("MAINTENANCE", [`TARGET: ${source.kind.toUpperCase()}`, "STATUS: CHECK REQUESTED", "RISK: LOW"])) },
            { label: isPlant(source) ? "Check plant" : "Power cycle", action: () => onSelect(selectionFor()) },
          ],
        })
      }
    />
  );
}

function NpcView({
  npc,
  originalNpc,
  staff,
  incidentPhase,
  incidentTargetRoom,
  selected = false,
  onSelect,
  onStaffOpen,
  onTalk,
  onStaffEdit,
  onContextMenu,
  detail = false,
}: {
  npc: LiveNpc;
  originalNpc?: LiveNpc;
  staff?: GrowOpsStaff;
  incidentPhase: number;
  incidentTargetRoom: "rd1" | "rd2";
  selected?: boolean;
  onSelect: (selection: Selection) => void;
  onStaffOpen: (npc: LiveNpc) => void;
  onTalk: (npc: LiveNpc) => void;
  onStaffEdit: (npc: LiveNpc) => void;
  onContextMenu: (event: React.MouseEvent, menu: Omit<ContextMenuState, "x" | "y">) => void;
  detail?: boolean;
}) {
  const source = originalNpc ?? npc;
  const cargo = visibleCargo(source, incidentPhase);
  const chat = source.sim?.chat;
  const errand = source.sim?.errand;
  const seated = !!errand && errand.stage === "use" && !!errand.seat;
  const task = source.sim?.task;
  const taskStop = task?.stops[task.idx];
  const working = !!task && !errand && task.stage === "use" && !!taskStop;
  const moment = activeMoment(source.id);
  const bubbleText = moment?.text
    ?? incidentBubble(source, incidentPhase, incidentTargetRoom)
    ?? chat?.say
    ?? (working ? taskStop?.say : undefined)
    ?? (errand?.stage === "use" ? ERRAND_TAGS[errand.kind] : undefined)
    ?? (npc.pause > 0 ? moodBubble(source, staff) : "");

  return (
    <button
      type="button"
      aria-label={staff?.name ?? source.id}
      className={`gen2-npc-wrap ${selected ? "is-selected-staff" : ""} ${detail ? "is-detail-npc" : ""}`}
      style={{ left: npc.x * GEN2_TILE + 1, top: npc.y * GEN2_TILE - 8 }}
      onClick={(event) => {
        event.stopPropagation();
        onStaffOpen(source);
      }}
      onContextMenu={(event) =>
        onContextMenu(event, {
          title: source.id.replace(/([A-Z])/g, " $1").toUpperCase(),
          items: [
            { label: "Talk", action: () => onTalk(source) },
            { label: "Staff stats", action: () => onSelect(staffSelection(source, staff)) },
            { label: "Edit character", action: () => onStaffEdit(source) },
            { label: "Preview route", action: () => onStaffOpen(source) },
            { label: "Send message", action: () => onSelect(actionSelection("MESSAGE", [`TO: ${source.role.toUpperCase()}`, "TEXT: CHECK STATUS", "STATUS: SENT"])) },
            { label: "Assign route", action: () => onSelect(actionSelection("ROUTE ASSIGN", [`STAFF: ${source.id.toUpperCase()}`, "MODE: ROOM TO ROOM", "STATUS: READY"])) },
          ],
        })
      }
    >
      {selected ? <span className="gen2-route-marker" /> : null}
      {moment?.mark ? <span className="life-mark" aria-hidden="true">!</span> : null}
      {bubbleText ? <span className={`gen2-bubble ${moment ? `life-moment tone-${moment.tone ?? "cheer"}` : chat ? `is-chat chat-${chat.side} ${chat.script ? "is-banter" : ""}` : ""}`}>{bubbleText}</span> : null}
      <span className={`gen2-npc role-${source.role} face-${npc.dir} step-${npc.stepFrame} activity-${working ? "busy" : npcActivity(source)} ${seated ? "is-seated" : ""}`} style={staffStyle(staff)} />
      {cargo ? <span className={`npc-cargo cargo-${cargo}`} /> : null}
      {working && taskStop?.act ? <span className={`npc-fx ${taskStop.act === "spray" ? "fx-spray" : taskStop.act === "mop" ? "fx-mop" : "fx-work"}`} /> : null}
    </button>
  );
}

function ContextMenu({ menu, onClose }: { menu: ContextMenuState; onClose: () => void }) {
  return (
    <div className="gen2-context-menu" style={{ left: menu.x, top: menu.y }} onClick={(event) => event.stopPropagation()}>
      <strong>{menu.title}</strong>
      {menu.items.map((item) => (
        <button
          type="button"
          key={item.label}
          onClick={() => {
            item.action();
            onClose();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function TerminalPanel({ session, onClose }: { session: TerminalSession; onClose: () => void }) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<TerminalMessage[]>(() => [
    ...session.lines.map((line) => ({ speaker: "system" as const, text: line })),
    { speaker: "system" as const, text: `MODEL ${session.model} READY FOR PROMPT.` },
  ]);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    setDraft("");
    setMessages([
      ...session.lines.map((line) => ({ speaker: "system" as const, text: line })),
      { speaker: "system" as const, text: `MODEL ${session.model} READY FOR PROMPT.` },
    ]);
  }, [session]);

  async function submitPrompt(event: React.FormEvent) {
    event.preventDefault();
    const prompt = draft.trim();
    if (!prompt || isSending) return;
    setDraft("");
    setIsSending(true);
    setMessages((current) => [...current, { speaker: "user", text: prompt }, { speaker: "system", text: "CONTACTING OLLAMA..." }]);
    try {
      const data = await chatWithOllama({ model: session.model, message: prompt });
      const text = data.response || "MODEL RETURNED AN EMPTY RESPONSE.";
      setMessages((current) => [...current.filter((message) => message.text !== "CONTACTING OLLAMA..."), { speaker: "model", text }]);
    } catch {
      setMessages((current) => [
        ...current.filter((message) => message.text !== "CONTACTING OLLAMA..."),
        { speaker: "model", text: `LOCAL CHAT SHELL ACTIVE. START BACKEND AND OLLAMA TO REACH ${session.model.toUpperCase()}.` },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="gen2-terminal-panel" onClick={(event) => event.stopPropagation()}>
      <div className="gen2-terminal-title">
        <strong>{session.title}</strong>
        <button type="button" onClick={onClose}>X</button>
      </div>
      <div className="gen2-terminal-body">
        <span>MODEL: {session.model}</span>
        {messages.map((message, index) => (
          <span key={`${message.speaker}-${index}`} className={`terminal-line terminal-${message.speaker}`}>
            {message.speaker === "user" ? "> " : message.speaker === "model" ? "< " : ""}
            {message.text}
          </span>
        ))}
        <form className="gen2-terminal-form" onSubmit={submitPrompt}>
          <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="ASK MODEL..." />
          <button type="submit" disabled={isSending}>{isSending ? "..." : "SEND"}</button>
        </form>
      </div>
    </div>
  );
}

function PokemonDialog({
  dialog,
  onChoose,
  onHover,
}: {
  dialog: PokemonDialogState;
  onChoose: (index: number) => void;
  onHover: (index: number) => void;
}) {
  return (
    <div className="pokemon-dialog" onClick={(event) => event.stopPropagation()}>
      <div className="pokemon-dialog-info">
        <strong>{dialog.title}</strong>
        <p>{dialog.message}</p>
        <span>{dialog.options[dialog.selectedIndex]?.detail}</span>
      </div>
      {dialog.spriteRole ? (
        <div className="pokemon-dialog-sprite" aria-hidden="true">
          <span className={`gen2-npc role-${dialog.spriteRole} face-down step-0`} />
        </div>
      ) : null}
      <div className="pokemon-dialog-menu" role="menu" aria-label={dialog.title}>
        {dialog.options.map((option, index) => (
          <button
            type="button"
            key={option.label}
            className={index === dialog.selectedIndex ? "is-selected" : ""}
            onMouseEnter={() => onHover(index)}
            onFocus={() => onHover(index)}
            onClick={() => onChoose(index)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function WorkerBattlePanel({
  npc,
  staff,
  mirror,
  onRouteView,
  onClose,
  docked = false,
}: {
  npc: LiveNpc;
  staff?: GrowOpsStaff;
  mirror?: SpriteDialogMirrorState;
  onRouteView?: () => void;
  onClose: () => void;
  docked?: boolean;
}) {
  const [panelMode, setPanelMode] = useState<"message" | "route" | "report">("message");
  const profile = staff ?? defaultGrowOpsStaff(npc);
  const displayName = profile.name.toUpperCase();
  const energy = workerMeter(npc, 78);
  const dialog = mirror && mirror.title === displayName ? mirror : spriteDialogFor(npc, profile, 0, "rd1");

  function showRoute() {
    setPanelMode("route");
    onRouteView?.();
  }

  return (
    <div className={`worker-battle-card ${docked ? "is-docked" : ""}`} onClick={(event) => event.stopPropagation()}>
      <div className="worker-battle-scene">
        <div className="worker-stat-block">
          <strong>{displayName}</strong>
          <span>{profile.title}</span>
          <span>{profile.sex} / AGE {profile.age}</span>
          <div className="worker-hp-row">
            <b>NRG</b>
            <progress className={progressClass(energy)} value={energy} max={100} />
            <em>{energy}/100</em>
          </div>
        </div>
        <div className="worker-scene-note" aria-hidden="true" />
        <div className="worker-enemy-sprite">
          <span className={`gen2-npc role-${npc.role} face-down step-${npc.stepFrame}`} style={staffStyle(profile)} />
        </div>
      </div>

      <div className="worker-dialog-box">
        <div className="worker-dialog-copy">
          <strong>{displayName} STATUS</strong>
          <span>{profile.currentAction}</span>
          <span>MOOD: {moodText(npc, profile)}</span>
          <span>WORK ETHIC: {profile.workEthic}</span>
          <span>ROUTE STOP: {npc.routeIndex + 1}/{npc.route.length}</span>
        </div>
        <div className="worker-sprite-dialog-panel">
          {panelMode === "message" ? (
            <>
              <strong>SPRITE DIALOG</strong>
              <span>“{dialog.line}”</span>
              <em>{dialog.detail}</em>
            </>
          ) : panelMode === "route" ? (
            <>
              <strong>JOB ROUTE</strong>
              {npc.route.map((step, index) => (
                <span key={`${npc.id}-route-${index}`} className={index === npc.routeIndex ? "is-current-route-stop" : ""}>
                  {index + 1}. X{step.x} Y{step.y}{step.face ? ` FACE ${step.face.toUpperCase()}` : ""}{step.pause ? ` HOLD ${step.pause}` : ""}
                </span>
              ))}
            </>
          ) : (
            <>
              <strong>REPORT LINE</strong>
              <span>REPORTS TO: {profile.reportTarget}</span>
              <span>DEPT: {profile.department}</span>
              <span>TRAIT: {profile.personality}</span>
              <em>{profile.evaluation}</em>
            </>
          )}
        </div>
        <div className="worker-battle-menu">
          <button type="button" onClick={() => setPanelMode("message")}>MESSAGE</button>
          <button type="button" onClick={showRoute}>ROUTE</button>
          <button type="button" onClick={() => setPanelMode("report")}>REPORT</button>
          <button type="button" onClick={onClose}>CLOSE</button>
        </div>
      </div>
    </div>
  );
}

function RoutePathOverlay({ npc, origin = { x: 0, y: 0 } }: { npc?: LiveNpc; origin?: { x: number; y: number } }) {
  if (!npc || npc.route.length === 0) return null;
  return (
    <div className="gen2-route-path-overlay" aria-hidden="true">
      {npc.route.map((step, index) => (
        <span
          key={`${npc.id}-path-${index}`}
          className={`gen2-route-stop ${index === npc.routeIndex ? "is-current" : ""}`}
          style={{ left: (step.x - origin.x) * GEN2_TILE + GEN2_TILE / 2, top: (step.y - origin.y) * GEN2_TILE + GEN2_TILE / 2 }}
        >
          {index + 1}
        </span>
      ))}
    </div>
  );
}

function WorkerMeter({ label, value }: { label: string; value: number }) {
  return (
    <label className="worker-meter">
      <span>{label}</span>
      <progress className={progressClass(value)} value={value} max={100} />
    </label>
  );
}

function SelectionCard({ selection }: { selection?: Selection }) {
  const text = selection ? selection.lines.join("\n") : "Select or right-click a room, staff member, plant, computer, or machine.";
  const typed = useTypewriter(text);

  if (!selection) {
    return (
      <div className="gen2-selection-card" tabIndex={0} onClick={typed.complete} onKeyDown={typed.onKeyDown}>
        <strong>NO TARGET</strong>
        {typed.visible.split("\n").map((line, index) => (
          <span key={`${line}-${index}`}>{line}</span>
        ))}
        {typed.isTyping ? <em className="type-cursor">▼</em> : null}
      </div>
    );
  }
  return (
    <div className={`gen2-selection-card card-${selection.type}`} tabIndex={0} onClick={typed.complete} onKeyDown={typed.onKeyDown}>
      <strong>{selection.title}</strong>
      {typed.visible.split("\n").map((line, index) => (
        <span key={`${line}-${index}`}>{line}</span>
      ))}
      {typed.isTyping ? <em className="type-cursor">▼</em> : null}
    </div>
  );
}

function useTypewriter(text: string) {
  const [visibleLength, setVisibleLength] = useState(text.length);

  useEffect(() => {
    setVisibleLength(0);
    const interval = window.setInterval(() => {
      setVisibleLength((current) => {
        if (current >= text.length) {
          window.clearInterval(interval);
          return current;
        }
        return current + 1;
      });
    }, 18);
    return () => window.clearInterval(interval);
  }, [text]);

  function complete() {
    setVisibleLength(text.length);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    complete();
  }

  return {
    visible: text.slice(0, visibleLength),
    isTyping: visibleLength < text.length,
    complete,
    onKeyDown,
  };
}

function workerMeter(npc: LiveNpc, base: number) {
  const idScore = npc.id.split("").reduce((total, letter) => total + letter.charCodeAt(0), 0);
  return Math.max(18, Math.min(100, base + (idScore % 19) - 9));
}

function progressClass(value: number) {
  if (value < 30) return "meter-low";
  if (value < 60) return "meter-mid";
  return "meter-good";
}

function loadGrowOpsStaff() {
  const defaults = Object.fromEntries(gen2Npcs.map((npc) => [npc.id, defaultGrowOpsStaff(npc)]));
  if (typeof window === "undefined") return defaults;
  try {
    const stored = JSON.parse(window.localStorage.getItem(STAFF_STORAGE_KEY) ?? "{}") as Record<string, GrowOpsStaff>;
    return Object.fromEntries(Object.entries({ ...defaults, ...stored }).map(([id, item]) => [id, cleanGrowOpsStaff({ ...item, id })]));
  } catch {
    return defaults;
  }
}

function persistGrowOpsStaff(staff: Record<string, GrowOpsStaff>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(staff));
}

function loadVacantDuties() {
  if (typeof window === "undefined") return [];
  try {
    const stored = JSON.parse(window.localStorage.getItem(DUTY_STORAGE_KEY) ?? "[]") as VacantDuty[];
    return Array.isArray(stored) ? stored.filter((duty) => duty?.id && isStoredLiveNpc(duty.npc)).map((duty) => ({ ...duty, staff: cleanGrowOpsStaff(duty.staff) })) : [];
  } catch {
    return [];
  }
}

function persistVacantDuties(duties: VacantDuty[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DUTY_STORAGE_KEY, JSON.stringify(duties));
}

function defaultGrowOpsStaff(npc: Gen2Npc): GrowOpsStaff {
  const profile = gen2WorkerProfiles[npc.id];
  const identity = gen2WorkerIdentity[npc.id];
  const color = roleColor(npc.role);
  return {
    id: npc.id,
    name: identity?.name ?? humanizeNpcId(npc.id),
    sex: identity?.sex ?? "N/A",
    age: identity?.age ?? 25,
    workEthic: identity?.workEthic ?? "STEADY",
    evaluation: identity?.evaluation ?? "Screened for facility duty.",
    department: profile?.department ?? humanizeNpcId(npc.role),
    title: profile?.title ?? `${humanizeNpcId(npc.role)} Worker`,
    role: npc.role,
    stationRoomId: profile?.stationRoomId ?? "screen",
    personality: profile?.personality ?? "Adjustable from Grow Ops.",
    currentAction: profile?.currentAction ?? "Reporting for floor duty",
    steadyMood: profile?.steadyMood ?? "READY",
    busyMood: profile?.busyMood ?? "WORKING",
    reportTarget: profile?.reportTarget ?? "Department Manager",
    breakPolicy: profile?.breakPolicy ?? "Breaks rotate around department coverage.",
    hatColor: color,
    shoeColor: color,
    custom: false,
    schedule: gen2DefaultSchedule(npc.id, profile?.department ?? humanizeNpcId(npc.role)),
  };
}

function newGrowOpsHire(id: string): GrowOpsStaff {
  return {
    ...defaultGrowOpsStaff({ id, role: "cultivation", x: 96, y: 34, dir: "left", route: [] }),
    name: "New Hire",
    title: "Grow Ops Technician",
    department: "Cultivation",
    stationRoomId: "screen",
    personality: "New to the floor and ready for assignment.",
    currentAction: "Walking in from screening",
    custom: true,
  };
}

function cleanGrowOpsStaff(staff: GrowOpsStaff): GrowOpsStaff {
  return {
    ...staff,
    name: staff.name.trim() || "New Hire",
    title: staff.title.trim() || `${humanizeNpcId(staff.role)} Worker`,
    department: staff.department.trim() || "Grow Ops",
    sex: staff.sex.trim() || "N/A",
    age: Math.max(18, Math.min(99, Number.isFinite(staff.age) ? staff.age : 25)),
    evaluation: staff.evaluation?.trim() || "Configured from Grow Ops.",
    personality: staff.personality.trim() || "Adjustable from Grow Ops.",
    currentAction: staff.currentAction.trim() || "Floor duty",
    steadyMood: staff.steadyMood?.trim() || "READY",
    busyMood: staff.busyMood?.trim() || "WORKING",
    reportTarget: staff.reportTarget.trim() || "Department Manager",
    breakPolicy: staff.breakPolicy?.trim() || "Breaks rotate around department coverage.",
    hatColor: normalizeHexColor(staff.hatColor, roleColor(staff.role)),
    shoeColor: normalizeHexColor(staff.shoeColor, normalizeHexColor(staff.hatColor, roleColor(staff.role))),
    schedule: gen2NormalizeSchedule(staff.schedule, staff.id, staff.department.trim() || "Grow Ops"),
  };
}

function createScreeningHire(staff: GrowOpsStaff, duty?: LiveNpc): LiveNpc {
  if (duty) {
    return {
      ...duty,
      id: staff.id,
      role: staff.role,
      x: 96,
      y: 34,
      dir: "left",
      routeIndex: 0,
      stepFrame: 0,
      pause: 2,
      sim: createSim(staff.id),
    };
  }
  return {
    id: staff.id,
    role: staff.role,
    x: 96,
    y: 34,
    dir: "left",
    routeIndex: 0,
    stepFrame: 0,
    pause: 2,
    sim: createSim(staff.id),
    route: [
      { x: 96, y: 34, face: "left", pause: 2 },
      { x: 92, y: 34, face: "left" },
      { x: 86, y: 33, face: "left" },
      { x: 83, y: 33, face: "left" },
      { x: 80, y: 40, face: "down", pause: 2 },
      { x: 63, y: 36, face: "down", pause: 4 },
      { x: 77, y: 32, face: "left", pause: 2 },
    ],
  };
}

function staffStyle(staff?: Pick<GrowOpsStaff, "hatColor" | "shoeColor">): CSSProperties | undefined {
  if (!staff) return undefined;
  return { "--hat-color": staff.hatColor, "--shoe-color": staff.shoeColor } as CSSProperties;
}

function roleColor(role: Gen2NpcRole) {
  if (role === "cultivation") return "#48b060";
  if (role === "processing") return "#d9483d";
  if (role === "security") return "#11151d";
  if (role === "logistics") return "#8a5a2b";
  if (role === "maintenance") return "#6f7f86";
  if (role === "boss") return "#f0ead6";
  return "#f4efe2";
}

function normalizeHexColor(value: string, fallback: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function humanizeNpcId(value: string) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

function loadPersistedNpcs(): LiveNpc[] {
  const walkable = buildWalkable();
  const initial = sanitizeNpcs(gen2Npcs.map((npc) => ({ ...npc, routeIndex: 0, stepFrame: 0 as const, pause: Math.floor(gen2Hash01(npc.id, "start") * 16), sim: createSim(npc.id) })), walkable);
  if (typeof window === "undefined") return initial;
  try {
    const stored = window.localStorage.getItem(NPC_STORAGE_KEY);
    if (!stored) return initial;
    const parsed = JSON.parse(stored) as { savedAt?: number; npcs?: LiveNpc[]; removedBaseIds?: string[] };
    if (!Array.isArray(parsed.npcs)) return initial;
    const removedBaseIds = new Set((parsed.removedBaseIds ?? []).filter((id) => !REQUIRED_STAFF_IDS.has(id)));
    const byId = new Map(parsed.npcs.map((npc) => [npc.id, npc]));
    let hydrated: LiveNpc[] = initial.filter((base) => !removedBaseIds.has(base.id)).map((base) => {
      const storedNpc = byId.get(base.id);
      if (!storedNpc) return base;
      const stepFrame: 0 | 1 | 2 = storedNpc.stepFrame === 1 || storedNpc.stepFrame === 2 ? storedNpc.stepFrame : 0;
      return {
        ...base,
        x: Number.isFinite(storedNpc.x) ? storedNpc.x : base.x,
        y: Number.isFinite(storedNpc.y) ? storedNpc.y : base.y,
        dir: storedNpc.dir ?? base.dir,
        routeIndex: Number.isFinite(storedNpc.routeIndex) ? storedNpc.routeIndex % base.route.length : 0,
        stepFrame,
        pause: Number.isFinite(storedNpc.pause) ? storedNpc.pause : 0,
        sim: coerceSim(storedNpc.sim, base.id),
      };
    });
    const custom: LiveNpc[] = parsed.npcs
      .filter((npc) => !gen2Npcs.some((base) => base.id === npc.id))
      .filter(isStoredLiveNpc)
      .map((npc) => {
        const stepFrame: 0 | 1 | 2 = npc.stepFrame === 1 || npc.stepFrame === 2 ? npc.stepFrame : 0;
        return {
          ...npc,
          routeIndex: npc.route.length ? Math.abs(npc.routeIndex) % npc.route.length : 0,
          stepFrame,
          pause: Number.isFinite(npc.pause) ? npc.pause : 0,
          sim: coerceSim(npc.sim, npc.id),
        };
      });
    hydrated = [...hydrated, ...custom];
    const elapsedTicks = parsed.savedAt ? Math.min(2000, Math.floor((Date.now() - parsed.savedAt) / MOVEMENT_TICK_MS)) : 0;
    hydrated = sanitizeNpcs(hydrated, walkable);
    const replayStart = Date.now() - elapsedTicks * MOVEMENT_TICK_MS;
    const replayContext = buildSimContext({}, 0, loadGrowOpsStaff());
    for (let index = 0; index < elapsedTicks; index += 1) hydrated = advanceAllNpcs(hydrated, walkable, replayContext, replayStart + index * MOVEMENT_TICK_MS);
    return sanitizeNpcs(hydrated, walkable);
  } catch {
    return initial;
  }
}

function isStoredLiveNpc(npc: LiveNpc) {
  return typeof npc.id === "string"
    && ["boss", "executive", "cultivation", "processing", "science", "security", "logistics", "secretary", "maintenance"].includes(npc.role)
    && Number.isFinite(npc.x)
    && Number.isFinite(npc.y)
    && Array.isArray(npc.route)
    && npc.route.length > 0;
}


function sanitizeNpcs(npcs: LiveNpc[], walkable: Set<string>) {
  return npcs.map((npc) => {
    const seated = !!npc.sim?.errand?.seat && npc.sim.errand.stage === "use" && npc.sim.errand.x === npc.x && npc.sim.errand.y === npc.y;
    const safePosition = (seated ? { x: npc.x, y: npc.y } : undefined) ?? nearestWalkableGoal({ x: npc.x, y: npc.y }, walkable, 18) ?? firstWalkableRouteTile(npc, walkable) ?? { x: npc.x, y: npc.y };
    const route = npc.route.map((step) => nearestWalkableGoal(step, walkable, 6) ? step : { ...step, ...(nearestWalkableGoal(step, walkable, 18) ?? { x: safePosition.x, y: safePosition.y }) });
    const routeIndex = route.length ? Math.abs(npc.routeIndex) % route.length : 0;
    return { ...npc, x: safePosition.x, y: safePosition.y, route, routeIndex };
  });
}

function firstWalkableRouteTile(npc: LiveNpc, walkable: Set<string>) {
  for (const step of npc.route) {
    const safe = nearestWalkableGoal(step, walkable, 18);
    if (safe) return safe;
  }
  return undefined;
}

function persistNpcs(npcs: LiveNpc[]) {
  if (typeof window === "undefined") return;
  const liveIds = new Set(npcs.map((npc) => npc.id));
  const removedBaseIds = gen2Npcs.filter((npc) => !liveIds.has(npc.id)).map((npc) => npc.id);
  const walkable = buildWalkable();
  window.localStorage.setItem(NPC_STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), npcs: sanitizeNpcs(npcs, walkable), removedBaseIds }));
}

const EMPTY_SIM_CONTEXT: NpcSimContext = { incidentPhase: 0, stress: {}, hot: [], alerts: 0, schedules: {}, homes: {}, minute: 12 * 60, abs: 0, day: 0, lifeActive: new Set<string>(), batchRoom: {}, live: false };

function buildSimContext(vitals: RoomVitals, incidentPhase: number, staff: Record<string, GrowOpsStaff>, lifecycle?: LifecycleSnapshot): NpcSimContext {
  const stress: Record<string, number> = {};
  const hot: string[] = [];
  let alerts = 0;
  for (const [roomId, vital] of Object.entries(vitals)) {
    if (vital.status === "ALERT") {
      stress[roomId] = 2;
      hot.push(roomId);
      alerts += 1;
    } else if (vital.status === "WATCH") {
      stress[roomId] = 1;
      hot.push(roomId);
    }
  }
  const schedules: Record<string, Gen2Schedule> = {};
  const homes: Record<string, string> = {};
  for (const [id, member] of Object.entries(staff)) {
    if (member.schedule) schedules[id] = member.schedule;
    if (member.stationRoomId) homes[id] = member.stationRoomId;
  }
  return { ...EMPTY_SIM_CONTEXT, incidentPhase, stress, hot, alerts, schedules, homes, lifeActive: lifecycle ? lifeActiveKeys(lifecycle) : EMPTY_SIM_CONTEXT.lifeActive, batchRoom: lifecycle ? lifeBatchRooms(lifecycle) : {} };
}

/** Facility clock follows the browser's wall clock. */
function withClock(ctx: NpcSimContext, now: number): NpcSimContext {
  const date = new Date(now);
  return {
    ...ctx,
    minute: date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60,
    abs: Math.floor(now / 60000),
    day: Math.floor((now - date.getTimezoneOffset() * 60000) / 86400000),
    live: Math.abs(Date.now() - now) < 2500,
  };
}

function clockMinuteNow() {
  const date = new Date();
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}

// ---------------------------------------------------------------------------
// Sims-style autonomy: scheduled breaks, station-hopping work, occasional trips
// ---------------------------------------------------------------------------

const MANAGER_IDS = new Set(["cultManager", "opsManager", "salesRep"]);
/** Where staff clock out (the hall outside the screening room's door) and the length of one banter turn in sim ticks (~3 s). */
const EXIT_TILE = { x: 96, y: 34 };
const BANTER_TURN_TICKS = 7;
const BATHROOM_THRESHOLD = 78;
const DESPERATE_THRESHOLD = 96;
const WORK_KINDS: Gen2Prop["kind"][] = ["desk", "terminal", "table", "trimTable", "rack", "machine", "vat", "plantBed", "tray", "plant", "cutPlant", "dryRack", "shelf", "crate", "barrel", "sack", "soil", "conveyor", "experiment", "centrifuge", "microscope", "glassware", "scale", "printer", "hood", "display", "pottingMix", "cabinet", "condenser", "humidifier", "fan"];
const BREAK_ROOM_WORK_KINDS: Gen2Prop["kind"][] = ["fridge", "coffee", "microwave", "waterStation", "vending", "table"];

type Spot = { x: number; y: number; face: Gen2Direction; roomId?: string; seat?: boolean };
type Stations = {
  coffee: Spot[];
  water: Spot[];
  fridge: Spot[];
  microwave: Spot[];
  bathroom: Spot[];
  breakSeat: Spot[];
  workSpots: Record<string, Spot[]>;
  hallTiles: Array<{ x: number; y: number }>;
};

let stationCache: Stations | undefined;
const favoriteSpotCache = new Map<string, Spot[]>();

function tileKey(x: number, y: number) {
  return `${x},${y}`;
}

function floodReachable(walkable: Set<string>) {
  const start = gen2Hallways.length ? { x: gen2Hallways[2]?.x ?? gen2Hallways[0].x, y: gen2Hallways[2]?.y ?? gen2Hallways[0].y } : undefined;
  const seen = new Set<string>();
  const seed = start ? nearestWalkableGoal(start, walkable, 8) : undefined;
  if (!seed) return walkable;
  const queue = [seed];
  seen.add(tileKey(seed.x, seed.y));
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const key = tileKey(current.x + dx, current.y + dy);
      if (seen.has(key) || !walkable.has(key)) continue;
      seen.add(key);
      queue.push({ x: current.x + dx, y: current.y + dy });
    }
  }
  return seen;
}

let reachCache: Set<string> | undefined;

function getReach() {
  if (!reachCache) reachCache = floodReachable(buildWalkable());
  return reachCache;
}

function propCoversTile(prop: Gen2Prop, x: number, y: number) {
  return x >= prop.x && x < prop.x + (prop.w ?? 1) && y >= prop.y && y < prop.y + (prop.h ?? 1);
}

const adjacentCache = new Map<string, Spot[]>();

/** Reachable floor tiles next to props of the given kinds, inside one room (cached). */
function adjacentSpotsFor(kinds: Gen2Prop["kind"][], roomId: string): Spot[] {
  const cacheKey = `${roomId}|${kinds.join(",")}`;
  const cached = adjacentCache.get(cacheKey);
  if (cached) return cached;
  const reach = getReach();
  const spots = new Map<string, Spot>();
  for (const prop of gen2Props.filter((item) => kinds.includes(item.kind) && item.room === roomId)) {
    for (let y = prop.y; y < prop.y + (prop.h ?? 1); y += 1) {
      for (let x = prop.x; x < prop.x + (prop.w ?? 1); x += 1) {
        const around: Array<[number, number, Gen2Direction]> = [[0, 1, "up"], [0, -1, "down"], [-1, 0, "right"], [1, 0, "left"]];
        for (const [dx, dy, face] of around) {
          const sx = x + dx;
          const sy = y + dy;
          const key = tileKey(sx, sy);
          if (propCoversTile(prop, sx, sy) || !reach.has(key) || roomAt(sx, sy)?.id !== roomId) continue;
          if (!spots.has(key)) spots.set(key, { x: sx, y: sy, face, roomId });
        }
      }
    }
  }
  const result = [...spots.values()];
  adjacentCache.set(cacheKey, result);
  return result;
}

function getStations(): Stations {
  if (stationCache) return stationCache;
  const reach = getReach();
  const propCovers = propCoversTile;
  const adjacent = adjacentSpotsFor;
  const tableLike = (x: number, y: number) => gen2Props.some((prop) => ["desk", "table", "trimTable", "terminal"].includes(prop.kind) && propCovers(prop, x, y));
  const chairSpots = (roomId: string): Spot[] => gen2Props
    .filter((prop) => prop.kind === "chair" && prop.room === roomId)
    .filter((prop) => [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => reach.has(tileKey(prop.x + dx, prop.y + dy))))
    .map((prop) => {
      const face: Gen2Direction = tableLike(prop.x, prop.y - 1) ? "up" : tableLike(prop.x - 1, prop.y) ? "left" : tableLike(prop.x + 1, prop.y) ? "right" : tableLike(prop.x, prop.y + 1) ? "down" : "up";
      return { x: prop.x, y: prop.y, face, roomId, seat: true };
    });
  const workSpots: Record<string, Spot[]> = {};
  for (const room of gen2Rooms) {
    if (room.id === "bath") continue;
    const kinds = room.id === "break" ? BREAK_ROOM_WORK_KINDS : WORK_KINDS;
    const spots = [...(room.id === "break" ? [] : chairSpots(room.id)), ...adjacent(kinds, room.id)];
    if (spots.length) workSpots[room.id] = spots;
  }
  const hallTiles: Array<{ x: number; y: number }> = [];
  for (const key of reach) {
    const [x, y] = key.split(",").map(Number);
    if (!roomAt(x, y)) hallTiles.push({ x, y });
  }
  stationCache = {
    coffee: adjacent(["coffee"], "break"),
    water: adjacent(["waterStation"], "break"),
    fridge: adjacent(["fridge"], "break"),
    microwave: adjacent(["microwave"], "break"),
    bathroom: adjacent(["urinal", "sink"], "bath"),
    breakSeat: chairSpots("break"),
    workSpots,
    hallTiles,
  };
  return stationCache;
}

/** A worker's personal "territory": one chair (if any) plus a few other stations in the room, stable per worker. */
function favoriteSpots(id: string, roomId: string): Spot[] {
  const cacheKey = `${id}@${roomId}`;
  const cached = favoriteSpotCache.get(cacheKey);
  if (cached) return cached;
  const all = getStations().workSpots[roomId] ?? [];
  const ranked = [...all].sort((a, b) => gen2Hash01(id, tileKey(a.x, a.y)) - gen2Hash01(id, tileKey(b.x, b.y)));
  const seat = ranked.find((spot) => spot.seat);
  const others = ranked.filter((spot) => spot !== seat).slice(0, seat ? 3 : 4);
  const picked = seat ? [seat, ...others] : others;
  favoriteSpotCache.set(cacheKey, picked);
  return picked;
}

function homeRoomOf(npc: LiveNpc, ctx: NpcSimContext) {
  return ctx.homes[npc.id] ?? gen2WorkerProfiles[npc.id]?.stationRoomId ?? roomAt(npc.route[0]?.x ?? npc.x, npc.route[0]?.y ?? npc.y)?.id;
}

function tripCooldown(npc: LiveNpc) {
  const range = (min: number, max: number) => Math.round((min + Math.random() * (max - min)) * 140);
  if (npc.id === "boss") return range(2, 4);
  if (MANAGER_IDS.has(npc.id)) return range(2.5, 5);
  if (npc.id === "patrol") return range(1.5, 3);
  if (npc.id === "security") return range(4, 7);
  if (npc.id === "maintenance") return range(1.2, 2.5);
  if (npc.role === "secretary") return range(3, 5);
  if (npc.role === "logistics") return range(3, 5);
  if (npc.role === "processing" || npc.role === "science") return range(3, 6);
  if (npc.role === "cultivation") return range(5, 10);
  return range(5, 9);
}

function createSim(id: string): NpcSim {
  return {
    needs: {
      energy: 5 + gen2Hash01(id, "n-energy") * 45,
      social: 10 + gen2Hash01(id, "n-social") * 50,
      hunger: gen2Hash01(id, "n-hunger") * 40,
      bladder: gen2Hash01(id, "n-bladder") * 45,
    },
    chatCd: Math.floor(gen2Hash01(id, "n-chatcd") * 25),
    errandCd: Math.floor(gen2Hash01(id, "n-errcd") * 40),
    recent: {},
    legFor: -1,
    mode: "work",
    tripIdx: 0,
    tripCd: 60 + Math.floor(gen2Hash01(id, "n-trip") * 600),
    lastBreak: "",
    breakUntil: 0,
    breakRetry: 0,
  };
}

function finiteOr(value: unknown, fallback: number, min = 0, max = 100) {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, Number(value))) : fallback;
}

const ERRAND_KINDS: ErrandKind[] = ["coffee", "water", "fridge", "microwave", "bathroom", "sit", "phone", "desk", "seek", "work", "leave"];
const DIRECTIONS: Gen2Direction[] = ["down", "up", "left", "right"];

function coerceSim(value: unknown, id: string): NpcSim {
  const fallback = createSim(id);
  const raw = value as Partial<NpcSim> | undefined;
  if (!raw || typeof raw !== "object") return fallback;
  const needs = (raw.needs ?? {}) as Partial<NpcNeeds>;
  const errand = raw.errand as Partial<NpcErrand> | undefined;
  const chat = raw.chat as Partial<NpcChat> | undefined;
  const recent: Record<string, number> = {};
  if (raw.recent && typeof raw.recent === "object") {
    for (const [key, ticks] of Object.entries(raw.recent)) if (Number.isFinite(ticks) && Number(ticks) > 0) recent[key] = Math.min(600, Number(ticks));
  }
  return {
    needs: {
      energy: finiteOr(needs.energy, fallback.needs.energy),
      social: finiteOr(needs.social, fallback.needs.social),
      hunger: finiteOr(needs.hunger, fallback.needs.hunger),
      bladder: finiteOr(needs.bladder, fallback.needs.bladder),
    },
    errand: errand && ERRAND_KINDS.includes(errand.kind as ErrandKind) && Number.isFinite(errand.x) && Number.isFinite(errand.y)
      ? {
        kind: errand.kind as ErrandKind,
        x: Number(errand.x),
        y: Number(errand.y),
        face: DIRECTIONS.includes(errand.face as Gen2Direction) ? errand.face : undefined,
        seat: !!errand.seat,
        stage: "go",
        left: finiteOr(errand.left, 8, 0, 900),
        timeout: finiteOr(errand.timeout, 60, 0, 120),
        partnerId: typeof errand.partnerId === "string" ? errand.partnerId : undefined,
      }
      : undefined,
    chat: chat && typeof chat.with === "string" && typeof chat.say === "string"
      ? { with: chat.with, left: finiteOr(chat.left, 4, 0, 60), say: chat.say.slice(0, 80), side: chat.side === "r" ? "r" : "l", script: Array.isArray(chat.script) ? chat.script.filter((line): line is string => typeof line === "string").map((line) => line.slice(0, 80)).slice(0, 6) : undefined, t: finiteOr(chat.t, 0, 0, 80) }
      : undefined,
    chatCd: finiteOr(raw.chatCd, 0, 0, 600),
    errandCd: finiteOr(raw.errandCd, 0, 0, 300),
    recent,
    legFor: -1,
    mode: raw.mode === "trip" ? "trip" : "work",
    tripIdx: finiteOr(raw.tripIdx, 0, 0, 200),
    tripCd: finiteOr(raw.tripCd, fallback.tripCd, 0, 6000),
    lastBreak: typeof raw.lastBreak === "string" ? raw.lastBreak.slice(0, 24) : "",
    breakUntil: Number.isFinite(raw.breakUntil) ? Number(raw.breakUntil) : 0,
    breakRetry: finiteOr(raw.breakRetry, 0, 0, 60),
    wasOn: typeof raw.wasOn === "boolean" ? raw.wasOn : undefined,
    parkedDay: Number.isFinite(raw.parkedDay) ? Number(raw.parkedDay) : undefined,
  };
}

function isCriticalNow(npc: LiveNpc, ctx: NpcSimContext) {
  const incident = ctx.incidentPhase >= 13 && ctx.incidentPhase <= 15;
  if (incident && ["security", "patrol", "researcher", "rdSafety"].includes(npc.id)) return true;
  return false;
}

function isAutonomousWorker(npc: LiveNpc) {
  return npc.role !== "boss" && npc.role !== "secretary" && npc.role !== "security" && !MANAGER_IDS.has(npc.id);
}

function departmentOf(npc: LiveNpc) {
  return gen2WorkerProfiles[npc.id]?.department ?? npc.role;
}

function scheduleOf(npc: LiveNpc, ctx: NpcSimContext): Gen2Schedule {
  return ctx.schedules[npc.id] ?? gen2DefaultSchedule(npc.id, departmentOf(npc));
}

function isOnBreak(npc: LiveNpc, ctx: NpcSimContext) {
  return !!npc.sim && npc.sim.breakUntil > ctx.abs && gen2OnShift(scheduleOf(npc, ctx), ctx.minute);
}

/** How likely a conversation is, given where the pair is. 0 = never. */
function chatSetting(a: LiveNpc, b: LiveNpc, ctx: NpcSimContext) {
  const roomId = roomAt(a.x, a.y)?.id;
  if (roomId === "break" || isOnBreak(a, ctx) || isOnBreak(b, ctx)) return 1;
  const homeA = homeRoomOf(a, ctx);
  const homeB = homeRoomOf(b, ctx);
  if (roomId && ((homeA !== roomId && homeB === roomId) || (homeB !== roomId && homeA === roomId))) return 0.9;
  if (roomId && homeA === roomId && homeB === roomId) return 0.3;
  return 0.25;
}

function chatAvailable(npc: LiveNpc, ctx: NpcSimContext) {
  if (npc.id === "boss") return false;
  const sim = npc.sim;
  if (!sim || sim.chat || sim.chatCd > 0 || sim.task || TALK_HOLD.has(npc.id)) return false;
  if (!gen2OnShift(scheduleOf(npc, ctx), ctx.minute)) return false;
  if (isCriticalNow(npc, ctx) || visibleCargo(npc, ctx.incidentPhase)) return false;
  if (isBathroomTile(npc.x, npc.y)) return false;
  if (sim.errand && sim.errand.stage !== "use" && sim.errand.kind !== "seek") return false;
  if (sim.errand?.party && sim.errand.stage !== "use") return false; // still walking to the birthday gathering
  return true;
}

function npcName(id: string) {
  return gen2WorkerIdentity[id]?.name ?? humanizeNpcId(id);
}

function faceToward(from: { x: number; y: number }, to: { x: number; y: number }, fallback: Gen2Direction): Gen2Direction {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return fallback;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function buildChatLines(a: LiveNpc, b: LiveNpc, ctx: NpcSimContext): [string, string] {
  const topics = gen2ChatTopics;
  const roomId = roomAt(a.x, a.y)?.id;
  const options: string[] = [];
  const deptA = departmentOf(a);
  options.push(...(topics.workByDepartment[deptA] ?? topics.workByDepartment.Operations));
  options.push(...topics.joke, ...topics.gripe, ...topics.gossip);
  if (roomId === "break") options.push(...topics.breakRoom, ...topics.breakRoom);
  const hotLines = ctx.hot.flatMap((id) => topics.telemetryByRoom[id] ?? []);
  if (hotLines.length) options.push(...hotLines, ...hotLines);
  // weather and the next holiday are good small talk (lines come from the calendar poll)
  if (LIFE_TALK.lines.length) options.push(...LIFE_TALK.lines, ...LIFE_TALK.lines);
  if (a.role === "science" || b.role === "science" || a.role === "security") options.push(...topics.fireDrill);
  return [pick(options), pick(topics.reply)];
}

function startChats(list: LiveNpc[], ctx: NpcSimContext): LiveNpc[] {
  let out = list;
  const used = new Set<string>();
  for (let i = 0; i < list.length; i += 1) {
    const a = out[i];
    if (used.has(a.id) || !chatAvailable(a, ctx)) continue;
    const roomA = roomAt(a.x, a.y)?.id;
    for (let j = i + 1; j < list.length; j += 1) {
      const b = out[j];
      if (used.has(b.id) || !chatAvailable(b, ctx)) continue;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      if (dx * dx + dy * dy > (roomA === "break" ? 10 : 5)) continue;
      if (roomAt(b.x, b.y)?.id !== roomA) continue;
      const simA = a.sim as NpcSim;
      const simB = b.sim as NpcSim;
      if (simA.recent[b.id] || simB.recent[a.id]) continue;
      const chatty = (gen2SimTraitFor(a.id).chatty + gen2SimTraitFor(b.id).chatty) / 2;
      const wantsChat = simA.needs.social >= 55 || simB.needs.social >= 55;
      // Friends (same pair hash the backend uses for coworker opinions) chat more and longer; some coworkers rarely talk.
      const sameDept = departmentOf(a) === departmentOf(b);
      const affinity = pairAffinity(a.id, b.id, sameDept);
      const friends = affinity >= FRIEND_AT;
      const affinityMul = friends ? 1.6 : affinity <= RARE_AT ? 0.3 : 0.7 + affinity * 0.5;
      const chance = Math.min(0.9, 0.2 * chatty * (wantsChat ? 2.2 : 1) * chatSetting(a, b, ctx) * affinityMul);
      if (Math.random() > chance) continue;
      const [lineA, lineB] = buildChatLines(a, b, ctx);
      const sideA: "l" | "r" = a.x < b.x ? "l" : a.x > b.x ? "r" : a.id < b.id ? "l" : "r";
      let length = 7 + Math.floor(Math.random() * 6) + (friends ? 4 + Math.floor(Math.random() * 4) : 0);
      // An AI-written exchange that was prefetched for this pair: alternating bubbles, one speaker at a time.
      const banter = ctx.live ? takeBanter(a.id, b.id) : undefined;
      let chatA: NpcChat = { with: b.id, left: length, say: lineA, side: sideA };
      let chatB: NpcChat = { with: a.id, left: length, say: lineB, side: sideA === "l" ? "r" : "l" };
      if (banter?.length) {
        const turns = banter.slice(0, 4);
        length = turns.length * BANTER_TURN_TICKS + 2;
        const scriptFor = (id: string) => turns.map((turn) => (turn.speaker === id ? turn.text : ""));
        chatA = { with: b.id, left: length, say: scriptFor(a.id)[0], side: sideA, script: scriptFor(a.id), t: 0 };
        chatB = { with: a.id, left: length, say: scriptFor(b.id)[0], side: sideA === "l" ? "r" : "l", script: scriptFor(b.id), t: 0 };
      }
      const cooldown = friends ? 260 : affinity <= RARE_AT ? 700 : 420;
      const startA: NpcSim = { ...simA, errand: simA.errand?.stage === "use" ? simA.errand : undefined, chat: chatA, recent: { ...simA.recent, [b.id]: cooldown } };
      const startB: NpcSim = { ...simB, errand: simB.errand?.stage === "use" ? simB.errand : undefined, chat: chatB, recent: { ...simB.recent, [a.id]: cooldown } };
      if (out === list) out = list.slice();
      out[i] = { ...a, dir: faceToward(a, b, a.dir), stepFrame: 0, sim: startA };
      out[j] = { ...b, dir: faceToward(b, a, b.dir), stepFrame: 0, sim: startB };
      used.add(a.id);
      used.add(b.id);
      break;
    }
  }
  return out;
}

function advanceAllNpcs(npcs: LiveNpc[], walkable: Set<string>, baseCtx: NpcSimContext = EMPTY_SIM_CONTEXT, now: number = Date.now()) {
  const ctx = withClock(baseCtx, now);
  const next = npcs.slice();
  for (let index = 0; index < next.length; index += 1) next[index] = advanceNpc(next[index], walkable, next, ctx);
  return startChats(next, ctx);
}

function tickSim(sim: NpcSim, npc: LiveNpc, ctx: NpcSimContext): NpcSim {
  const trait = gen2SimTraitFor(npc.id);
  const roomId = roomAt(npc.x, npc.y)?.id;
  const stationId = gen2WorkerProfiles[npc.id]?.stationRoomId;
  const stress = Math.max(roomId ? ctx.stress[roomId] ?? 0 : 0, stationId ? (ctx.stress[stationId] ?? 0) * 0.6 : 0);
  const resting = sim.errand?.stage === "use" && (sim.errand.kind === "sit" || sim.errand.kind === "phone");
  const needs: NpcNeeds = {
    energy: Math.min(100, sim.needs.energy + 0.16 * trait.energyRate * (1 + stress * 0.7) * (resting ? 0.2 : 1)),
    social: Math.min(100, sim.needs.social + 0.2 * trait.socialRate),
    hunger: Math.min(100, sim.needs.hunger + 0.11 * trait.hungerRate),
    bladder: Math.min(100, sim.needs.bladder + 0.09 * trait.bladderRate),
  };
  let recent = sim.recent;
  const keys = Object.keys(recent);
  if (keys.length) {
    recent = {};
    for (const key of keys) if (sim.recent[key] > 1) recent[key] = sim.recent[key] - 1;
  }
  return { ...sim, needs, recent, chatCd: Math.max(0, sim.chatCd - 1), errandCd: Math.max(0, sim.errandCd - 1), tripCd: Math.max(0, sim.tripCd - 1), breakRetry: Math.max(0, sim.breakRetry - 1) };
}

function spotTaken(spot: { x: number; y: number }, all: LiveNpc[], selfId: string) {
  return all.some((other) => other.id !== selfId && ((other.x === spot.x && other.y === spot.y) || (other.sim?.errand && other.sim.errand.x === spot.x && other.sim.errand.y === spot.y && (other.sim.errand.kind !== "seek" || other.sim.errand.party)) || (other.sim?.task?.spot && other.sim.task.spot.x === spot.x && other.sim.task.spot.y === spot.y)));
}

function pickSpot(spots: Spot[], from: { x: number; y: number }, all: LiveNpc[], selfId: string, near?: { x: number; y: number }): Spot | undefined {
  const free = spots.filter((spot) => !spotTaken(spot, all, selfId));
  if (!free.length) return undefined;
  const anchor = near ?? from;
  const sorted = [...free].sort((a, b) => Math.abs(a.x - anchor.x) + Math.abs(a.y - anchor.y) - (Math.abs(b.x - anchor.x) + Math.abs(b.y - anchor.y)));
  return pick(sorted.slice(0, 3));
}

function breakBound(all: LiveNpc[], excludingId: string) {
  return all.filter((npc) => npc.id !== excludingId && (isBreakRoomTile(npc.x, npc.y) || (npc.sim?.errand && isBreakRoomTile(npc.sim.errand.x, npc.sim.errand.y) && npc.sim.errand.stage === "go" && npc.sim.errand.kind !== "work"))).length;
}

function errandUseTicks(kind: ErrandKind, onBreak = false) {
  const ranges: Record<ErrandKind, [number, number]> = { coffee: [8, 14], water: [5, 9], fridge: [8, 13], microwave: [10, 16], bathroom: [7, 12], sit: [14, 24], phone: [10, 18], desk: [14, 26], seek: [1, 1], work: [60, 200], leave: [10, 14] };
  const [min, max] = ranges[kind];
  const base = min + Math.floor(Math.random() * (max - min + 1));
  return onBreak && (kind === "sit" || kind === "phone") ? base * 3 : base;
}

function workErrand(npc: LiveNpc, sim: NpcSim, all: LiveNpc[], ctx: NpcSimContext, onShift: boolean): NpcErrand | undefined {
  const trait = gen2SimTraitFor(npc.id);
  const home = homeRoomOf(npc, ctx);
  if (!home) return undefined;
  const spots = favoriteSpots(npc.id, home);
  const here = sim.errand?.kind === "work" ? { x: sim.errand.x, y: sim.errand.y } : { x: npc.x, y: npc.y };
  const options = spots.filter((spot) => !(spot.x === here.x && spot.y === here.y));
  const spot = pickSpot(options.length ? options : spots, npc, all, npc.id);
  if (!spot) return undefined;
  // Tens of seconds up to a few minutes at each station; off shift they just stay put.
  const base = spot.seat ? 130 + Math.random() * 300 : 55 + Math.random() * 210;
  const dwell = Math.round(base * trait.pauseScale * (onShift ? 1 : 3));
  return { kind: "work", x: spot.x, y: spot.y, face: spot.face, seat: spot.seat, stage: "go", left: dwell, timeout: 120 };
}

function breakErrand(npc: LiveNpc, sim: NpcSim, all: LiveNpc[], slotId: string | undefined): NpcErrand | undefined {
  const stations = getStations();
  const trait = gen2SimTraitFor(npc.id);
  const hungry = slotId === "lunch" || sim.needs.hunger >= 60;
  const pool: ErrandKind[] = hungry
    ? ["fridge", "microwave", "sit", "water", "phone"]
    : slotId === "morning" ? ["coffee", "coffee", "sit", "water", "phone"] : ["coffee", "water", "sit", "phone", trait.favorite === "sit" || trait.favorite === "phone" ? trait.favorite : "water"];
  const spotsFor: Record<string, Spot[]> = { coffee: stations.coffee, water: stations.water, fridge: stations.fridge, microwave: stations.microwave, sit: stations.breakSeat, phone: stations.breakSeat };
  const kinds = [...pool].sort(() => Math.random() - 0.5);
  const company = all.filter((other) => other.id !== npc.id && isBreakRoomTile(other.x, other.y));
  const friendsHere = company.filter((other) => isFriend(npc.id, other.id, departmentOf(npc) === departmentOf(other)));
  const near = friendsHere.length && Math.random() < 0.8 ? pick(friendsHere) : company.length && Math.random() < 0.6 ? pick(company) : undefined;
  for (const kind of kinds) {
    const spot = pickSpot(spotsFor[kind] ?? [], npc, all, npc.id, near && (kind === "sit" || kind === "phone" || kind === "water" || kind === "coffee") ? near : undefined);
    if (spot) return { kind, x: spot.x, y: spot.y, face: spot.face, seat: spot.seat, stage: "go", left: errandUseTicks(kind, true), timeout: 140 };
  }
  return undefined;
}

function reliefFor(kind: ErrandKind, needs: NpcNeeds): NpcNeeds {
  const next = { ...needs };
  if (kind === "coffee") { next.energy -= 45; next.hunger -= 12; }
  if (kind === "water") { next.hunger -= 30; next.energy -= 8; }
  if (kind === "fridge") { next.hunger -= 60; }
  if (kind === "microwave") { next.hunger -= 55; next.energy -= 10; }
  if (kind === "bathroom") { next.bladder = 0; }
  if (kind === "sit") { next.energy -= 55; }
  if (kind === "phone") { next.social -= 25; next.energy -= 25; }
  return { energy: Math.max(0, next.energy), social: Math.max(0, next.social), hunger: Math.max(0, next.hunger), bladder: Math.max(0, next.bladder) };
}

function standStill(npc: LiveNpc, sim: NpcSim, dir?: Gen2Direction, pause?: number): LiveNpc {
  return { ...npc, dir: dir ?? npc.dir, stepFrame: 0, pause: pause ?? npc.pause, sim };
}

function isBreakKind(kind: ErrandKind) {
  return kind !== "work" && kind !== "bathroom";
}

function advanceNpc(npc: LiveNpc, walkable: Set<string>, allNpcs: LiveNpc[], ctx: NpcSimContext = EMPTY_SIM_CONTEXT): LiveNpc {
  const trait = gen2SimTraitFor(npc.id);
  let sim = tickSim(npc.sim ?? createSim(npc.id), npc, ctx);
  const critical = isCriticalNow(npc, ctx);
  const schedule = scheduleOf(npc, ctx);
  const onShift = gen2OnShift(schedule, ctx.minute);

  // 0. The player is talking to this worker: stand still facing them (an incident still calls the worker away).
  const talkFace = TALK_HOLD.get(npc.id);
  if (talkFace && !critical) return standStill(npc, sim.chat ? { ...sim, chat: undefined } : sim, talkFace);
  // 0b. A celebration (promotion, "Congrats!") holds the worker for a few seconds, same idea.
  const cheerFace = activeHold(npc.id);
  if (cheerFace && !critical) return standStill(npc, sim.chat ? { ...sim, chat: undefined } : sim, cheerFace);

  // 0c. Shift edges: greet the day, and clock out by walking to the screening-room door (then idle there until the next shift).
  if (sim.wasOn !== onShift) {
    const edge = sim.wasOn !== undefined && ctx.live && schedule.shiftStart !== schedule.shiftEnd && npc.id !== "boss";
    sim = { ...sim, wasOn: onShift, parkedDay: onShift ? undefined : sim.parkedDay };
    if (edge && onShift) setMoment(npc.id, "MORNING!", 3500, { tone: "hello" });
    if (edge && !onShift && !critical && !sim.task) {
      const door = pickSpot(getStations().hallTiles.filter((tile) => Math.abs(tile.x - EXIT_TILE.x) + Math.abs(tile.y - EXIT_TILE.y) <= 6).map((tile) => ({ ...tile, face: "left" as Gen2Direction })), npc, allNpcs, npc.id, EXIT_TILE);
      if (door) {
        sim = { ...sim, parkedDay: ctx.day, errand: { kind: "leave", x: door.x, y: door.y, face: "left", stage: "go", left: 14, timeout: 260 }, via: undefined, legFor: -1 };
        npc = { ...npc, pause: 0 };
      }
    }
  }

  // 1. Conversations: stand, face partner, resume after a few seconds.
  if (sim.chat) {
    const partner = allNpcs.find((other) => other.id === sim.chat?.with);
    const partnerTalking = !!partner && partner.sim?.chat?.with === npc.id;
    if (!partnerTalking || sim.chat.left <= 0 || critical) {
      sim = { ...sim, chat: undefined, chatCd: 70 + Math.floor(Math.random() * 120), needs: { ...sim.needs, social: Math.max(0, sim.needs.social - 55) } };
    } else {
      let chat: NpcChat = { ...sim.chat, left: sim.chat.left - 1 };
      if (chat.script) {
        // banter: each turn lasts BANTER_TURN_TICKS ticks (~3 s); only the current speaker shows a bubble
        const t = (chat.t ?? 0) + 1;
        chat = { ...chat, t, say: chat.script[Math.min(Math.floor(t / BANTER_TURN_TICKS), chat.script.length - 1)] ?? "" };
      }
      return standStill(npc, { ...sim, chat }, partner ? faceToward(npc, partner, npc.dir) : npc.dir);
    }
  }

  // 2. Schedule: shift boundaries and break windows.
  let onBreak = onShift && sim.breakUntil > ctx.abs;
  if (!onShift && sim.breakUntil) sim = { ...sim, breakUntil: 0 };
  if (!onBreak && sim.breakUntil) sim = { ...sim, breakUntil: 0, errand: sim.errand && isBreakKind(sim.errand.kind) ? undefined : sim.errand };
  if (!onShift && sim.mode === "trip") sim = { ...sim, mode: "work", tripIdx: 0 };
  if (critical && sim.mode === "work") sim = { ...sim, tripCd: 0 };
  if (onShift && !onBreak && npc.id !== "boss" && !critical && sim.mode === "work" && sim.breakRetry <= 0) {
    let slot = gen2BreakWindowAt(schedule, ctx.minute);
    // Friends take breaks together: join a friend who is already in the break room up to 12 minutes before your own slot.
    if (!slot && allNpcs.some((other) => other.id !== npc.id && isOnBreak(other, ctx) && isBreakRoomTile(other.x, other.y) && isFriend(npc.id, other.id, departmentOf(npc) === departmentOf(other)))) slot = gen2BreakWindowAt(schedule, ctx.minute + 12);
    const key = slot ? `${ctx.day}:${slot.id}` : "";
    if (slot && sim.lastBreak !== key && !visibleCargo(npc, ctx.incidentPhase)) {
      const dept = departmentOf(npc);
      const mates = allNpcs.filter((other) => departmentOf(other) === dept);
      const away = mates.filter((other) => other.id !== npc.id && isOnBreak(other, ctx)).length;
      const coverage = away < Math.max(1, Math.floor(mates.length / 3));
      const roomFree = isBreakRoomTile(npc.x, npc.y) || breakBound(allNpcs, npc.id) < 3;
      const errand = coverage && roomFree ? breakErrand(npc, sim, allNpcs, slot.id) : undefined;
      if (errand) {
        sim = { ...sim, lastBreak: key, breakUntil: ctx.abs + slot.length, errand, breakRetry: 0, via: undefined, legFor: -1 };
        onBreak = true;
        npc = { ...npc, pause: 0 };
      } else {
        // Break room busy or department short-handed: postpone a few minutes.
        sim = { ...sim, breakRetry: 20 + Math.floor(Math.random() * 20) };
      }
    }
  }

  // Lifecycle jobs end with the shift or when the fire/security incident calls the worker away.
  if (sim.task && (!onShift || critical)) sim = { ...sim, task: undefined };

  // 3. Errands: urgent needs, break-room chain, and the daily work stations.
  if (critical && sim.mode === "work" && sim.errand?.kind === "work" && sim.errand.left > 0) sim = { ...sim, errand: { ...sim.errand, left: 0 } };
  if (critical && sim.errand && sim.errand.kind !== "work") sim = { ...sim, errand: undefined };
  const workingNow = !sim.errand || sim.errand.kind === "work";
  if (workingNow && sim.mode === "work" && !critical && npc.id !== "boss" && !visibleCargo(npc, ctx.incidentPhase)) {
    let urgent: NpcErrand | undefined;
    const stations = getStations();
    if (sim.needs.bladder >= BATHROOM_THRESHOLD && sim.errandCd <= 0 && onShift && !bathroomOccupied(allNpcs, npc.id)) {
      const spot = pickSpot(stations.bathroom, npc, allNpcs, npc.id);
      if (spot) urgent = { kind: "bathroom", x: spot.x, y: spot.y, face: spot.face, stage: "go", left: errandUseTicks("bathroom"), timeout: 100 };
    } else if (onBreak && sim.errandCd <= 0) {
      urgent = breakErrand(npc, sim, allNpcs, undefined);
    } else if (onShift && sim.errandCd <= 0 && (sim.needs.energy >= DESPERATE_THRESHOLD || sim.needs.hunger >= DESPERATE_THRESHOLD) && (isBreakRoomTile(npc.x, npc.y) || breakBound(allNpcs, npc.id) < 3)) {
      const kind: ErrandKind = sim.needs.hunger >= sim.needs.energy ? "water" : "coffee";
      const spot = pickSpot(kind === "water" ? stations.water : stations.coffee, npc, allNpcs, npc.id);
      if (spot) urgent = { kind, x: spot.x, y: spot.y, face: spot.face, stage: "go", left: errandUseTicks(kind), timeout: 100 };
    }
    if (urgent) {
      sim = { ...sim, errand: urgent, via: undefined, legFor: -1 };
      npc = { ...npc, pause: 0 };
    } else if (sim.errandCd <= 0 && !sim.errand && onBreak) {
      sim = { ...sim, errandCd: 4 + Math.floor(Math.random() * 6) };
    }
  }
  // A running lifecycle job (breaks and urgent needs above take priority and simply pause it).
  if (!sim.errand && sim.task && sim.mode === "work" && !onBreak) return advanceTask(npc, sim, walkable, allNpcs, ctx);
  if (!sim.errand && sim.mode === "work" && !onBreak) {
    if (npc.pause > 0) return { ...npc, pause: npc.pause - 1, stepFrame: 0, sim };
    if (!onShift && sim.parkedDay !== undefined) return standStill(npc, sim, "left", 0); // clocked out: waiting by the exit until the next shift
    const errand = workErrand(npc, sim, allNpcs, ctx, onShift);
    if (errand) sim = { ...sim, errand, via: undefined, legFor: -1 };
  }

  if (sim.errand) {
    const errand = sim.errand;
    if (errand.stage === "use" && (npc.x !== errand.x || npc.y !== errand.y)) {
      sim = { ...sim, errand: { ...errand, stage: "go", timeout: 40 } };
      return advanceNpc({ ...npc, sim }, walkable, allNpcs, ctx);
    }
    if (errand.stage === "use") {
      if (errand.left > 0) return standStill(npc, { ...sim, errand: { ...errand, left: errand.left - 1 } }, errand.face);
      const needs = reliefFor(errand.kind, sim.needs);
      if (errand.kind === "work") {
        // Dwell finished: occasionally head out on a production/handoff trip, otherwise hop to another station.
        const canTrip = onShift && !onBreak && !critical ? sim.tripCd <= 0 && npc.route.length > 1 : critical && npc.route.length > 1;
        if (canTrip) return standStill(npc, { ...sim, needs, errand: undefined, mode: "trip", tripIdx: 0, legFor: -1, via: undefined }, undefined, 0);
        return standStill(npc, { ...sim, needs, errand: undefined, errandCd: 0 }, undefined, 0);
      }
      sim = { ...sim, needs, errand: undefined, errandCd: onBreak ? Math.floor(Math.random() * 5) : 40 + Math.floor(Math.random() * 60) };
      return standStill(npc, sim, undefined, 0);
    }
    // stage "go"
    const live = errand;
    if (live.timeout <= 0) return standStill(npc, { ...sim, errand: undefined, errandCd: live.kind === "work" ? 0 : 20 + Math.floor(Math.random() * 30) });
    const progressed: NpcSim = { ...sim, errand: { ...live, timeout: live.timeout - 1 } };
    if (npc.x === live.x && npc.y === live.y) {
      return standStill(npc, { ...progressed, errand: { ...live, stage: "use", timeout: 0 } }, live.face);
    }
    const next = nextStep({ x: npc.x, y: npc.y }, { x: live.x, y: live.y }, walkable, live.seat ? tileKey(live.x, live.y) : undefined);
    if (!next) return standStill(npc, { ...progressed, errand: undefined, errandCd: 40 });
    const enteringBath = isBathroomTile(next.x, next.y) && !isBathroomTile(npc.x, npc.y);
    const enteringBreak = isBreakRoomTile(next.x, next.y) && !isBreakRoomTile(npc.x, npc.y);
    if ((enteringBath && bathroomOccupied(allNpcs, npc.id)) || (enteringBreak && !live.party && breakRoomCount(allNpcs, npc.id) >= 3)) return standStill(npc, progressed);
    if (trait.pace < 1 && Math.random() > trait.pace) return standStill(npc, progressed);
    return { ...npc, x: next.x, y: next.y, dir: directionTo(npc.x, npc.y, next.x, next.y), stepFrame: npc.stepFrame === 1 ? 2 : 1, sim: progressed };
  }

  // 4. Production / handoff trip: walk the worker's route once, then go back to work.
  if (sim.mode === "trip") {
    if (npc.pause > 0) return { ...npc, pause: npc.pause - 1, stepFrame: 0, sim };
    const endTrip = (): LiveNpc => ({ ...npc, routeIndex: 0, stepFrame: 0, pause: 0, sim: { ...sim, mode: "work", tripIdx: 0, tripCd: tripCooldown(npc), via: undefined, legFor: -1 } });
    if (sim.tripIdx >= npc.route.length || !onShift) return endTrip();
    let index = sim.tripIdx;
    let target = npc.route[index];
    if (isBathroomTile(target.x, target.y) && !isBathroomTile(npc.x, npc.y) && bathroomOccupied(allNpcs, npc.id)) {
      return { ...npc, routeIndex: Math.min(index + 1, npc.route.length - 1), pause: 1, stepFrame: 0, sim: { ...sim, tripIdx: index + 1, via: undefined, legFor: -1 } };
    }
    if (isBreakRoomTile(target.x, target.y) && !isBreakRoomTile(npc.x, npc.y) && breakRoomCount(allNpcs, npc.id) >= 3) {
      return { ...npc, routeIndex: Math.min(index + 1, npc.route.length - 1), pause: 1, stepFrame: 0, sim: { ...sim, tripIdx: index + 1, via: undefined, legFor: -1 } };
    }
    index = Math.min(index, npc.route.length - 1);
    target = npc.route[index];
    const routedTarget = nearestWalkableGoal(target, walkable) ?? target;
    if (npc.x === routedTarget.x && npc.y === routedTarget.y) {
      const base = Math.min(target.pause ?? randomPause(npc), 10);
      const pause = Math.max(0, Math.round(base * trait.pauseScale * (0.75 + Math.random() * 0.5)));
      return { ...npc, dir: target.face ?? npc.dir, routeIndex: Math.min(index + 1, npc.route.length - 1), pause, stepFrame: 0, sim: { ...sim, tripIdx: index + 1, via: undefined, legFor: -1 } };
    }
    let goal: { x: number; y: number } = target;
    if (sim.via) {
      if (npc.x === sim.via.x && npc.y === sim.via.y) sim = { ...sim, via: undefined };
      else goal = sim.via;
    } else if (sim.legFor !== index) {
      const via = chooseDetour(npc, routedTarget, trait.wander);
      sim = { ...sim, legFor: index, via };
      if (via) goal = via;
    }
    let next = nextStep({ x: npc.x, y: npc.y }, goal, walkable);
    if (!next && sim.via) {
      sim = { ...sim, via: undefined };
      next = nextStep({ x: npc.x, y: npc.y }, target, walkable);
    }
    if (!next) return { ...npc, routeIndex: index, pause: 1, stepFrame: 0, sim: { ...sim, tripIdx: index + 1 } };
    if (trait.pace < 1 && Math.random() > trait.pace) return { ...npc, routeIndex: index, stepFrame: 0, sim };
    return { ...npc, routeIndex: index, x: next.x, y: next.y, dir: directionTo(npc.x, npc.y, next.x, next.y), stepFrame: npc.stepFrame === 1 ? 2 : 1, sim };
  }

  return { ...npc, stepFrame: 0, sim };
}

// ---------------------------------------------------------------------------
// Lifecycle jobs: event-driven tasks layered on top of the schedule / needs / conversation system
// ---------------------------------------------------------------------------

function taskReady(npc: LiveNpc, ctx: NpcSimContext, busy: Set<string>) {
  const sim = npc.sim;
  if (!sim || busy.has(npc.id) || sim.task || sim.chat || sim.mode !== "work") return false;
  if (sim.errand && sim.errand.kind !== "work") return false;
  if (npc.id === "boss" || isCriticalNow(npc, ctx)) return false;
  if (!gen2OnShift(scheduleOf(npc, ctx), ctx.minute) || isOnBreak(npc, ctx)) return false;
  return !visibleCargo(npc, ctx.incidentPhase);
}

/** Hands queued lifecycle tasks to the first free candidate worker; expired or obsolete tasks are dropped. */
function dispatchLifeTasks(npcs: LiveNpc[], queue: PendingTask[], ctx: NpcSimContext, now: number) {
  const assignments: Record<string, NpcTask> = {};
  const remaining: PendingTask[] = [];
  const dropped: string[] = [];
  const busy = new Set<string>();
  for (const pending of queue) {
    const keys = pending.stops.map((stop) => stop.whileKey).filter((key): key is string => !!key);
    if (now > pending.expires || (keys.length > 0 && !keys.some((key) => ctx.lifeActive.has(key)))) {
      dropped.push(pending.key);
      continue;
    }
    const worker = pending.candidates.map((id) => npcs.find((npc) => npc.id === id)).find((npc): npc is LiveNpc => !!npc && taskReady(npc, ctx, busy));
    if (!worker) {
      remaining.push(pending);
      continue;
    }
    busy.add(worker.id);
    assignments[worker.id] = { id: pending.id, key: pending.key, label: pending.label, stops: pending.stops, idx: 0, stage: "pick", left: 0, waited: 0, timeout: 0 };
  }
  return { assignments, remaining, dropped };
}

function applyTaskAssignments(npcs: LiveNpc[], assignments: Record<string, NpcTask>) {
  if (!Object.keys(assignments).length) return npcs;
  return npcs.map((npc) => {
    const task = assignments[npc.id];
    if (!task || !npc.sim) return npc;
    return { ...npc, pause: 0, sim: { ...npc.sim, task, errand: npc.sim.errand?.kind === "work" ? undefined : npc.sim.errand, via: undefined, legFor: -1 } };
  });
}

function pickTaskSpot(roomId: string, near: Gen2Prop["kind"][] | undefined, npc: LiveNpc, all: LiveNpc[]): Spot | undefined {
  let spots = near ? adjacentSpotsFor(near, roomId) : [];
  if (!spots.length) spots = getStations().workSpots[roomId] ?? [];
  if (!spots.length) return undefined;
  return pickSpot(spots, npc, all, npc.id) ?? spots[Math.floor(Math.random() * spots.length)];
}

function advanceTask(npc: LiveNpc, sim: NpcSim, walkable: Set<string>, allNpcs: LiveNpc[], ctx: NpcSimContext): LiveNpc {
  const trait = gen2SimTraitFor(npc.id);
  let task = sim.task as NpcTask;
  const stop = task.stops[task.idx];
  const end = () => standStill(npc, { ...sim, task: undefined }, undefined, 0);
  if (!stop) return end();
  const skip = () => standStill(npc, { ...sim, task: { ...task, idx: task.idx + 1, stage: "pick", spot: undefined, left: 0, waited: 0, timeout: 0, carrying: stop.drop ? undefined : task.carrying } }, undefined, 0);

  if (task.stage === "pick") {
    if (stop.whileKey && !ctx.lifeActive.has(stop.whileKey)) return skip();
    const roomId = stop.room ?? (stop.batch ? ctx.batchRoom[stop.batch] : undefined);
    if (!roomId) return task.waited > 60 ? skip() : standStill(npc, { ...sim, task: { ...task, waited: task.waited + 1 } }, undefined, 0);
    const spot = pickTaskSpot(roomId, stop.near, npc, allNpcs);
    if (!spot) return skip();
    task = { ...task, stage: "go", spot: { x: spot.x, y: spot.y, face: spot.face }, timeout: 320, waited: 0 };
    sim = { ...sim, task };
  }

  const spot = task.spot as { x: number; y: number; face?: Gen2Direction };
  if (task.stage === "use" && (npc.x !== spot.x || npc.y !== spot.y)) {
    task = { ...task, stage: "go", timeout: 200 };
    sim = { ...sim, task };
  }
  if (task.stage === "go") {
    if (task.timeout <= 0) return end();
    if (stop.whileKey && !ctx.lifeActive.has(stop.whileKey)) return skip(); // the reason for this stop ended while walking
    const progressed: NpcSim = { ...sim, task: { ...task, timeout: task.timeout - 1 } };
    if (npc.x === spot.x && npc.y === spot.y) return standStill(npc, { ...sim, task: { ...task, stage: "use", left: stop.dwell, waited: 0 } }, spot.face);
    const step = nextStep({ x: npc.x, y: npc.y }, spot, walkable);
    if (!step) return end();
    if (trait.pace < 1 && Math.random() > trait.pace) return standStill(npc, progressed);
    return { ...npc, x: step.x, y: step.y, dir: directionTo(npc.x, npc.y, step.x, step.y), stepFrame: npc.stepFrame === 1 ? 2 : 1, sim: progressed };
  }

  // at the stop: finish the minimum dwell, then keep working while the lifecycle says the job is still going
  const stillNeeded = !stop.whileKey || ctx.lifeActive.has(stop.whileKey);
  if (task.left > 0 && stillNeeded) return standStill(npc, { ...sim, task: { ...task, left: task.left - 1 } }, spot.face);
  if (stop.whileKey && ctx.lifeActive.has(stop.whileKey) && task.waited < (stop.maxDwell ?? 900)) return standStill(npc, { ...sim, task: { ...task, waited: task.waited + 1 } }, spot.face);
  return standStill(npc, { ...sim, task: { ...task, idx: task.idx + 1, stage: "pick", spot: undefined, left: 0, waited: 0, timeout: 0, carrying: stop.pickup ?? (stop.drop ? undefined : task.carrying) } }, undefined, 0);
}

function chooseDetour(npc: LiveNpc, target: { x: number; y: number }, wander: number) {
  if (npc.id === "boss" || Math.random() > 0.08 * wander) return undefined;
  const distance = Math.abs(target.x - npc.x) + Math.abs(target.y - npc.y);
  if (distance < 14) return undefined;
  const candidates = getStations().hallTiles.filter((tile) => {
    const toTile = Math.abs(tile.x - npc.x) + Math.abs(tile.y - npc.y);
    const fromTile = Math.abs(tile.x - target.x) + Math.abs(tile.y - target.y);
    return toTile >= 5 && toTile + fromTile <= distance + 12;
  });
  return candidates.length ? pick(candidates) : undefined;
}

function randomPause(npc: LiveNpc) {
  if (npc.role === "boss") return 5 + Math.floor(Math.random() * 6);
  if (npc.role === "security") return 2 + Math.floor(Math.random() * 5);
  return 1 + Math.floor(Math.random() * 4);
}

const NEIGHBOR_OFFSETS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

/** First step of a shortest path; ties between equally short paths are broken randomly. */
function nextStep(from: { x: number; y: number }, to: { x: number; y: number }, walkable: Set<string>, allowTile?: string) {
  const startTile = walkable.has(tileKey(from.x, from.y)) ? from : nearestWalkableGoal(from, walkable, 18);
  if (!startTile) return undefined;
  if (startTile.x !== from.x || startTile.y !== from.y) return startTile;
  const start = tileKey(startTile.x, startTile.y);
  const goalTile = allowTile && tileKey(to.x, to.y) === allowTile ? to : nearestWalkableGoal(to, walkable);
  if (!goalTile) return undefined;
  const goal = tileKey(goalTile.x, goalTile.y);
  const open = (key: string) => walkable.has(key) || key === allowTile;
  const queue = [startTile];
  const cameFrom = new Map<string, string | undefined>([[start, undefined]]);
  const shuffle = Math.random() < 0.6;

  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    if (tileKey(current.x, current.y) === goal) break;
    const ordered = shuffle ? [...NEIGHBOR_OFFSETS].sort(() => Math.random() - 0.5) : NEIGHBOR_OFFSETS;
    const ranked = [...ordered].sort((a, b) => (Math.abs(goalTile.x - (current.x + a.x)) + Math.abs(goalTile.y - (current.y + a.y))) - (Math.abs(goalTile.x - (current.x + b.x)) + Math.abs(goalTile.y - (current.y + b.y))));
    for (const offset of ranked) {
      const step = { x: current.x + offset.x, y: current.y + offset.y };
      const key = tileKey(step.x, step.y);
      if (cameFrom.has(key) || !open(key)) continue;
      cameFrom.set(key, tileKey(current.x, current.y));
      queue.push(step);
    }
  }

  if (!cameFrom.has(goal)) return undefined;
  let current = goal;
  let previous = cameFrom.get(current);
  while (previous && previous !== start) {
    current = previous;
    previous = cameFrom.get(current);
  }
  const [x, y] = current.split(",").map(Number);
  return { x, y };
}

function nearestWalkableGoal(to: { x: number; y: number }, walkable: Set<string>, maxDistance = 4) {
  if (walkable.has(`${to.x},${to.y}`)) return to;
  for (let distance = 1; distance <= maxDistance; distance += 1) {
    for (let y = to.y - distance; y <= to.y + distance; y += 1) {
      for (let x = to.x - distance; x <= to.x + distance; x += 1) {
        if (Math.abs(x - to.x) + Math.abs(y - to.y) !== distance) continue;
        if (walkable.has(`${x},${y}`)) return { x, y };
      }
    }
  }
  return undefined;
}

function directionTo(x: number, y: number, nx: number, ny: number): Gen2Direction {
  if (nx > x) return "right";
  if (nx < x) return "left";
  if (ny < y) return "up";
  return "down";
}

let walkableCache: Set<string> | undefined;

function buildWalkable() {
  if (!walkableCache) walkableCache = computeWalkable();
  return walkableCache;
}

function computeWalkable() {
  const set = new Set<string>();
  const doorCells = new Set<string>();
  for (const hall of gen2Hallways) fill(set, hall.x, hall.y, hall.w, hall.h);
  for (const room of gen2Rooms) fill(set, room.x + 1, room.y + 1, room.w - 2, room.h - 2);
  for (const room of gen2Rooms) {
    for (const door of room.doors) {
      const size = door.size ?? 2;
      if (door.side === "top") fillDoor(set, doorCells, room.x + door.at, room.y, size, 2);
      if (door.side === "bottom") fillDoor(set, doorCells, room.x + door.at, room.y + room.h - 2, size, 3);
      if (door.side === "left") fillDoor(set, doorCells, room.x, room.y + door.at, 2, size);
      if (door.side === "right") fillDoor(set, doorCells, room.x + room.w - 2, room.y + door.at, 3, size);
    }
  }
  for (const room of gen2Rooms) {
    for (let y = room.y; y < room.y + room.h; y += 1) {
      for (let x = room.x; x < room.x + room.w; x += 1) {
        const isBoundary = x === room.x || x === room.x + room.w - 1 || y === room.y || y === room.y + room.h - 1;
        const key = `${x},${y}`;
        if (isBoundary && !doorCells.has(key)) set.delete(key);
      }
    }
  }
  for (const prop of gen2Props) {
    if (!propBlocksMovement(prop)) continue;
    const propWidth = prop.w ?? 1;
    const propHeight = prop.h ?? 1;
    for (let y = prop.y; y < prop.y + propHeight; y += 1) {
      for (let x = prop.x; x < prop.x + propWidth; x += 1) set.delete(`${x},${y}`);
    }
  }
  return set;
}

function propBlocksMovement(prop: Gen2Prop) {
  return gen2PropBlocksMovement(prop);
}

function fill(set: Set<string>, x: number, y: number, w: number, h: number) {
  for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) set.add(`${xx},${yy}`);
}

function fillDoor(set: Set<string>, doorCells: Set<string>, x: number, y: number, w: number, h: number) {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) {
      const key = `${xx},${yy}`;
      set.add(key);
      doorCells.add(key);
    }
  }
}

function roomToFacilityDraft(room: Gen2Room): FacilityRoomDraft {
  return { id: room.id, label: room.label, kind: room.kind, x: room.x, y: room.y, w: room.w, h: room.h, notes: "" };
}

function cleanFacilityRoomDraft(draft: FacilityRoomDraft): FacilityRoomDraft {
  return {
    ...draft,
    label: draft.label.trim() || draft.id.toUpperCase(),
    kind: draft.kind.trim() || "custom",
    x: Number.isFinite(draft.x) ? Math.max(0, Math.round(draft.x)) : 0,
    y: Number.isFinite(draft.y) ? Math.max(0, Math.round(draft.y)) : 0,
    w: Number.isFinite(draft.w) ? Math.max(4, Math.round(draft.w)) : 4,
    h: Number.isFinite(draft.h) ? Math.max(4, Math.round(draft.h)) : 4,
    notes: draft.notes.trim(),
  };
}

function buildFacilityLayoutRooms(drafts: Record<string, FacilityRoomDraft>): FacilityLayoutRoom[] {
  return gen2Rooms.map((room) => {
    const draft = drafts[room.id] ? cleanFacilityRoomDraft(drafts[room.id]) : roomToFacilityDraft(room);
    return {
      id: room.id,
      label: draft.label,
      kind: draft.kind,
      x: draft.x,
      y: draft.y,
      w: draft.w,
      h: draft.h,
      doors: room.doors,
    };
  });
}

function facilityDraftsFromSnapshot(snapshot: FacilityLayoutSnapshot | null): Record<string, FacilityRoomDraft> {
  if (!snapshot) return {};
  const rawDrafts = snapshot.drafts as Record<string, FacilityRoomDraft> | undefined;
  if (rawDrafts && Object.keys(rawDrafts).length) {
    return Object.fromEntries(Object.entries(rawDrafts).map(([id, draft]) => [id, cleanFacilityRoomDraft({ ...draft, id })]));
  }
  return Object.fromEntries(snapshot.rooms.map((room) => [room.id, cleanFacilityRoomDraft({ ...room, notes: snapshot.note ?? "Restored backend snapshot" })]));
}

function facilityDraftsFromImport(input: Record<string, unknown>): Record<string, FacilityRoomDraft> {
  if (input.current && typeof input.current === "object") return facilityDraftsFromSnapshot(input.current as FacilityLayoutSnapshot);
  if (input.drafts && typeof input.drafts === "object") {
    return Object.fromEntries(Object.entries(input.drafts as Record<string, FacilityRoomDraft>).map(([id, draft]) => [id, cleanFacilityRoomDraft({ ...draft, id })]));
  }
  const rooms = Array.isArray(input.draftRooms) ? input.draftRooms : Array.isArray(input.rooms) ? input.rooms : [];
  return Object.fromEntries((rooms as FacilityLayoutRoom[]).filter((room) => room?.id).map((room) => [room.id, cleanFacilityRoomDraft({ ...room, notes: "Imported layout draft" })]));
}

function loadFacilityRoomDrafts(): Record<string, FacilityRoomDraft> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(FACILITY_DRAFT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, FacilityRoomDraft>;
    return Object.fromEntries(Object.entries(parsed).map(([id, draft]) => [id, cleanFacilityRoomDraft({ ...roomToFacilityDraft(gen2Rooms.find((room) => room.id === id) ?? gen2Rooms[0]), ...draft, id })]));
  } catch {
    return {};
  }
}

function persistFacilityRoomDrafts(drafts: Record<string, FacilityRoomDraft>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FACILITY_DRAFT_STORAGE_KEY, JSON.stringify(drafts));
}

function roomSelection(room: Gen2Room, roomVitals: RoomVitals): Selection {
  const operation = gen2RoomOperations[room.id];
  if (!operation) return { type: "room", title: room.label, lines: [`ZONE: ${room.kind.toUpperCase()}`, `SIZE: ${room.w} x ${room.h} TILES`, `DOORS: ${room.doors.length}`, "STATUS: NORMAL"] };
  const vitals = roomVitals[room.id];
  return {
    type: "room",
    title: room.label,
    lines: [
      ...(vitals?.lifePrimary ? [`LIFECYCLE: ${vitals.lifePrimary} / ${vitals.lifeSecondary}`, ...(vitals.lifeDetail ?? [])] : []),
      ...(vitals ? [`${vitals.status}: ${vitals.primary} / ${vitals.secondary}`, ...vitals.detail] : []),
      `JOB: ${operation.title}`,
      `OWNER: ${operation.owner}`,
      `MONITOR: ${operation.monitorKind.toUpperCase()}`,
      `ACTION: ${operation.primaryAction}`,
      `WATCH: ${operation.watches.slice(0, 3).join(" / ")}`,
      `REPORTS TO: ${operation.reportTo}`,
      `ALERTS: ${operation.alertRules.slice(0, 2).join(" / ")}`,
    ],
  };
}

function bathroomOccupied(npcs: LiveNpc[], excludingId: string) {
  return npcs.some((npc) => npc.id !== excludingId && isBathroomTile(npc.x, npc.y));
}

function breakRoomCount(npcs: LiveNpc[], excludingId?: string) {
  return npcs.filter((npc) => npc.id !== excludingId && isBreakRoomTile(npc.x, npc.y)).length;
}

function isBathroomTile(x: number, y: number) {
  const room = gen2Rooms.find((item) => item.id === "bath");
  if (!room) return false;
  return x >= room.x + 1 && x < room.x + room.w - 1 && y >= room.y + 1 && y < room.y + room.h - 1;
}

function isBreakRoomTile(x: number, y: number) {
  const room = gen2Rooms.find((item) => item.id === "break");
  if (!room) return false;
  return x >= room.x + 1 && x < room.x + room.w - 1 && y >= room.y + 1 && y < room.y + room.h - 1;
}


function spriteDialogFor(npc: LiveNpc, staff: GrowOpsStaff, incidentPhase: number, incidentTargetRoom: "rd1" | "rd2"): SpriteDialogMirrorState {
  const incident = incidentBubble(npc, incidentPhase, incidentTargetRoom);
  const mood = moodText(npc, staff);
  const line = incident ?? `${staff.currentAction}. Mood: ${mood}.`;
  return {
    title: staff.name.toUpperCase(),
    line,
    detail: `REPORTS TO: ${staff.reportTarget.toUpperCase()} · ROUTE ${npc.routeIndex + 1}/${Math.max(1, npc.route.length)}`,
    spriteRole: staff.role,
  };
}

function roomAt(x: number, y: number) {
  return gen2Rooms.find((room) => x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h);
}

// ---------------------------------------------------------------------------
// Facility walk mode helpers (see src/walk/)
// ---------------------------------------------------------------------------

type WalkState = { active: boolean; view: WalkView; full: boolean; pad: boolean | null; spawn: { x: number; y: number; dir: WalkDir } };

/** Rotation of the wall-clock hands in the top-down view (kept in step with the real time). */
function clockHandStyle(): CSSProperties {
  const date = new Date();
  const minutes = date.getMinutes() + date.getSeconds() / 60;
  return { "--clock-min": `${minutes * 6}deg`, "--clock-hour": `${(date.getHours() % 12) * 30 + minutes * 0.5}deg` } as CSSProperties;
}

/** Floor dressing the player's A button should look through. */
const WALK_IGNORED_PROPS = new Set<Gen2Prop["kind"]>(["decal", "mat", "rug", "plantTag"]);

/** The NPC walkable set minus the player's tile, so staff route around the visitor (cached per player tile). */
function walkableAvoiding(walkable: Set<string>, player: { x: number; y: number } | null, cache: { current: { key: string; set: Set<string> } | undefined }) {
  if (!player) return walkable;
  const key = tileKey(player.x, player.y);
  if (cache.current?.key !== key) {
    const set = new Set(walkable);
    set.delete(key);
    cache.current = { key, set };
  }
  return cache.current.set;
}

/** First free tile just inside the screening room's entrance (left door), falling back to the nearest free interior tile. */
function pickWalkSpawn(npcs: LiveNpc[], walkable: Set<string>): { x: number; y: number; dir: WalkDir } {
  const room = gen2Rooms.find((item) => item.id === "screen") ?? gen2Rooms[0];
  const occupied = new Set(npcs.map((npc) => tileKey(npc.x, npc.y)));
  const free = (x: number, y: number) => walkable.has(tileKey(x, y)) && !occupied.has(tileKey(x, y));
  const preferred = [[1, 5], [1, 6], [2, 5], [2, 6], [3, 5], [3, 6]];
  for (const [dx, dy] of preferred) if (free(room.x + dx, room.y + dy)) return { x: room.x + dx, y: room.y + dy, dir: "right" };
  const anchor = { x: room.x + 1, y: room.y + 5 };
  let best: { x: number; y: number } | undefined;
  let bestDistance = Infinity;
  for (let y = room.y + 1; y < room.y + room.h - 1; y += 1) {
    for (let x = room.x + 1; x < room.x + room.w - 1; x += 1) {
      const distance = Math.abs(x - anchor.x) + Math.abs(y - anchor.y);
      if (distance < bestDistance && free(x, y)) {
        best = { x, y };
        bestDistance = distance;
      }
    }
  }
  const spot = best ?? nearestWalkableGoal(anchor, walkable, 18) ?? anchor;
  return { x: spot.x, y: spot.y, dir: "right" };
}

const WALK_STAGE_COLUMN: Record<string, number> = { clone: 0, veg: 1, flower: 2, ripe: 3 };

/** Which plants.png cell the first-person view draws for a plant prop (mirrors the CSS classes PropView applies). */
function walkPlantLook(prop: Gen2Prop, life: LifeState | undefined, roomVitals: RoomVitals): WalkPlantLook {
  if (prop.kind === "cutPlant") return { col: 0, row: 3 };
  const lifeProp = lifePropState(prop, life, Date.now());
  if (lifeProp?.ownsLook && !lifeProp.stage) return "pot";
  const stage = lifeProp?.stage ?? plantStage(prop);
  const classes = lifeProp?.classes ?? "";
  const owns = !!lifeProp?.ownsLook;
  const offline = classes.includes("is-device-offline") || (!owns && !!prop.room && roomVitals[prop.room]?.online === false);
  const stressed = classes.includes("is-stressed-plant") || (!owns && isStressedPlant(prop, roomVitals));
  return { col: WALK_STAGE_COLUMN[stage] ?? 1, row: offline ? 2 : stressed ? 1 : 0 };
}

function staffSelection(npc: LiveNpc, staff?: GrowOpsStaff): Selection {
  const profile = staff ?? defaultGrowOpsStaff(npc);
  return {
    type: "staff",
    title: profile.name.toUpperCase(),
    lines: [
      `SEX: ${profile.sex}`,
      `AGE: ${profile.age}`,
      `WORK ETHIC: ${profile.workEthic}`,
      `TITLE: ${profile.title}`,
      `DEPT: ${profile.department}`,
      `MOOD: ${moodText(npc, profile)}`,
      `BLOCK: ${scheduleBlockText(npc, profile)}`,
      `NEXT BREAK: ${scheduleBlockFor(npc, profile).nextBreakLabel}`,
      `DOING: ${npcDoingLabel(npc)}`,
      `NEED: ${npcNeedHint(npc)}`,
      `ACTION: ${profile.currentAction}`,
      `REPORTS TO: ${profile.reportTarget}`,
      `TRAIT: ${profile.personality}`,
      `EVAL: ${profile.evaluation}`,
      `BREAKS: ${profile.breakPolicy}`,
    ],
  };
}

function propSelection(prop: Gen2Prop, roomVitals: RoomVitals): Selection {
  if (prop.kind === "monitor") {
    const monitor = monitorViewFor(prop, roomVitals);
    return { type: "equipment", title: monitor.title, lines: monitor.lines };
  }
  if (isPlant(prop)) {
    const growth = plantStage(prop);
    const title = prop.kind === "tray" ? "CLONE TRAY" : prop.kind === "cutPlant" ? "DRYING HARVEST" : prop.room === "mother" ? "MOTHER PLANT" : "CANNABIS PLANT";
    const stage = prop.kind === "cutPlant" ? "CURING" : PLANT_STAGE_LABEL[growth];
    return { type: "plant", title, lines: [`STAGE: ${stage}`, prop.kind === "cutPlant" ? "HUMIDITY: 54%" : "HEALTH: 94%", prop.kind === "cutPlant" ? "TRIM: QUEUED" : "WATER: NORMAL", prop.kind === "cutPlant" ? "AIRFLOW: ACTIVE" : "LIGHT: ACTIVE"] };
  }
  if (prop.kind === "crate") {
    const log = logPacketFor(prop);
    return { type: "equipment", title: `${log.department} LOG CRATE`, lines: [`TYPE: ${log.type}`, `WO RANGE: ${log.range}`, `LOGS: ${log.count}`, `LATEST: ${log.latest}`, `STATUS: ${log.status}`] };
  }
  if (prop.kind === "shelf") {
    const log = logPacketFor(prop);
    return { type: "equipment", title: `${log.department} SHELF`, lines: [`SORT: ${log.type}`, `LOGS: ${log.count}`, `LATEST: ${log.latest}`, `ROOM LINK: ${prop.room?.toUpperCase() ?? "FACILITY"}`, `STATUS: INDEXED`] };
  }
  return { type: "equipment", title: prop.kind.toUpperCase(), lines: [`TYPE: ${prop.kind.toUpperCase()}`, "POWER: ONLINE", prop.kind === "machine" || prop.kind === "terminal" ? "SIGNAL: STABLE" : "STATUS: READY", "MAINT: CLEAN"] };
}

function lifeSelectionToSelection(selection: LifeSelection): Selection {
  return selection;
}

function actionSelection(title: string, lines: string[]): Selection {
  return { type: "equipment", title, lines };
}

type PlantStage = "clone" | "veg" | "flower" | "ripe";

const PLANT_STAGE_LABEL: Record<PlantStage, string> = { clone: "CLONE", veg: "VEGETATIVE", flower: "FLOWERING", ripe: "RIPE - HARVEST READY" };

// Growth stage drawn for a cannabis pot, derived from the room it sits in (clone room -> clones,
// mother/grow 1 -> veg, grow 2/3 -> flowering, grow 4 -> ripe), with a little per-pot variety.
function plantStage(prop: Gen2Prop): PlantStage {
  const mix = (prop.x + prop.y) % 6 === 0;
  if (prop.kind === "tray" || prop.room === "clone") return "clone";
  if (prop.room === "grow2") return mix ? "veg" : "flower";
  if (prop.room === "grow3") return mix ? "ripe" : "flower";
  if (prop.room === "grow4") return mix ? "flower" : "ripe";
  return "veg";
}

// Extra classes that switch a prop from its CSS-drawn look to a sprite (see styles.css / propSprites.css).
function spriteClass(prop: Gen2Prop, stage?: PlantStage) {
  const w = prop.w ?? 1;
  const h = prop.h ?? 1;
  if (prop.kind === "cutPlant") return "has-plant plant-dry";
  if (prop.kind === "plant" || prop.kind === "plantBed" || prop.kind === "tray") {
    return `has-plant plant-${stage ?? plantStage(prop)} ${(prop.x + prop.y) % 4 >= 2 ? "plant-flip" : ""}`;
  }
  if (prop.kind === "desk" || prop.kind === "table" || prop.kind === "trimTable") return "has-frame spr-desk";
  if (prop.kind === "shelf") return "has-frame spr-shelf";
  if (prop.kind === "rack" && w >= 2) return "has-frame spr-rack";
  if (prop.kind === "whiteboard") return "has-frame spr-screen";
  if (prop.kind === "chair") return "has-sprite spr-chair";
  if (prop.kind === "sink") return "has-sprite spr-sink";
  if (prop.kind === "vat") return "has-sprite spr-vat";
  if (prop.kind === "machine" && w >= 3 && h >= 3) return "has-sprite spr-machine";
  return "";
}

function isPlant(prop: Gen2Prop) {
  return prop.kind === "plant" || prop.kind === "plantBed" || prop.kind === "tray" || prop.kind === "cutPlant";
}

function logPacketFor(prop: Gen2Prop) {
  const warehouseDepartments = ["BOSS", "CULTIVATION", "PROCESSING", "R&D", "SECURITY", "SALES", "LOGISTICS", "SYSTEM"];
  const dockDepartments = ["LOADING", "DOWNLOADS", "UPDATES", "INSTALLS", "PACKAGING", "PENDING"];
  if (prop.room === "sales") return { department: "SALES", count: 12, type: "SALES ROOM REFERENCE", range: "SALES-MAUI", latest: "DEVICE SHEET", status: "READY" };
  if (prop.room === "rd2") return { department: "R&D", count: 8, type: "MODEL TEST NOTES", range: "RD-TERM", latest: "TERMINAL BRIEF", status: "INDEXED" };
  const list = prop.room === "dock" ? dockDepartments : warehouseDepartments;
  const index = Math.abs((prop.x * 7 + prop.y * 11) % list.length);
  const department = list[index];
  const count = 6 + ((prop.x + prop.y) % 19);
  return {
    department,
    count,
    type: prop.room === "dock" ? "IN-PROCESS LOGS" : "ROOM REPORT ARCHIVE",
    range: `WO-${2400 + prop.x}-${2400 + prop.x + count}`,
    latest: prop.room === "dock" ? "BUILDING NOW" : "HOURLY REPORT",
    status: prop.room === "dock" ? "LOADING" : "READY",
  };
}

function isStressedPlant(prop: Gen2Prop, roomVitals: RoomVitals) {
  return isPlant(prop) && !!prop.room && ["WATCH", "ALERT"].includes(roomVitals[prop.room]?.status ?? "");
}

function environmentClass(prop: Gen2Prop, roomVitals: RoomVitals, incidentPhase: number, incidentTargetRoom: "rd1" | "rd2") {
  if (!prop.room) return "";
  const vital = roomVitals[prop.room];
  if (prop.kind === "growLight") return vital?.online === false ? "is-light-off" : "is-light-on";
  if (prop.kind === "irrigation") {
    if (vital?.online === false) return "irrigation-offline";
    if ((vital?.memoryPercent ?? 0) >= 75) return "irrigation-high";
    if ((vital?.memoryPercent ?? 50) <= 35) return "irrigation-low";
    return "irrigation-normal";
  }
  if (prop.kind === "monitor" && (prop.room === "security" || prop.room === "boss")) {
    const view = prop.room === "security" ? securityMonitorViewFor(prop) : bossMonitorViewFor(prop);
    const hasWarning = view?.rooms.some((roomId) => ["WATCH", "ALERT"].includes(roomVitals[roomId]?.status ?? "")) ?? false;
    const monitoredRooms: readonly string[] = view?.rooms ?? [];
    const hasIncident = monitoredRooms.includes(incidentTargetRoom) && incidentPhase >= 13 && incidentPhase <= 15;
    if (prop.room === "security" && monitoredRooms.length === 0) return "is-monitor-off";
    return hasWarning || hasIncident ? "is-monitor-alert" : "";
  }
  if (isPlant(prop) && vital?.online === false) return "is-device-offline";
  return "";
}

function productionClass(prop: Gen2Prop, phase: number, incidentPhase: number, incidentTargetRoom: "rd1" | "rd2") {
  if (prop.kind === "plantBed" && prop.room?.startsWith("grow") && (prop.x + prop.y) % 5 === phase % 5) return phase % 2 ? "is-harvesting" : "is-open-pot";
  if (prop.kind === "cutPlant" && prop.room === "soil") return phase === 1 || phase === 2 ? "is-drying-active" : "";
  if (prop.kind === "cutPlant" && prop.room === "trim") return phase === 2 || phase === 3 ? "is-trim-active" : "";
  if (prop.kind === "conveyor" || (prop.kind === "crate" && prop.room === "pack")) return phase === 3 || phase === 4 ? "is-package-active" : "";
  if (prop.kind === "crate" && (prop.room === "dock" || prop.room === "warehouse")) return phase === 4 || phase === 5 ? "is-delivery-active" : "";
  if (prop.kind === "experiment" && prop.room === incidentTargetRoom && incidentPhase >= 13 && incidentPhase <= 14) return "is-fire-incident";
  if (prop.kind === "experiment" && prop.room === incidentTargetRoom && incidentPhase === 15) return "is-experiment-event";
  return "";
}

function buildLiveRoomVitals(hostStats?: HostStats, dockerStats?: DockerStats, ollamaModels?: OllamaModels, facilityDevices?: FacilityDevices, lifecycle?: LifecycleSnapshot): RoomVitals {
  const vitals: RoomVitals = { ...gen2RoomVitals };
  if (hostStats) {
    const cpu = hostStats.cpu.usedPercent;
    const ram = hostStats.memory.usedPercent;
    const status = cpu >= 90 || ram >= 92 ? "ALERT" : cpu >= 75 || ram >= 82 ? "WATCH" : cpu >= 55 || ram >= 65 ? "BUSY" : "OK";
    const uptimeHours = Math.floor(hostStats.uptimeSeconds / 3600);
    vitals.mother = {
      status,
      primary: `NUKEBOX ${cpu}%`,
      secondary: `RAM ${ram}%`,
      online: true,
      memoryPercent: ram,
      deviceName: "NukeBox",
      detail: [
        `DEVICE: NUKEBOX / ${hostStats.hostname}`,
        `CORES: ${hostStats.cpu.cores}`,
        `SPEED: ${hostStats.cpu.speedMHz}MHZ`,
        `MEM: ${formatBytes(hostStats.memory.usedBytes)} / ${formatBytes(hostStats.memory.totalBytes)}`,
        `UPTIME: ${uptimeHours}H`,
        `TEMP: ${hostStats.sensors.temperatureC ?? "N/A"}`,
        `FAN: ${hostStats.sensors.fanRpm ?? "N/A"}`,
      ],
    };
  }
  const devices = new Map((facilityDevices?.devices ?? []).map((device) => [device.roomId, device]));
  vitals.mother = deviceRoomVital(devices.get("mother"), "NUKEBOX");
  vitals.clone = deviceRoomVital(devices.get("clone"), "HP LAPTOP");
  vitals.grow1 = deviceRoomVital(devices.get("grow1"), "BAK3RY");
  vitals.grow2 = deviceRoomVital(devices.get("grow2"), "HACK-SAFE");
  vitals.grow3 = waitingDeviceVital("PI3 / DEVICE PENDING");
  vitals.grow4 = waitingDeviceVital("GROW ROOM 4 / DEVICE PENDING");
  vitals.vmCreations = deviceRoomVital(devices.get("vmCreations"), "CAK3D-CREATIONS");
  vitals.soil = deviceRoomVital(devices.get("soil"), "THE GARDEN");
  if (dockerStats) {
    vitals.ops = {
      status: dockerStats.available ? (dockerStats.running > 0 ? "BUSY" : "OK") : "WATCH",
      primary: dockerStats.available ? `DOCKER ${dockerStats.running}` : "DOCKER OFF",
      secondary: dockerStats.available ? "CONTAINERS" : "DAEMON N/A",
      detail: dockerStats.available
        ? dockerStats.containers.slice(0, 5).map((container) => `${container.name || container.id}: ${container.cpuPercent} / ${container.memoryPercent}`)
        : [`ERROR: ${dockerStats.error ?? "DOCKER UNAVAILABLE"}`],
    };
  }
  if (ollamaModels) {
    vitals.rd1 = {
      status: ollamaModels.available ? "OK" : "WATCH",
      primary: ollamaModels.available ? "OLLAMA UP" : "OLLAMA OFF",
      secondary: `MODELS ${ollamaModels.models.length}`,
      detail: ollamaModels.available
        ? ollamaModels.models.slice(0, 6).map((model) => `${model.name}: ${modelDetail(model, "parameter_size") ?? formatBytes(model.size)}`)
        : [`ERROR: ${ollamaModels.error ?? "OLLAMA UNAVAILABLE"}`],
    };
    vitals.rd2 = {
      status: ollamaModels.available ? "OK" : "WATCH",
      primary: `TERMINALS ${Math.min(5, Math.max(ollamaModels.models.length, 0))}`,
      secondary: ollamaModels.available ? "CHAT READY" : "NO MODELS",
      detail: ollamaModels.models.slice(0, 5).map((model, index) => `T${index + 1}: ${model.name}`),
    };
  }
  if (lifecycle) {
    // Lifecycle text goes next to the device telemetry; rooms without a telemetry device get it as their vitals.
    for (const [roomId, life] of Object.entries(lifeVitals(lifecycle))) {
      const base = vitals[roomId];
      if (life.replace || !base) {
        vitals[roomId] = { ...(base ?? { status: "OK", primary: "", secondary: "", detail: [] }), status: life.status, primary: life.primary, secondary: life.secondary, detail: life.detail, lifePhase: life.phase };
      } else {
        vitals[roomId] = { ...base, lifePrimary: life.primary, lifeSecondary: life.secondary, lifeDetail: life.detail, lifePhase: life.phase };
      }
    }
  }
  return vitals;
}

function deviceRoomVital(device: FacilityDeviceTelemetry | undefined, deviceName: string): LiveRoomVital {
  if (!device || !device.online) {
    return {
      status: "WATCH",
      primary: `${deviceName} OFF`,
      secondary: device?.stale ? "STALE FEED" : "NO FEED",
      online: false,
      memoryPercent: device?.memoryPercent,
      deviceName,
      detail: [
        `DEVICE: ${deviceName}`,
        `STATUS: ${device?.note?.toUpperCase() ?? "WAITING FOR TELEMETRY"}`,
        `LAST: ${formatSampleTime(device?.sampledAt)}`,
        "LIGHTS: OFF",
        "IRRIGATION: IDLE",
      ],
    };
  }
  const cpu = device.cpuPercent ?? 0;
  const ram = device.memoryPercent ?? 0;
  const status = cpu >= 90 || ram >= 92 ? "ALERT" : cpu >= 75 || ram >= 82 ? "WATCH" : cpu >= 55 || ram >= 65 ? "BUSY" : "OK";
  return {
    status,
    primary: `${deviceName} ${Math.round(cpu)}%`,
    secondary: `RAM ${Math.round(ram)}%`,
    online: true,
    memoryPercent: ram,
    deviceName,
    detail: [
      `HOST: ${device.hostname}`,
      `TEMP: ${device.temperatureC === null ? "N/A" : `${device.temperatureC}C`}`,
      `CPU: ${cpu}% / ${device.speedMHz ?? "N/A"}MHZ`,
      `RAM: ${ram}% / ${device.totalMemoryBytes ? formatBytes(device.totalMemoryBytes) : "N/A"}`,
      `SWAP: ${device.swapPercent ?? "N/A"}%`,
      `PING: ${device.pingMs ?? "N/A"}MS`,
      `LIGHTS: ON / WATER: ${irrigationLabel(ram)}`,
    ],
  };
}

function waitingDeviceVital(deviceName: string): LiveRoomVital {
  return {
    status: "WATCH",
    primary: deviceName.includes("GROW ROOM 4") ? "GROW4 WAITING" : "PI3 WAITING",
    secondary: "NO DEVICE",
    online: false,
    memoryPercent: null,
    deviceName,
    detail: [`DEVICE: ${deviceName}`, "TELEMETRY: NOT ASSIGNED", "LIGHTS: OFF", "IRRIGATION: IDLE"],
  };
}

function irrigationLabel(memoryPercent: number) {
  if (memoryPercent >= 75) return "HIGH";
  if (memoryPercent <= 35) return "LOW";
  return "NORMAL";
}

function formatSampleTime(sampledAt?: string | null) {
  if (!sampledAt) return "NONE RECEIVED";
  return new Date(sampledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function monitorViewFor(prop: Gen2Prop, roomVitals: RoomVitals) {
  if (prop.room === "boss") {
    const view = bossMonitorViewFor(prop);
    if (!view) return { title: "BOSS MONITOR", lines: ["STATUS: OFFLINE"] };
    const statuses = view.rooms.map((roomId) => roomVitals[roomId]?.status ?? "OK");
    const watchCount = statuses.filter((status) => status !== "OK").length;
    return {
      title: view.title,
      lines: [
        `VIEW: ${view.rooms.length} ROOMS`,
        `STATUS: ${watchCount ? "REVIEW NEEDED" : "STEADY"}`,
        `WATCH: ${watchCount}`,
        ...view.rooms.slice(0, 4).map((roomId) => `${roomLabel(roomId)}: ${roomVitals[roomId]?.primary ?? "ONLINE"}`),
      ],
    };
  }

  if (prop.room === "security") {
    const view = securityMonitorViewFor(prop) ?? SECURITY_MONITOR_VIEWS[0];
    if (view.rooms.length === 0) {
      return { title: "SPARE CAMERA", lines: ["ROOM: UNASSIGNED", "STATUS: OFF", "PRIMARY: NO FEED", "SECONDARY: RESERVED"] };
    }
    const warning = view.rooms.map((roomId) => roomVitals[roomId]).find((vital) => vital && vital.status !== "OK");
    const vitals = warning ?? roomVitals[view.rooms[0]];
    return {
      title: `${view.title} CAMERA`,
      lines: [
        `ROOM: ${view.title}`,
        `STATUS: ${vitals?.status ?? "OK"}`,
        `PRIMARY: ${vitals?.primary ?? "ONLINE"}`,
        `SECONDARY: ${vitals?.secondary ?? "CLEAR"}`,
        ...(vitals?.detail.slice(0, 3) ?? ["CAMERA: ACTIVE"]),
      ],
    };
  }

  return { title: "FACILITY MONITOR", lines: ["VIEW: ONLINE", "STATUS: READY", "SIGNAL: STABLE"] };
}

function securityMonitorViewFor(prop: Gen2Prop) {
  if (prop.room !== "security") return undefined;
  const column = Math.max(0, Math.round((prop.x - 97) / 2));
  const row = Math.max(0, Math.round((prop.y - 3) / 2));
  return SECURITY_MONITOR_VIEWS[row * 4 + column];
}

function bossMonitorViewFor(prop: Gen2Prop) {
  if (prop.room !== "boss") return undefined;
  const bossViews = [
    { title: "PROCESSING MANAGER", rooms: ["ops", "trim", "pack", "extract"] },
    { title: "CULTIVATION MANAGER", rooms: ["cultMgr", "clone", "mother", "grow1", "grow2", "grow3", "grow4", "potting"] },
    { title: "VM ROOMS", rooms: ["vmCreations", "soil", "rd2"] },
    { title: "SALES MONITOR", rooms: ["sales"] },
    { title: "R&D MONITOR", rooms: ["rd1", "rd2"] },
    { title: "WAREHOUSE MONITOR", rooms: ["dock", "warehouse"] },
  ] as const;
  const index = Math.max(0, Math.min(4, Math.round((prop.x - 4) / 2)));
  return bossViews[index];
}

function modelTerminalFor(prop: Gen2Prop, ollamaModels?: OllamaModels) {
  const terminalIndex = rd2TerminalKeys.indexOf(`${prop.room}-${prop.x}-${prop.y}`);
  if (terminalIndex < 0) return undefined;
  const model = ollamaModels?.models[terminalIndex];
  if (!model) {
    return {
      title: `R&D MODEL SLOT ${terminalIndex + 1}`,
      model: `ollama-slot-${terminalIndex + 1}`,
      detail: ollamaModels?.available ? "EMPTY MODEL SLOT" : "OLLAMA MODEL LIST UNAVAILABLE",
    };
  }
  return {
    title: `R&D ${model.name}`,
    model: model.model,
    detail: `${modelDetail(model, "parameter_size") ?? formatBytes(model.size)} / ${modelDetail(model, "quantization_level") ?? "QUANT N/A"}`,
  };
}

function modelDetail(model: OllamaModels["models"][number], key: string) {
  const value = model.details?.[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
}

function roomLabel(roomId: string) {
  return gen2Rooms.find((room) => room.id === roomId)?.label ?? roomId.toUpperCase();
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${Math.round(bytes / 1024 ** 3)}GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)}MB`;
  return `${bytes}B`;
}

function moodText(npc: LiveNpc, staff?: GrowOpsStaff) {
  const profile = staff ?? gen2WorkerProfiles[npc.id];
  if (profile) return npc.pause > 0 ? profile.steadyMood : profile.busyMood;
  if (npc.role === "security") return "WATCHING";
  if (npc.role === "cultivation") return "CHECKING PLANTS";
  if (npc.role === "science") return "FOCUSED";
  if (npc.role === "logistics") return "BUSY";
  return npc.pause > 0 ? "THINKING" : "WORKING";
}

function moodBubble(npc: LiveNpc, staff?: GrowOpsStaff) {
  const profile = staff ?? gen2WorkerProfiles[npc.id];
  if (profile) return profile.steadyMood.slice(0, 3);
  if (npc.role === "security") return "!";
  if (npc.role === "cultivation") return "OK";
  if (npc.role === "science") return "?";
  if (npc.role === "logistics") return "...";
  if (npc.role === "boss") return "...";
  return "";
}

function incidentBubble(npc: LiveNpc, incidentPhase: number, incidentTargetRoom: "rd1" | "rd2") {
  if (npc.id === "security" && incidentPhase === 14) return incidentTargetRoom === "rd1" ? "R&D LAB FIRE!" : "R&D TEST FIRE!";
  if (npc.id === "researcher" && incidentPhase === 14) return "ON IT!";
  return undefined;
}

function visibleCargo(npc: LiveNpc, incidentPhase: number): Gen2Npc["cargo"] | TaskCargo | undefined {
  if (npc.sim?.task?.carrying) return npc.sim.task.carrying;
  if (npc.id === "researcher") {
    if (incidentPhase === 14) return "extinguisher";
    return [1, 2].includes(npc.routeIndex) ? "extract" : undefined;
  }
  if (npc.id === "rdSafety") return undefined;
  if (npc.id === "extractor") {
    if (npc.routeIndex === 1) return "package";
    if (npc.routeIndex === 3) return "extract";
    return undefined;
  }
  const deliveryLegs: Record<string, number[]> = {
    motherWorker: [1, 2, 3],
    cloneWorker: [1, 2, 3],
    growWorker: [1, 2],
    grow2Worker: [2],
    grow3Worker: [1, 2],
    grow4Worker: [2],
    pottingWorker: [1, 3],
    soilWorker: [2, 3, 4],
    processor: [1],
    packer: [1],
    opsManager: [1, 2],
    cultManager: [2],
    logistics: [2],
    salesRep: [4],
  };
  return npc.cargo && deliveryLegs[npc.id]?.includes(npc.routeIndex) ? npc.cargo : undefined;
}

type WorkerSig = { room?: string; errand?: ErrandKind; chat?: string; task?: string; carry?: string; trip: boolean; crit: boolean };

function workerSig(npc: LiveNpc, crit: boolean): WorkerSig {
  const sim = npc.sim;
  const errand = sim?.errand;
  return {
    room: roomAt(npc.x, npc.y)?.label,
    errand: errand && errand.stage === "use" && errand.kind !== "work" ? errand.kind : undefined,
    chat: sim?.chat ? (gen2WorkerIdentity[sim.chat.with]?.name ?? humanizeNpcId(sim.chat.with)) : undefined,
    task: sim?.task?.label,
    carry: sim?.task?.carrying,
    trip: sim?.mode === "trip",
    crit,
  };
}

const ERRAND_PAST: Partial<Record<ErrandKind, string>> = {
  coffee: "grabbed a coffee at the coffee machine",
  water: "refilled a water bottle",
  fridge: "raided the break room fridge for a snack",
  microwave: "heated up some lunch in the microwave",
  bathroom: "made a restroom stop",
  sit: "sat down for a short rest",
  phone: "checked their phone on a break",
  desk: "typed up some notes at a desk",
  seek: "went looking for company",
  leave: "clocked out and headed for the exit",
};

function diffWorkerSig(prev: WorkerSig | undefined, next: WorkerSig): string[] {
  if (!prev) return [];
  const out: string[] = [];
  if (next.crit && !prev.crit) out.push("responded to the facility alarm");
  if (next.errand && next.errand !== prev.errand) out.push(`${ERRAND_PAST[next.errand] ?? "took a short break"}${next.room ? ` (${next.room})` : ""}`);
  if (next.chat && next.chat !== prev.chat) out.push(`chatted with ${next.chat}`);
  if (next.task && next.task !== prev.task) out.push(`started the lifecycle job: ${next.task}`);
  if (prev.task && !next.task) out.push(`finished the lifecycle job: ${prev.task}`);
  if (next.carry && next.carry !== prev.carry) out.push(`picked up ${next.carry} cargo`);
  if (prev.carry && !next.carry) out.push(`delivered the ${prev.carry} cargo`);
  if (next.trip && !prev.trip) out.push("set off on a handoff round between rooms");
  if (prev.trip && !next.trip) out.push("finished a handoff round");
  if (next.room && next.room !== prev.room) out.push(`walked into ${next.room}`);
  return out;
}

/** Workers the player is talking to right now (id -> facing). advanceNpc holds them still until the conversation ends. */
const TALK_HOLD = new Map<string, Gen2Direction>();

const ERRAND_TAGS: Record<ErrandKind, string> = { coffee: "COF", water: "H2O", fridge: "YUM", microwave: "BZZ", bathroom: "", sit: "ZZ", phone: "TXT", desk: "TYP", seek: "", work: "", leave: "SEE YA!" };

const ERRAND_LABELS: Record<ErrandKind, [string, string]> = {
  coffee: ["HEADING FOR COFFEE", "POURING COFFEE"],
  water: ["HEADING FOR WATER", "REFILLING WATER"],
  fridge: ["HEADING FOR A SNACK", "RAIDING THE FRIDGE"],
  microwave: ["HEADING TO MICROWAVE", "HEATING LUNCH"],
  bathroom: ["HEADING TO RESTROOM", "IN THE RESTROOM"],
  sit: ["LOOKING FOR A CHAIR", "RESTING IN A CHAIR"],
  phone: ["LOOKING FOR A CHAIR", "CHECKING PHONE"],
  desk: ["GOING TO DESK", "TYPING AT DESK"],
  seek: ["LOOKING FOR COMPANY", "LOOKING FOR COMPANY"],
  work: ["WALKING TO STATION", "WORKING AT STATION"],
  leave: ["HEADING OUT FOR THE DAY", "SAYING GOODNIGHT"],
};

function scheduleBlockFor(npc: LiveNpc, staff?: GrowOpsStaff) {
  const schedule = staff?.schedule ?? gen2DefaultSchedule(npc.id, staff?.department ?? gen2WorkerProfiles[npc.id]?.department ?? humanizeNpcId(npc.role));
  const abs = Math.floor(Date.now() / 60000);
  const minute = clockMinuteNow();
  const block = gen2ScheduleBlock(schedule, minute, !!npc.sim && npc.sim.breakUntil > abs);
  return npc.id === "boss" ? { ...block, nextBreakLabel: "NONE (STAYS IN OFFICE)" } : block;
}

function scheduleBlockText(npc: LiveNpc, staff?: GrowOpsStaff) {
  const block = scheduleBlockFor(npc, staff);
  return `${block.kind} (${block.label})`;
}

function npcDoingLabel(npc: LiveNpc) {
  const sim = npc.sim;
  if (sim?.chat) return `CHATTING WITH ${npcName(sim.chat.with).toUpperCase()}`;
  if (sim?.errand?.party) return sim.errand.stage === "use" ? "AT A BIRTHDAY GATHERING IN THE BREAK ROOM" : "HEADING TO A BIRTHDAY GATHERING";
  if (sim?.errand?.kind === "work" && sim.errand.stage === "use" && sim.errand.seat) return "WORKING AT DESK";
  if (sim?.errand) return ERRAND_LABELS[sim.errand.kind][sim.errand.stage === "use" ? 1 : 0];
  if (sim?.mode === "trip") return npc.pause > 0 ? "AT HANDOFF STOP" : "ON A DELIVERY TRIP";
  return npc.pause > 0 ? "PAUSED AT STOP" : "ON ROUTE DUTY";
}

function npcNeedHint(npc: LiveNpc) {
  const needs = npc.sim?.needs;
  if (!needs) return "CONTENT";
  const ranked: Array<[number, string]> = [
    [needs.bladder, "NEEDS RESTROOM"],
    [needs.energy, "TIRED / WANTS COFFEE"],
    [needs.hunger, "HUNGRY / THIRSTY"],
    [needs.social, "WANTS TO CHAT"],
  ];
  const top = ranked.sort((a, b) => b[0] - a[0])[0];
  return top[0] >= 60 ? top[1] : top[0] >= 40 ? `MILD: ${top[1]}` : "CONTENT";
}

function npcActivity(npc: LiveNpc) {
  if (isBreakRoomTile(npc.x, npc.y) || isBathroomTile(npc.x, npc.y)) return "resting";
  if (npc.pause > 0) return "idle";
  if (npc.role === "boss" || npc.role === "secretary") return "idle";
  return "busy";
}

function roomOfflineClass(room: Gen2Room, roomVitals: RoomVitals) {
  const vital = roomVitals[room.id];
  if (vital?.lifePhase && ["sterilizing", "cleaning", "sterile"].includes(vital.lifePhase)) return "is-room-sterile";
  return vital?.online === false ? "is-room-offline" : "";
}

function floorFor(room: Gen2Room) {
  if (room.kind === "boss") return "wood";
  if (room.kind === "break" || room.kind === "bathroom") return "blue";
  if (room.kind === "security" || room.kind === "warehouse" || room.kind === "extraction" || room.kind === "vm") return "grey";
  return "lab";
}

function rect(item: { x: number; y: number; w: number; h: number }) {
  return { left: item.x * GEN2_TILE, top: item.y * GEN2_TILE, width: item.w * GEN2_TILE, height: item.h * GEN2_TILE };
}

function doorStyle(room: Gen2Room, door: Gen2Room["doors"][number]) {
  const size = (door.size ?? 2) * GEN2_TILE;
  if (door.side === "top") return { left: door.at * GEN2_TILE, top: -GEN2_TILE / 2, width: size, height: GEN2_TILE * 1.4 };
  if (door.side === "bottom") return { left: door.at * GEN2_TILE, bottom: -GEN2_TILE / 2, width: size, height: GEN2_TILE * 1.4 };
  if (door.side === "left") return { left: -GEN2_TILE / 2, top: door.at * GEN2_TILE, width: GEN2_TILE * 1.4, height: size };
  return { right: -GEN2_TILE / 2, top: door.at * GEN2_TILE, width: GEN2_TILE * 1.4, height: size };
}
