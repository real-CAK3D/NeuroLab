import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  GEN2_H,
  GEN2_TILE,
  GEN2_W,
  gen2Hallways,
  gen2Npcs,
  gen2Props,
  gen2Rooms,
  type Gen2Direction,
  type Gen2Npc,
  type Gen2NpcRole,
  type Gen2Prop,
  type Gen2Room,
} from "../game/gen2FacilityData";
import { gen2BossHotKeys, gen2PerformanceBriefs, gen2ReportLogPath, gen2RoomOperations, gen2RoomVitals, gen2WorkerIdentity, gen2WorkerProfiles, type Gen2RoomVital } from "../game/gen2OperationsData";
import type { Gen2HotKey } from "../game/gen2OperationsData";
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
  kind: "packaging" | "extraction" | "research" | "test" | "sales" | "manager";
  message: string;
};

type ActivityState = {
  tick: number;
  phaseLabel: string;
  inventory: ActivityInventory;
  feed: ActivityEvent[];
};

type LiveNpc = Gen2Npc & {
  routeIndex: number;
  stepFrame: 0 | 1 | 2;
  pause: number;
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
};

type RoomVitals = Record<string, LiveRoomVital>;

const worldWidth = GEN2_W * GEN2_TILE;
const worldHeight = GEN2_H * GEN2_TILE;
const MOVEMENT_TICK_MS = 430;
const NPC_STORAGE_KEY = "gen2-facility-npcs-v4";
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
  const [productionPhase, setProductionPhase] = useState(0);
  const [incidentPhase, setIncidentPhase] = useState(0);
  const [incidentTargetRoom, setIncidentTargetRoom] = useState<"rd1" | "rd2">("rd1");
  const [npcs, setNpcs] = useState<LiveNpc[]>(() => loadPersistedNpcs());
  const [staff, setStaff] = useState<Record<string, GrowOpsStaff>>(() => loadGrowOpsStaff());
  const [vacantDuties, setVacantDuties] = useState<VacantDuty[]>(() => loadVacantDuties());
  const walkable = useMemo(() => buildWalkable(), []);
  const focusedRoom = focusedRoomId ? gen2Rooms.find((room) => room.id === focusedRoomId) : undefined;
  const staffBattleNpc = staffBattleId ? npcs.find((npc) => npc.id === staffBattleId) : undefined;
  const roomVitals = useMemo(() => buildLiveRoomVitals(hostStats, dockerStats, ollamaModels, facilityDevices), [hostStats, dockerStats, ollamaModels, facilityDevices]);
  const [activityState, setActivityState] = useState<ActivityState>(() => loadPersistedActivityState(npcs));
  const previousNpcRoomsRef = useRef<Record<string, string | undefined>>(roomMapForNpcs(npcs));

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

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNpcs((current) => advanceAllNpcs(current, walkable));
    }, MOVEMENT_TICK_MS);
    return () => window.clearInterval(interval);
  }, [walkable]);

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
    if (arrivals.length) {
      setActivityState((current) => advanceActivityState(current, arrivals, productionPhase, incidentPhase));
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

  function openRoom(room: Gen2Room) {
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
    <section className="mx-auto max-w-[1430px] px-4 pb-8">
      <div className="gb-shell">
        <div className="gb-topbar">
          <div>
            <h2>GEN 2 FACILITY MAP</h2>
            <span>RETRO OVERWORLD DASHBOARD</span>
          </div>
          <div className="gb-stats">
            <span>{gen2Rooms.length} ROOMS</span>
            <span>{npcs.length} STAFF</span>
            <span>{Object.keys(gen2RoomOperations).length} JOBS</span>
            <span>{focusedRoom ? "ROOM VIEW" : "FULL VIEW"}</span>
          </div>
        </div>

        <div ref={viewportRef} className={`gen2-viewport ${focusedRoom ? "is-detail" : ""}`} onClick={() => setContextMenu(undefined)} onContextMenu={(event) => event.preventDefault()}>
          {!focusedRoom ? (
            <div className="gen2-board" style={{ width: worldWidth, height: worldHeight, transform: `translate(${fitPan.x}px, ${fitPan.y}px) scale(${fitZoom})` }}>
              {gen2Hallways.map((hall, index) => (
                <HallView key={`hall-${index}`} hall={hall} />
              ))}
              {gen2Rooms.map((room) => (
                <RoomView key={room.id} room={room} roomVitals={roomVitals} onOpen={openRoom} onGrowOps={() => openGrowOps("staff")} onFacilityEditor={() => openGrowOps("facility")} onSelect={setSelection} onContextMenu={openContextMenu} />
              ))}
              {gen2Props.map((prop, index) => (
                <PropView key={`${prop.kind}-${index}`} prop={prop} roomVitals={roomVitals} productionPhase={productionPhase} incidentPhase={incidentPhase} incidentTargetRoom={incidentTargetRoom} onSelect={setSelection} onContextMenu={openContextMenu} onTerminalOpen={openTerminal} onFacilityEditor={() => openGrowOps("facility")} />
              ))}
              {npcs.map((npc) => (
                <NpcView key={npc.id} npc={npc} staff={staff[npc.id]} incidentPhase={incidentPhase} incidentTargetRoom={incidentTargetRoom} selected={staffBattleId === npc.id} onSelect={setSelection} onStaffOpen={openStaffBattle} onStaffEdit={(npc) => openGrowOps("staff", npc.id)} onContextMenu={openContextMenu} />
              ))}
              <RoutePathOverlay npc={npcs.find((item) => item.id === highlightRouteId)} />
            </div>
          ) : (
            <RoomDetail room={focusedRoom} npcs={npcs} staff={staff} roomVitals={roomVitals} productionPhase={productionPhase} incidentPhase={incidentPhase} incidentTargetRoom={incidentTargetRoom} selectedNpcId={staffBattleId} onBack={closeRoom} onGrowOps={() => openGrowOps("staff")} onFacilityEditor={() => openGrowOps("facility")} onSelect={setSelection} onStaffOpen={openStaffBattle} onStaffEdit={(npc) => openGrowOps("staff", npc.id)} onContextMenu={openContextMenu} onTerminalOpen={openTerminal} highlightedRouteId={highlightRouteId} />
          )}
          {contextMenu ? <ContextMenu menu={contextMenu} onClose={() => setContextMenu(undefined)} /> : null}
          {terminalSession ? <TerminalPanel session={terminalSession} onClose={() => setTerminalSession(undefined)} /> : null}
          {dialog ? <PokemonDialog dialog={dialog} onChoose={chooseDialogOption} onHover={(index) => setDialog((current) => current ? { ...current, selectedIndex: index } : current)} /> : null}
          {growOpsOpen ? <GrowOpsPanel initialTab={growOpsInitialTab} focusStaffId={growOpsFocusStaffId} npcs={npcs} staff={staff} vacantDuties={vacantDuties} onClose={() => setGrowOpsOpen(false)} onSave={saveGrowOpsStaff} onRemove={removeGrowOpsStaff} onRestoreStaff={(nextStaff) => setStaff(Object.fromEntries(Object.entries(nextStaff).map(([id, item]) => [id, cleanGrowOpsStaff({ ...(item as GrowOpsStaff), id })])))} onPreviewRoute={(id) => { setHighlightRouteId(id); setStaffBattleId(id); }} onClearRoutePreview={() => setHighlightRouteId(undefined)} /> : null}
        </div>

        <div className="gen2-info-row">
          <div className="gen2-message-stack">
            <div className="gb-message">
              {focusedRoom ? "RIGHT-CLICK STAFF, PLANTS, COMPUTERS, OR EQUIPMENT FOR QUICK ACTIONS." : "RIGHT-CLICK A ROOM TO ZOOM INTO AN EXPLODED VIEW OR OPEN QUICK ACTIONS."}
            </div>
            {staffBattleNpc ? <WorkerBattlePanel npc={staffBattleNpc} staff={staff[staffBattleNpc.id]} mirror={spriteDialogMirror} onRouteView={() => setHighlightRouteId(staffBattleNpc.id)} onClose={() => { setStaffBattleId(undefined); setHighlightRouteId(undefined); }} docked /> : null}
          </div>
          <OperationsDeck activityState={activityState} activityStatus={activitySnapshotStatus} activityHistoryCount={activityHistoryCount} isSavingActivity={isSavingActivity} onHotKey={openHotKeyDialog} onSaveActivity={saveActivityCheckpoint} onUndoActivity={undoActivityCheckpoint} />
          <SelectionCard selection={selection} />
        </div>
      </div>
    </section>
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
  onSaveActivity,
  onUndoActivity,
}: {
  activityState: ActivityState;
  activityStatus: string;
  activityHistoryCount: number;
  isSavingActivity: boolean;
  onHotKey: (hotKey: Gen2HotKey) => void;
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
        <em className="activity-engine-subtitle">Route arrivals now mutate inventory and feed entries.</em>
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

function GrowOpsPanel({
  initialTab = "staff",
  focusStaffId,
  npcs,
  staff,
  vacantDuties,
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
  }

  function setField<K extends keyof GrowOpsStaff>(key: K, value: GrowOpsStaff[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
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
  productionPhase,
  incidentPhase,
  incidentTargetRoom,
  selectedNpcId,
  onBack,
  onGrowOps,
  onFacilityEditor,
  onSelect,
  onStaffOpen,
  onStaffEdit,
  onContextMenu,
  onTerminalOpen,
  highlightedRouteId,
}: {
  room: Gen2Room;
  npcs: LiveNpc[];
  staff: Record<string, GrowOpsStaff>;
  roomVitals: RoomVitals;
  productionPhase: number;
  incidentPhase: number;
  incidentTargetRoom: "rd1" | "rd2";
  selectedNpcId?: string;
  onBack: () => void;
  onGrowOps: () => void;
  onFacilityEditor: () => void;
  onSelect: (selection: Selection) => void;
  onStaffOpen: (npc: LiveNpc) => void;
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
        <div className={`gen2-detail-room gen2-floor-${floorFor(room)} ${roomOfflineClass(room, roomVitals)}`} style={{ left: roomLeft, top: roomTop, width: roomWidth, height: roomHeight, transform: `scale(${scale})` }}>
          <RoomFrame room={room} roomVitals={roomVitals} />
          {roomProps.map((prop, index) => (
            <PropView key={`${room.id}-${prop.kind}-${index}`} prop={{ ...prop, x: prop.x - room.x, y: prop.y - room.y }} originalProp={prop} roomVitals={roomVitals} productionPhase={productionPhase} incidentPhase={incidentPhase} incidentTargetRoom={incidentTargetRoom} onSelect={onSelect} onContextMenu={onContextMenu} onTerminalOpen={onTerminalOpen} onFacilityEditor={onFacilityEditor} detail />
          ))}
          {roomNpcs.map((npc) => (
            <NpcView key={`${room.id}-${npc.id}`} npc={{ ...npc, x: npc.x - room.x, y: npc.y - room.y }} originalNpc={npc} staff={staff[npc.id]} incidentPhase={incidentPhase} incidentTargetRoom={incidentTargetRoom} selected={selectedNpcId === npc.id} onSelect={onSelect} onStaffOpen={onStaffOpen} onStaffEdit={onStaffEdit} onContextMenu={onContextMenu} detail />
          ))}
          <RoutePathOverlay npc={roomNpcs.find((item) => item.id === highlightedRouteId)} origin={{ x: room.x, y: room.y }} />
        </div>
      </div>
    </div>
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
  onOpen,
  onGrowOps,
  onFacilityEditor,
  onSelect,
  onContextMenu,
}: {
  room: Gen2Room;
  roomVitals: RoomVitals;
  onOpen: (room: Gen2Room) => void;
  onGrowOps: () => void;
  onFacilityEditor: () => void;
  onSelect: (selection: Selection) => void;
  onContextMenu: (event: React.MouseEvent, menu: Omit<ContextMenuState, "x" | "y">) => void;
}) {
  return (
    <div
      className={`gen2-room gen2-floor-${floorFor(room)} ${roomOfflineClass(room, roomVitals)}`}
      style={rect(room)}
      onClick={() => onSelect(roomSelection(room, roomVitals))}
      onContextMenu={(event) =>
        onContextMenu(event, {
          title: room.label,
          items: [
            { label: "Zoom room", action: () => onOpen(room) },
            { label: "Room stats", action: () => onSelect(roomSelection(room, roomVitals)) },
            ...(room.id === "screen" ? [{ label: "Grow Ops", action: onGrowOps }] : []),
            { label: "Flag cleaning", action: () => onSelect(actionSelection("ROOM ACTION", [`${room.label}`, "CLEANING FLAG SET", "PRIORITY: NORMAL"])) },
            { label: "Send staff", action: () => onSelect(actionSelection("DISPATCH", [`TARGET: ${room.label}`, "AVAILABLE STAFF: AUTO", "STATUS: QUEUED"])) },
          ],
        })
      }
    >
      <RoomFrame room={room} roomVitals={roomVitals} />
    </div>
  );
}

function RoomFrame({ room, roomVitals }: { room: Gen2Room; roomVitals: RoomVitals }) {
  const vitals = roomVitals[room.id];
  return (
    <>
      <div className="gen2-label">{room.label}</div>
      {vitals ? (
        <div className={`gen2-room-vitals vitals-${vitals.status.toLowerCase()}`}>
          <strong>{vitals.primary}</strong>
          <span>{vitals.secondary}</span>
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

  return (
    <button
      type="button"
      className={`gen2-prop prop-${prop.kind} ${isStressedPlant(source, roomVitals) ? "is-stressed-plant" : ""} ${environmentClass(source, roomVitals, incidentPhase, incidentTargetRoom)} ${productionClass(source, productionPhase, incidentPhase, incidentTargetRoom)} ${detail ? "is-detail-prop" : ""}`}
      style={{ left: prop.x * GEN2_TILE, top: prop.y * GEN2_TILE, width: w, height: h }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(propSelection(source, roomVitals));
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        if (source.kind === "terminal" && source.room === "rd2") onTerminalOpen(source);
        if (source.kind === "crate" || source.kind === "shelf") onSelect(propSelection(source, roomVitals));
      }}
      onContextMenu={(event) =>
        onContextMenu(event, {
          title: source.kind.toUpperCase(),
          items: [
            { label: "Inspect stats", action: () => onSelect(propSelection(source, roomVitals)) },
            ...(source.kind === "terminal" && source.room === "rd2" ? [{ label: "Open model chat", action: () => onTerminalOpen(source) }] : []),
            ...(source.kind === "crate" || source.kind === "shelf" ? [{ label: "Open logs", action: () => onSelect(propSelection(source, roomVitals)) }] : []),
            ...(source.kind === "desk" && source.room === "screen" && onFacilityEditor ? [{ label: "Room editor", action: onFacilityEditor }] : []),
            { label: "Maintenance", action: () => onSelect(actionSelection("MAINTENANCE", [`TARGET: ${source.kind.toUpperCase()}`, "STATUS: CHECK REQUESTED", "RISK: LOW"])) },
            { label: isPlant(source) ? "Check plant" : "Power cycle", action: () => onSelect(propSelection(source, roomVitals)) },
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
  onStaffEdit: (npc: LiveNpc) => void;
  onContextMenu: (event: React.MouseEvent, menu: Omit<ContextMenuState, "x" | "y">) => void;
  detail?: boolean;
}) {
  const source = originalNpc ?? npc;
  const cargo = visibleCargo(source, incidentPhase);

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
      {(incidentBubble(source, incidentPhase, incidentTargetRoom) ?? (npc.pause > 0 ? moodBubble(source, staff) : "")) ? <span className="gen2-bubble">{incidentBubble(source, incidentPhase, incidentTargetRoom) ?? moodBubble(source, staff)}</span> : null}
      <span className={`gen2-npc role-${source.role} face-${npc.dir} step-${npc.stepFrame} activity-${npcActivity(source)}`} style={staffStyle(staff)} />
      {cargo ? <span className={`npc-cargo cargo-${cargo}`} /> : null}
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
  const initial = sanitizeNpcs(gen2Npcs.map((npc) => ({ ...npc, routeIndex: 0, stepFrame: 0 as const, pause: 0 })), walkable);
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
        };
      });
    hydrated = [...hydrated, ...custom];
    const elapsedTicks = parsed.savedAt ? Math.min(2000, Math.floor((Date.now() - parsed.savedAt) / MOVEMENT_TICK_MS)) : 0;
    hydrated = sanitizeNpcs(hydrated, walkable);
    for (let index = 0; index < elapsedTicks; index += 1) hydrated = advanceAllNpcs(hydrated, walkable);
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
    const safePosition = nearestWalkableGoal({ x: npc.x, y: npc.y }, walkable, 18) ?? firstWalkableRouteTile(npc, walkable) ?? { x: npc.x, y: npc.y };
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

function advanceAllNpcs(npcs: LiveNpc[], walkable: Set<string>) {
  return npcs.map((npc) => advanceNpc(npc, walkable, npcs));
}

function advanceNpc(npc: LiveNpc, walkable: Set<string>, allNpcs: LiveNpc[]): LiveNpc {
  if (npc.pause > 0) return { ...npc, pause: npc.pause - 1, stepFrame: 0 };
  let target = npc.route[npc.routeIndex];
  if (!target) return npc;
  if (target && isBathroomTile(target.x, target.y) && !isBathroomTile(npc.x, npc.y) && bathroomOccupied(allNpcs, npc.id)) {
    const routeIndex = nextRouteIndex(npc, allNpcs);
    target = npc.route[routeIndex];
    return { ...npc, routeIndex, pause: 1, stepFrame: 0 };
  }
  if (target && isBreakRoomTile(target.x, target.y) && !isBreakRoomTile(npc.x, npc.y) && breakRoomCount(allNpcs, npc.id) >= 3) {
    const routeIndex = nextRouteIndex(npc, allNpcs);
    target = npc.route[routeIndex];
    return { ...npc, routeIndex, pause: 1, stepFrame: 0 };
  }
  const routedTarget = nearestWalkableGoal(target, walkable) ?? target;
  if (npc.x === routedTarget.x && npc.y === routedTarget.y) {
    return { ...npc, dir: target.face ?? npc.dir, routeIndex: nextRouteIndex(npc, allNpcs), pause: target.pause ?? randomPause(npc), stepFrame: 0 };
  }

  const next = nextStep({ x: npc.x, y: npc.y }, target, walkable);
  if (!next) return { ...npc, pause: 1, stepFrame: 0 };
  const dir = directionTo(npc.x, npc.y, next.x, next.y);
  return { ...npc, x: next.x, y: next.y, dir, stepFrame: npc.stepFrame === 1 ? 2 : 1 };
}

function nextRouteIndex(npc: LiveNpc, allNpcs: LiveNpc[]) {
  if (npc.route.length < 2) return 0;
  const bathroomIsOccupied = bathroomOccupied(allNpcs, npc.id) && !isBathroomTile(npc.x, npc.y);
  const breakRoomIsFull = breakRoomCount(allNpcs, npc.id) >= 3 && !isBreakRoomTile(npc.x, npc.y);
  const candidates = npc.route
    .map((_, index) => index)
    .filter((index) => index !== npc.routeIndex)
    .filter((index) => !bathroomIsOccupied || !isBathroomTile(npc.route[index].x, npc.route[index].y))
    .filter((index) => !breakRoomIsFull || !isBreakRoomTile(npc.route[index].x, npc.route[index].y));
  if (!candidates.length) return (npc.routeIndex + 1) % npc.route.length;
  let next = candidates[Math.floor(Math.random() * candidates.length)];
  if (next === npc.routeIndex) next = (next + 1) % npc.route.length;
  return next;
}

function randomPause(npc: LiveNpc) {
  if (npc.role === "boss") return 5 + Math.floor(Math.random() * 6);
  if (npc.role === "security") return 2 + Math.floor(Math.random() * 5);
  return 1 + Math.floor(Math.random() * 4);
}

function nextStep(from: { x: number; y: number }, to: { x: number; y: number }, walkable: Set<string>) {
  const startTile = walkable.has(`${from.x},${from.y}`) ? from : nearestWalkableGoal(from, walkable, 18);
  if (!startTile) return undefined;
  if (startTile.x !== from.x || startTile.y !== from.y) return startTile;
  const start = `${startTile.x},${startTile.y}`;
  const goalTile = nearestWalkableGoal(to, walkable);
  if (!goalTile) return undefined;
  const goal = `${goalTile.x},${goalTile.y}`;
  const queue = [startTile];
  const cameFrom = new Map<string, string | undefined>([[start, undefined]]);
  const neighbors = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  while (queue.length) {
    const current = queue.shift();
    if (!current) break;
    if (`${current.x},${current.y}` === goal) break;

    const ordered = [...neighbors].sort((a, b) => {
      const aDistance = Math.abs(goalTile.x - (current.x + a.x)) + Math.abs(goalTile.y - (current.y + a.y));
      const bDistance = Math.abs(goalTile.x - (current.x + b.x)) + Math.abs(goalTile.y - (current.y + b.y));
      return aDistance - bDistance;
    });

    for (const offset of ordered) {
      const step = { x: current.x + offset.x, y: current.y + offset.y };
      const key = `${step.x},${step.y}`;
      if (cameFrom.has(key) || !walkable.has(key)) continue;
      cameFrom.set(key, `${current.x},${current.y}`);
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

function buildWalkable() {
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
  return !["monitor", "growLight", "pipe", "irrigation", "whiteboard", "sealedDoor"].includes(prop.kind);
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
    const title = prop.kind === "tray" ? "CLONE TRAY" : prop.kind === "cutPlant" ? "DRYING HARVEST" : "CANNABIS PLANT";
    const stage = prop.kind === "tray" ? "CLONE" : prop.kind === "cutPlant" ? "CURING" : "VEGETATIVE";
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

function actionSelection(title: string, lines: string[]): Selection {
  return { type: "equipment", title, lines };
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

function buildLiveRoomVitals(hostStats?: HostStats, dockerStats?: DockerStats, ollamaModels?: OllamaModels, facilityDevices?: FacilityDevices): RoomVitals {
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

function visibleCargo(npc: LiveNpc, incidentPhase: number): Gen2Npc["cargo"] | undefined {
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

function npcActivity(npc: LiveNpc) {
  if (isBreakRoomTile(npc.x, npc.y) || isBathroomTile(npc.x, npc.y)) return "resting";
  if (npc.pause > 0) return "idle";
  if (npc.role === "boss" || npc.role === "secretary") return "idle";
  return "busy";
}

function roomOfflineClass(room: Gen2Room, roomVitals: RoomVitals) {
  return roomVitals[room.id]?.online === false ? "is-room-offline" : "";
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
