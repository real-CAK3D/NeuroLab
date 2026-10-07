export type Gen2MonitorKind = "host" | "docker" | "ollama" | "terminal" | "reports" | "facility" | "staff" | "cultivation" | "production";

export type Gen2RoomOperation = {
  roomId: string;
  title: string;
  owner: string;
  monitorKind: Gen2MonitorKind;
  primaryAction: string;
  watches: string[];
  reportTo: string;
  alertRules: string[];
};

export type Gen2WorkerProfile = {
  npcId: string;
  stationRoomId: string;
  department: string;
  title: string;
  personality: string;
  currentAction: string;
  steadyMood: string;
  busyMood: string;
  reportTarget: string;
  breakPolicy: string;
};

export type Gen2HotKey = {
  key: string;
  label: string;
  message: string;
  expectedResponse: string;
};

export type Gen2WorkerIdentity = {
  name: string;
  sex: string;
  age: number;
  workEthic: "LOW" | "STEADY" | "HIGH" | "EXCELLENT";
  evaluation: string;
};

export type Gen2RoomVital = {
  status: "OK" | "BUSY" | "WATCH" | "ALERT";
  primary: string;
  secondary: string;
  detail: string[];
};

export const gen2RoomOperations: Record<string, Gen2RoomOperation> = {
  boss: {
    roomId: "boss",
    title: "Boss Debrief Office",
    owner: "Boss",
    monitorKind: "reports",
    primaryAction: "Compile manager summaries, security warnings, and owner instructions into a daily debrief.",
    watches: ["Manager reports", "Security escalations", "WO report log", "Owner hot-key messages"],
    reportTo: "Owner",
    alertRules: ["Escalate overloads", "Flag repeated breaks", "Praise strong recovery after high load"],
  },
  clone: {
    roomId: "clone",
    title: "Clone Health Watch",
    owner: "Cultivation worker",
    monitorKind: "cultivation",
    primaryAction: "Display HP Laptop telemetry as clone health, water pressure, and light availability.",
    watches: ["HP Laptop online state", "CPU load", "Memory pressure", "Worker checks"],
    reportTo: "Cultivation Manager",
    alertRules: ["Dry trays", "Lights offline", "No worker check within schedule"],
  },
  mother: {
    roomId: "mother",
    title: "Mother Plant Watch",
    owner: "Cultivation worker",
    monitorKind: "cultivation",
    primaryAction: "Display NukeBox host telemetry as the mother system controlling the facility.",
    watches: ["NukeBox CPU", "NukeBox RAM", "Irrigation load", "Canopy status"],
    reportTo: "Cultivation Manager",
    alertRules: ["CO2 low", "Canopy stress", "Irrigation missed"],
  },
  grow1: {
    roomId: "grow1",
    title: "Grow Room 1 Cycle",
    owner: "Cultivation worker",
    monitorKind: "cultivation",
    primaryAction: "Monitor BAK3RY telemetry through grow lights, irrigation, and plant condition.",
    watches: ["BAK3RY online state", "CPU", "RAM", "Worker activity"],
    reportTo: "Cultivation Manager",
    alertRules: ["Temperature high", "Water low", "Too many missed checks"],
  },
  grow2: {
    roomId: "grow2",
    title: "Grow Room 2 Cycle",
    owner: "Cultivation worker",
    monitorKind: "cultivation",
    primaryAction: "Monitor Hack-Safe Raspberry Pi 5 telemetry and compare it against BAK3RY.",
    watches: ["Hack-Safe online state", "CPU", "RAM", "Worker activity"],
    reportTo: "Cultivation Manager",
    alertRules: ["Temperature high", "Water low", "Trend mismatch vs Grow Room 1"],
  },
  grow3: {
    roomId: "grow3",
    title: "Grow Room 3 Device Watch",
    owner: "Cultivation worker",
    monitorKind: "cultivation",
    primaryAction: "Hold the third grow bay ready for the future PI3 telemetry feed.",
    watches: ["PI3 assignment", "Telemetry arrival", "Light readiness", "Worker preparation"],
    reportTo: "Cultivation Manager",
    alertRules: ["Long heavy load", "Temperature high", "Network stall"],
  },
  grow4: {
    roomId: "grow4",
    title: "Grow Room 4 Device Watch",
    owner: "Cultivation worker",
    monitorKind: "cultivation",
    primaryAction: "Hold the fourth grow bay ready for the next approved device telemetry feed.",
    watches: ["Device assignment", "Telemetry arrival", "Light readiness", "Worker preparation"],
    reportTo: "Cultivation Manager",
    alertRules: ["Assignment missing", "Telemetry absent", "Room idle too long"],
  },
  vmCreations: {
    roomId: "vmCreations",
    title: "CAK3D-Creations VM Room",
    owner: "The Gardiner",
    monitorKind: "host",
    primaryAction: "Reserve the new left dry-room bay for CAK3D-Creations / Obsidian VM telemetry and knowledge-vault health.",
    watches: ["CAK3D-Creations telemetry", "Obsidian vault reachability", "Syncthing status", "Knowledge sync"],
    reportTo: "Boss",
    alertRules: ["Telemetry stale", "Vault unreachable", "Knowledge sync stalled"],
  },
  soil: {
    roomId: "soil",
    title: "The Garden VM Room",
    owner: "The Gardiner",
    monitorKind: "host",
    primaryAction: "Display The Garden Oracle VM telemetry as the command-center control room for agents, dashboards, and device coordination.",
    watches: ["The Garden online state", "CPU load", "RAM pressure", "Swap pressure", "Agent services"],
    reportTo: "Boss",
    alertRules: ["VM offline", "Swap high", "Hermes service degraded"],
  },
  potting: {
    roomId: "potting",
    title: "Potting Queue",
    owner: "Cultivation worker",
    monitorKind: "production",
    primaryAction: "Blend soil and nutrients, fill open pots, and stage repotted clones for grow rooms.",
    watches: ["Potting mix", "Nutrient barrels", "Open pots", "Clone transplants"],
    reportTo: "Cultivation Manager",
    alertRules: ["Queue backing up", "Worker overextended", "Missing potting report"],
  },
  cultMgr: {
    roomId: "cultMgr",
    title: "Cultivation Manager Desk",
    owner: "Cultivation Manager",
    monitorKind: "staff",
    primaryAction: "Collect cultivation worker lists, balance breaks, assist overloaded staff, and summarize to boss.",
    watches: ["Worker break rate", "Plant-room alerts", "Task completion list", "Department morale"],
    reportTo: "Boss",
    alertRules: ["Too many breaks", "Worker overworked", "Critical plant-room alert"],
  },
  trim: {
    roomId: "trim",
    title: "Processing Trim Queue",
    owner: "Processing worker",
    monitorKind: "production",
    primaryAction: "Receive dry harvest, operate trim tables, and release prepared batches to packaging.",
    watches: ["Dry harvest queue", "Table activity", "Package handoff", "Yield notes"],
    reportTo: "Operations Manager",
    alertRules: ["Queue stuck", "Machine offline", "Worker fatigue"],
  },
  pack: {
    roomId: "pack",
    title: "Packaging Station",
    owner: "Processing worker",
    monitorKind: "production",
    primaryAction: "Package trimmed harvest, label batches, and send finished packages to loading.",
    watches: ["Crates", "Conveyor", "Label queue", "Batch WO"],
    reportTo: "Operations Manager",
    alertRules: ["Labels low", "Conveyor stopped", "Batch mismatch"],
  },
  extract: {
    roomId: "extract",
    title: "Extraction Equipment",
    owner: "Operations Manager",
    monitorKind: "facility",
    primaryAction: "Monitor extractor, vats, pipes, pressure/temperature, and safety status.",
    watches: ["Extractor temp", "Tank pressure", "Pipe status", "Safety lock"],
    reportTo: "Security and Boss",
    alertRules: ["Temperature high", "Pressure high", "Safety lock open"],
  },
  security: {
    roomId: "security",
    title: "Security Watch",
    owner: "Security",
    monitorKind: "facility",
    primaryAction: "Watch all rooms for overloads, heat, offline systems, and suspicious inactivity.",
    watches: ["Room alerts", "Temperature warnings", "Worker status", "Camera wall"],
    reportTo: "Boss",
    alertRules: ["Any critical alert", "Room too hot", "Worker missing from station"],
  },
  ops: {
    roomId: "ops",
    title: "Docker Operations",
    owner: "Operations Manager",
    monitorKind: "docker",
    primaryAction: "Monitor Docker daemon, containers, uptime, restart count, CPU, memory, and network throughput.",
    watches: ["Container uptime", "CPU and memory", "Restart count", "Image age", "Port health"],
    reportTo: "Boss",
    alertRules: ["Container down", "Restart loop", "Memory pressure", "Port offline"],
  },
  break: {
    roomId: "break",
    title: "Break Rotation",
    owner: "Managers",
    monitorKind: "staff",
    primaryAction: "Let workers rest when workload is steady while managers watch for too many breaks.",
    watches: ["Break count", "Mood recovery", "Department coverage", "Return-to-station timer"],
    reportTo: "Department Managers",
    alertRules: ["Too many breaks", "Department uncovered", "Worker needs relief"],
  },
  bath: {
    roomId: "bath",
    title: "Bathroom Occupancy",
    owner: "Managers",
    monitorKind: "staff",
    primaryAction: "Allow one worker at a time and queue anyone else back to break room or department.",
    watches: ["Occupancy", "Queue", "Return timer"],
    reportTo: "Department Managers",
    alertRules: ["More than one occupant", "Stay too long"],
  },
  screen: {
    roomId: "screen",
    title: "Grow Ops Screening",
    owner: "Grow Ops",
    monitorKind: "staff",
    primaryAction: "Screen new facility staff, set sprite colors, and send saved hires onto the floor.",
    watches: ["New staff profiles", "Department colors", "Role assignments", "Entry queue"],
    reportTo: "Boss",
    alertRules: ["Missing title", "Unassigned department", "Unsaved profile edit"],
  },
  dock: {
    roomId: "dock",
    title: "Logistics Staging",
    owner: "Logistics",
    monitorKind: "reports",
    primaryAction: "Stage finished packages alongside report packets before warehouse intake.",
    watches: ["Finished packages", "WO numbers", "Report packets", "Delivery status"],
    reportTo: "Boss",
    alertRules: ["Report missing WO", "Delivery overdue"],
  },
  warehouse: {
    roomId: "warehouse",
    title: "Report and Supply Archive",
    owner: "Logistics",
    monitorKind: "reports",
    primaryAction: "Store finished packages and deliver timestamped staff reports to the Markdown WO archive.",
    watches: ["Package inventory", "WO log", "Report archive", "Markdown sync"],
    reportTo: "Boss",
    alertRules: ["Write failure", "WO duplicate", "Archive delayed"],
  },
  sales: {
    roomId: "sales",
    title: "GMKtec M7 Host Monitor",
    owner: "Boss Executive",
    monitorKind: "host",
    primaryAction: "Monitor Windows host health for CPU, RAM, clocks, fans, thermals, disks, network, and uptime.",
    watches: ["CPU speed/load", "RAM usage/capacity", "Fan RPM", "Temperatures", "Disk and network"],
    reportTo: "Boss",
    alertRules: ["CPU hot", "RAM pressure", "Fan abnormal", "Disk low"],
  },
  rd1: {
    roomId: "rd1",
    title: "Ollama Model Lab",
    owner: "Researcher",
    monitorKind: "ollama",
    primaryAction: "Monitor Ollama service, loaded models, model size, VRAM/RAM use, latency, and queue status.",
    watches: ["Ollama uptime", "Loaded models", "Model latency", "Token throughput", "Queue length"],
    reportTo: "Boss",
    alertRules: ["Ollama offline", "Model too slow", "Memory pressure", "Queue stuck"],
  },
  rd2: {
    roomId: "rd2",
    title: "Terminal and SSH Workbench",
    owner: "Researcher",
    monitorKind: "terminal",
    primaryAction: "Run approved commands, open terminals, and connect to PCs, Raspberry Pis, and VMs over SSH.",
    watches: ["Approval queue", "Command history", "SSH targets", "Terminal sessions"],
    reportTo: "Boss",
    alertRules: ["Approval needed", "Command failed", "SSH offline", "Session stale"],
  },
};

export const gen2RoomVitals: Record<string, Gen2RoomVital> = {
  boss: { status: "OK", primary: "BRIEF 3", secondary: "WO READY", detail: ["MANAGER REPORTS: 3", "SECURITY FLAGS: 0", "OWNER NOTES: READY"] },
  clone: { status: "OK", primary: "RH 62%", secondary: "TRAYS 8", detail: ["LIGHT: ON", "WATER: NORMAL", "CHECKS: ON SCHEDULE"] },
  mother: { status: "OK", primary: "PC 64C", secondary: "FAN OK", detail: ["CPU: 22%", "RAM: 11/32G", "SWAP: 1.2G", "NET: 42MB"] },
  grow1: { status: "BUSY", primary: "PI1 67C", secondary: "AIR 71%", detail: ["CPU->WATER: 48%", "RAM->GROWTH: 62%", "NET->HARVEST: 6D"] },
  grow2: { status: "OK", primary: "PI2 61C", secondary: "AIR 76%", detail: ["CPU->WATER: 31%", "RAM->HEIGHT: 58%", "DISK->ROOTS: GOOD"] },
  grow3: { status: "WATCH", primary: "PI3 78C", secondary: "AIR 45%", detail: ["CPU->WATER: 86%", "SWAP->STRESS: HIGH", "PLANTS: YELLOWING"] },
  grow4: { status: "WATCH", primary: "GROW4 WAITING", secondary: "NO DEVICE", detail: ["TELEMETRY: NOT ASSIGNED", "LIGHTS: OFF", "IRRIGATION: IDLE"] },
  vmCreations: { status: "WATCH", primary: "CREATIONS WAIT", secondary: "NO FEED", detail: ["VM: CAK3D-CREATIONS", "VAULT: PENDING", "SYNC: WAITING"] },
  soil: { status: "OK", primary: "GARDEN VM", secondary: "AGENTS READY", detail: ["VM: ORACLE", "HERMES: WATCH", "DEVICE SSH: READY"] },
  potting: { status: "BUSY", primary: "POTS 5", secondary: "MIX READY", detail: ["CLONES READY: 3", "BARRELS: FULL", "WO: OPEN"] },
  cultMgr: { status: "OK", primary: "STAFF 3", secondary: "BREAKS 1", detail: ["REPORTS: 3", "ASSIST: NONE", "MORALE: STABLE"] },
  trim: { status: "BUSY", primary: "QUEUE 7", secondary: "LOAD 63%", detail: ["TABLES: ACTIVE", "YIELD NOTES: OPEN", "FATIGUE: LOW"] },
  pack: { status: "OK", primary: "BATCH 2", secondary: "LABELS OK", detail: ["CONVEYOR: READY", "CRATES: 9", "MISMATCH: 0"] },
  extract: { status: "OK", primary: "TEMP 76F", secondary: "PSI 38", detail: ["LOCK: CLOSED", "VATS: ONLINE", "PIPE STATUS: NORMAL"] },
  security: { status: "OK", primary: "CAMS 15+1", secondary: "FLAGS 0", detail: ["ROOM HEAT: NORMAL", "PATROL: ACTIVE", "SPARE CAM: OFF"] },
  ops: { status: "BUSY", primary: "DOCKER 8", secondary: "HEALTHY", detail: ["CULTIVATION: WATCH", "PROCESSING: BUSY", "REPORT: SEND TO BOSS"] },
  break: { status: "OK", primary: "BREAK 1", secondary: "QUEUE 0", detail: ["COVERAGE: OK", "RECOVERY: NORMAL", "RETURN TIMER: ON"] },
  bath: { status: "OK", primary: "OCC 0/1", secondary: "QUEUE 0", detail: ["LIMIT: ONE", "OVERSTAY: NO", "RETURN: READY"] },
  screen: { status: "OK", primary: "HIRES 0", secondary: "SAVE READY", detail: ["ENTRY: SCREENING", "COLORS: EDITABLE", "ROLES: ASSIGNABLE"] },
  dock: { status: "OK", primary: "WO 4", secondary: "STAGED 2", detail: ["PACKETS: READY", "DELIVERY: ON TIME", "MISSING WO: 0"] },
  warehouse: { status: "OK", primary: "LOG OK", secondary: "SUPPLY 72%", detail: ["ARCHIVE: READY", "DUPLICATES: 0", "SYNC: PENDING BACKEND"] },
  sales: { status: "OK", primary: "MAUI PI2", secondary: "RAM 11/32G", detail: ["CPU: 22%", "STORAGE: 612MB/S", "NET: 42MB/S", "TEMP: 64C"] },
  rd1: { status: "WATCH", primary: "OLLAMA UP", secondary: "MODELS 6", detail: ["LATENCY: 820MS", "QUEUE: 1", "RAM: 18GB", "TPS: 31"] },
  rd2: { status: "OK", primary: "TERM 0", secondary: "SSH 3", detail: ["APPROVALS: REQUIRED", "TARGETS: 3", "LAST EXIT: 0"] },
};

export const gen2WorkerProfiles: Record<string, Gen2WorkerProfile> = {
  boss: {
    npcId: "boss",
    stationRoomId: "boss",
    department: "Executive",
    title: "Boss",
    personality: "Measured, stern, rewards strong work and corrects poor discipline.",
    currentAction: "Reviewing manager summaries",
    steadyMood: "CALM",
    busyMood: "DIRECTIVE",
    reportTarget: "Owner",
    breakPolicy: "Rarely leaves the office; focuses on debriefs and messages.",
  },
  cloneWorker: {
    npcId: "cloneWorker",
    stationRoomId: "clone",
    department: "Cultivation",
    title: "Clone Technician",
    personality: "Careful and routine-driven.",
    currentAction: "Checking clone trays",
    steadyMood: "FOCUSED",
    busyMood: "RUSHED",
    reportTarget: "Cultivation Manager",
    breakPolicy: "Break allowed when clone trays are stable.",
  },
  motherWorker: {
    npcId: "motherWorker",
    stationRoomId: "mother",
    department: "Cultivation",
    title: "Mother Plant Technician",
    personality: "Patient, plant-first, notices small changes.",
    currentAction: "Inspecting mother plants",
    steadyMood: "STEADY",
    busyMood: "CONCERNED",
    reportTarget: "Cultivation Manager",
    breakPolicy: "Break allowed after CO2 and irrigation checks.",
  },
  growWorker: {
    npcId: "growWorker",
    stationRoomId: "grow1",
    department: "Cultivation",
    title: "Grow Room Technician",
    personality: "Energetic and hands-on.",
    currentAction: "Walking plant rows",
    steadyMood: "OK",
    busyMood: "SWEATING",
    reportTarget: "Cultivation Manager",
    breakPolicy: "Manager watches for overheating or skipped breaks.",
  },
  grow2Worker: {
    npcId: "grow2Worker",
    stationRoomId: "grow2",
    department: "Cultivation",
    title: "Grow Room 2 Technician",
    personality: "Hard-working, steady under repeated CPU heat reports.",
    currentAction: "Watching Grow Room 2 device load",
    steadyMood: "READY",
    busyMood: "PUSHING",
    reportTarget: "Cultivation Manager",
    breakPolicy: "Break may be delayed when Grow Room 2 stays hot.",
  },
  grow3Worker: {
    npcId: "grow3Worker",
    stationRoomId: "grow3",
    department: "Cultivation",
    title: "Grow Room 3 Technician",
    personality: "Alert, detail-heavy, tends to over-report heat issues.",
    currentAction: "Watching high-load plant stress",
    steadyMood: "WATCH",
    busyMood: "HOT",
    reportTarget: "Cultivation Manager",
    breakPolicy: "Break is delayed while Grow Room 3 is yellowing.",
  },
  grow4Worker: {
    npcId: "grow4Worker",
    stationRoomId: "grow4",
    department: "Cultivation",
    title: "Grow Room 4 Technician",
    personality: "Calm and methodical.",
    currentAction: "Comparing VM growth stats",
    steadyMood: "OK",
    busyMood: "TUNING",
    reportTarget: "Cultivation Manager",
    breakPolicy: "Break allowed when VM growth and airflow are steady.",
  },
  pottingWorker: {
    npcId: "pottingWorker",
    stationRoomId: "potting",
    department: "Cultivation",
    title: "Potting Specialist",
    personality: "Practical, keeps queues moving.",
    currentAction: "Mixing soil and filling open pots",
    steadyMood: "READY",
    busyMood: "STACKED",
    reportTarget: "Cultivation Manager",
    breakPolicy: "Break allowed only when potting queue is under control.",
  },
  soilWorker: {
    npcId: "soilWorker",
    stationRoomId: "soil",
    department: "Cultivation",
    title: "Dry Room Technician",
    personality: "Patient, careful with humidity and cure timing.",
    currentAction: "Hanging cut plants to dry",
    steadyMood: "CURING",
    busyMood: "RACKED",
    reportTarget: "Cultivation Manager",
    breakPolicy: "Break after a dry batch is handed to trim.",
  },
  cultManager: {
    npcId: "cultManager",
    stationRoomId: "cultMgr",
    department: "Cultivation",
    title: "Cultivation Manager",
    personality: "Balances room health, worker coverage, and telemetry alerts.",
    currentAction: "Checking flower rooms, then stepping into the bathroom for a product trial",
    steadyMood: "REVIEW",
    busyMood: "ASSIST",
    reportTarget: "Boss",
    breakPolicy: "Bathroom visit doubles as product testing before returning to cultivation coverage.",
  },
  processor: {
    npcId: "processor",
    stationRoomId: "trim",
    department: "Processing",
    title: "Processing Worker",
    personality: "Fast but gets tired under heavy queue load.",
    currentAction: "Trimming dried harvest batches",
    steadyMood: "WORKING",
    busyMood: "BACKED UP",
    reportTarget: "Operations Manager",
    breakPolicy: "Break allowed when trim queue is clear.",
  },
  packer: {
    npcId: "packer",
    stationRoomId: "pack",
    department: "Processing",
    title: "Packaging Worker",
    personality: "Consistent and report-friendly.",
    currentAction: "Packing labeled harvest batches",
    steadyMood: "READY",
    busyMood: "BUSY",
    reportTarget: "Operations Manager",
    breakPolicy: "Break allowed after batch handoff.",
  },
  extractor: {
    npcId: "extractor",
    stationRoomId: "extract",
    department: "Processing",
    title: "Extraction Technician",
    personality: "Careful around heat, pressure, and converted batches.",
    currentAction: "Taking packaged product to extraction, running oil, then carrying extract to R&D",
    steadyMood: "SAFE",
    busyMood: "CAUTION",
    reportTarget: "Operations Manager",
    breakPolicy: "Break delayed while an extract batch is running.",
  },
  opsManager: {
    npcId: "opsManager",
    stationRoomId: "ops",
    department: "Operations",
    title: "Processing Manager",
    personality: "Systematic, tracks processing flow, Docker health, and sample handoffs to Sales.",
    currentAction: "Bringing packaged product samples to Sales and checking processing flow",
    steadyMood: "ONLINE",
    busyMood: "TRIAGE",
    reportTarget: "Boss",
    breakPolicy: "Covers operations alerts before leaving the desk.",
  },
  processor2: {
    npcId: "processor2",
    stationRoomId: "trim",
    department: "Processing",
    title: "Process Watcher",
    personality: "Good at spotting runaway processes.",
    currentAction: "Checking active process list",
    steadyMood: "SCAN",
    busyMood: "LOAD",
    reportTarget: "Operations Manager",
    breakPolicy: "Break allowed when process queue is stable.",
  },
  processor3: {
    npcId: "processor3",
    stationRoomId: "pack",
    department: "Processing",
    title: "Update Packager",
    personality: "Orderly and version-focused.",
    currentAction: "Sorting available updates",
    steadyMood: "PACK",
    busyMood: "PATCH",
    reportTarget: "Operations Manager",
    breakPolicy: "Break after update list is packaged.",
  },
  processor4: {
    npcId: "processor4",
    stationRoomId: "trim",
    department: "Processing",
    title: "Runtime Assistant",
    personality: "Fast, curious, occasionally impatient.",
    currentAction: "Watching app/runtime processes",
    steadyMood: "READY",
    busyMood: "RUSH",
    reportTarget: "Operations Manager",
    breakPolicy: "Manager delays break during high runtime load.",
  },
  security: {
    npcId: "security",
    stationRoomId: "security",
    department: "Security",
    title: "Security Operator",
    personality: "Quiet, suspicious, escalates fast.",
    currentAction: "Watching camera wall",
    steadyMood: "WATCHING",
    busyMood: "ALERT",
    reportTarget: "Boss",
    breakPolicy: "Break only when patrol has coverage.",
  },
  patrol: {
    npcId: "patrol",
    stationRoomId: "security",
    department: "Security",
    title: "Security Patrol",
    personality: "Direct and territorial.",
    currentAction: "Patrolling heat and overload zones",
    steadyMood: "PATROL",
    busyMood: "ESCALATING",
    reportTarget: "Boss",
    breakPolicy: "Covers security operator breaks.",
  },
  logistics: {
    npcId: "logistics",
    stationRoomId: "warehouse",
    department: "Logistics",
    title: "Report Courier",
    personality: "Organized, timestamp-obsessed, keeps WO numbers clean.",
    currentAction: "Delivering WO packets",
    steadyMood: "ROUTING",
    busyMood: "STACKED",
    reportTarget: "Markdown WO archive",
    breakPolicy: "Break allowed only after report delivery.",
  },
  researcher: {
    npcId: "researcher",
    stationRoomId: "rd1",
    department: "Research",
    title: "AI Systems Researcher",
    personality: "Curious, occasionally distracted by model tests.",
    currentAction: "Receiving extract from extraction, sending samples to R&D Test, then routing good results to Sales",
    steadyMood: "CURIOUS",
    busyMood: "TUNING",
    reportTarget: "Boss",
    breakPolicy: "If R&D Test fails, requests another extraction batch from the Processing Manager.",
  },
  secretary: {
    npcId: "secretary",
    stationRoomId: "ops",
    department: "Operations",
    title: "Operations Secretary",
    personality: "Social, notices morale and missing reports.",
    currentAction: "Collecting department lists",
    steadyMood: "ORGANIZED",
    busyMood: "CHASING",
    reportTarget: "Boss",
    breakPolicy: "Can walk departments while managers stay on task.",
  },
  bossSecretary: {
    npcId: "bossSecretary",
    stationRoomId: "boss",
    department: "Executive",
    title: "Boss Secretary",
    personality: "Sharp, discreet, collects reports before they get stale.",
    currentAction: "Collecting reports for the boss",
    steadyMood: "FILING",
    busyMood: "RUNNING",
    reportTarget: "Boss",
    breakPolicy: "Break only after manager report pickup is complete.",
  },
  screenHr: {
    npcId: "screenHr",
    stationRoomId: "screen",
    department: "Grow Ops",
    title: "HR Screening Rep",
    personality: "Patient, organized, keeps new staff profiles tidy.",
    currentAction: "Filing papers and updating staff records",
    steadyMood: "FILING",
    busyMood: "KEYING",
    reportTarget: "Boss",
    breakPolicy: "Keeps the entry desk covered during new-hire screening.",
  },
  maintenance: {
    npcId: "maintenance",
    stationRoomId: "break",
    department: "Maintenance",
    title: "Facility Maintenance",
    personality: "Methodical, keeps shared areas clean and uncluttered.",
    currentAction: "Cleaning bathrooms, break room, and halls",
    steadyMood: "CLEAN",
    busyMood: "SWEEP",
    reportTarget: "Operations Manager",
    breakPolicy: "Rotates cleaning stops before taking a drink break.",
  },
  rdSafety: {
    npcId: "rdSafety",
    stationRoomId: "rd1",
    department: "Research",
    title: "Lab Safety Technician",
    personality: "Unflappable, keeps an extinguisher close during experiments.",
    currentAction: "Watching smoke and flame tests",
    steadyMood: "READY",
    busyMood: "SUPPRESS",
    reportTarget: "Operations Manager",
    breakPolicy: "Stays near R&D while an experiment is active.",
  },
  salesRep: {
    npcId: "salesRep",
    stationRoomId: "sales",
    department: "Sales",
    title: "Sales Strategist",
    personality: "Talkative, converts department findings into client ideas.",
    currentAction: "Interviewing managers for new ideas",
    steadyMood: "PITCH",
    busyMood: "BRAINSTORM",
    reportTarget: "Boss",
    breakPolicy: "Returns to the sales desk after each idea round.",
  },
  salesAssistant: {
    npcId: "salesAssistant",
    stationRoomId: "sales",
    department: "Sales",
    title: "Sales Coordinator",
    personality: "Organized and quick with notes.",
    currentAction: "Preparing sales concepts at the workstation",
    steadyMood: "WRITING",
    busyMood: "PITCH",
    reportTarget: "Sales Strategist",
    breakPolicy: "Covers the sales desk while Cass is meeting managers.",
  },
};

export const gen2WorkerIdentity: Record<string, Gen2WorkerIdentity> = {
  boss: { name: "Oakley", sex: "M", age: 61, workEthic: "HIGH", evaluation: "Turns manager notes into owner-facing debriefs." },
  bossSecretary: { name: "Mara", sex: "F", age: 34, workEthic: "EXCELLENT", evaluation: "Collects manager reports before they become stale." },
  cloneWorker: { name: "Iris", sex: "F", age: 28, workEthic: "STEADY", evaluation: "Careful clone-room checks with low error rate." },
  motherWorker: { name: "Mina", sex: "F", age: 31, workEthic: "HIGH", evaluation: "Strong plant awareness and reliable PC thermal notes." },
  growWorker: { name: "Tessa", sex: "F", age: 30, workEthic: "HIGH", evaluation: "Keeps Grow Room 1 steady and reports water/growth changes clearly." },
  grow2Worker: { name: "Gigi", sex: "F", age: 26, workEthic: "EXCELLENT", evaluation: "Grow Room 2 has been high CPU for several reports; she may need help or a raise." },
  grow3Worker: { name: "Nico", sex: "M", age: 29, workEthic: "HIGH", evaluation: "Catches heat stress early in Grow Room 3." },
  grow4Worker: { name: "Lena", sex: "F", age: 33, workEthic: "STEADY", evaluation: "Keeps VM/device stats calm and organized." },
  pottingWorker: { name: "Owen", sex: "M", age: 37, workEthic: "STEADY", evaluation: "Keeps potting queues from piling up." },
  soilWorker: { name: "Sage", sex: "F", age: 32, workEthic: "HIGH", evaluation: "Tracks drying time and delivers clean harvest batches to trim." },
  cultManager: { name: "Dan", sex: "M", age: 44, workEthic: "EXCELLENT", evaluation: "Balances cultivation staffing, checks product quality, and occasionally tests a joint in the bathroom." },
  processor: { name: "Rafa", sex: "M", age: 30, workEthic: "HIGH", evaluation: "Good with active process queues." },
  processor2: { name: "June", sex: "F", age: 27, workEthic: "STEADY", evaluation: "Strong runtime watcher." },
  processor3: { name: "Theo", sex: "M", age: 35, workEthic: "HIGH", evaluation: "Reliable update/package sorter." },
  processor4: { name: "Ari", sex: "F", age: 24, workEthic: "STEADY", evaluation: "Fast but needs pacing during high load." },
  packer: { name: "Pax", sex: "M", age: 32, workEthic: "HIGH", evaluation: "Keeps available updates batched cleanly." },
  extractor: { name: "Sloane", sex: "F", age: 39, workEthic: "EXCELLENT", evaluation: "Pulls material from Packaging, runs extraction, and delivers oil to R&D Lab." },
  opsManager: { name: "Riley", sex: "F", age: 43, workEthic: "HIGH", evaluation: "Keeps processing staff covered and delivers product samples from Packaging to Sales." },
  security: { name: "Knox", sex: "M", age: 42, workEthic: "HIGH", evaluation: "Escalates heat and overload issues quickly." },
  patrol: { name: "Vega", sex: "F", age: 36, workEthic: "HIGH", evaluation: "Good patrol discipline and room coverage." },
  logistics: { name: "Miles", sex: "M", age: 41, workEthic: "EXCELLENT", evaluation: "Keeps WO report packets timestamped and sorted." },
  researcher: { name: "Elia", sex: "F", age: 38, workEthic: "HIGH", evaluation: "Moves extract from R&D Lab to R&D Test, then pushes good samples to Sales or requests another batch." },
  secretary: { name: "Noor", sex: "F", age: 29, workEthic: "STEADY", evaluation: "Keeps Ops notes and department lists moving." },
  screenHr: { name: "Harper", sex: "F", age: 40, workEthic: "HIGH", evaluation: "Keeps new hires screened before they hit the floor." },
  maintenance: { name: "Mack", sex: "M", age: 46, workEthic: "STEADY", evaluation: "Keeps bathrooms, break room, and traffic lanes clean." },
  rdSafety: { name: "Sol", sex: "M", age: 34, workEthic: "HIGH", evaluation: "Responds quickly to smoke and flame during model tests." },
  salesRep: { name: "Cass", sex: "F", age: 36, workEthic: "HIGH", evaluation: "Turns manager interviews into useful sales concepts." },
  salesAssistant: { name: "Reese", sex: "F", age: 27, workEthic: "STEADY", evaluation: "Keeps sales workstation coverage and organizes incoming ideas." },
};

export const gen2PerformanceBriefs = [
  "Dan: Grow Room 2 has been high CPU for several reports. Gigi is working extra hard and may need another worker assigned.",
  "Boss: Dan reports Gigi is carrying repeated high-load checks. Consider help, raise, or workload balancing.",
  "Security: Grow Room 3 is yellowing after long heavy load. Escalated to boss and cultivation manager.",
  "Logistics: Hourly report packets are queued for security, cultivation, operations, R&D, sales, logistics, and boss.",
  "Sage: Harvest batches are drying on schedule and will be handed to trim as soon as humidity settles.",
];

export const gen2BossHotKeys: Gen2HotKey[] = [
  { key: "1", label: "Good Work", message: "Good work. Keep that pace.", expectedResponse: "Mood improves, workers stay at station longer." },
  { key: "2", label: "Focus Up", message: "Focus up and finish the current list.", expectedResponse: "Break chance drops, workload stress rises slightly." },
  { key: "3", label: "Take Five", message: "Take a short break when your station is stable.", expectedResponse: "Eligible workers rotate to break room." },
  { key: "4", label: "Report In", message: "Compile your list and send it to your manager.", expectedResponse: "Workers generate manager-facing report packets." },
  { key: "5", label: "Manager Assist", message: "Managers, assist overloaded staff.", expectedResponse: "Managers move toward departments under pressure." },
  { key: "6", label: "Security Sweep", message: "Security, sweep for overloads and heat warnings.", expectedResponse: "Security prioritizes alerts and boss escalation." },
  { key: "7", label: "Docker Check", message: "Operations, verify Docker health and container uptime.", expectedResponse: "Ops report focuses Docker containers." },
  { key: "8", label: "Ollama Check", message: "Research, verify Ollama and loaded models.", expectedResponse: "Research report focuses model status and latency." },
  { key: "9", label: "Host Check", message: "Check the GMKtec M7 host health.", expectedResponse: "Host report focuses CPU, RAM, fans, thermals, disk, network." },
  { key: "0", label: "Debrief", message: "Boss, compile the latest debrief.", expectedResponse: "Boss prepares owner-facing summary with WO references." },
];

export const gen2ReportLogPath = "docs/gen2-wo-report-log.md";

// ---------------------------------------------------------------------------
// Sims-style autonomy: personality-driven jitter, needs rates and chatter.
// ---------------------------------------------------------------------------

export type Gen2BreakFavorite = "coffee" | "water" | "fridge" | "microwave" | "sit" | "phone";

export type Gen2SimTrait = {
  /** Chance per tick that a walking sprite actually takes a step (0.75-1). */
  pace: number;
  /** Multiplier applied to pause lengths at route stops. */
  pauseScale: number;
  /** How readily this worker starts conversations (0.3-1.8). */
  chatty: number;
  /** Need drift multipliers. */
  energyRate: number;
  socialRate: number;
  hungerRate: number;
  bladderRate: number;
  /** Chance multiplier for taking a scenic detour between rooms. */
  wander: number;
  favorite: Gen2BreakFavorite;
};

export function gen2Hash01(id: string, salt = ""): number {
  let hash = 2166136261;
  const text = `${id}:${salt}`;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

const gen2SimTraitOverrides: Record<string, Partial<Gen2SimTrait>> = {
  salesRep: { chatty: 1.8, wander: 1.8, pace: 0.98, favorite: "coffee" },
  salesAssistant: { chatty: 1.3, favorite: "phone" },
  bossSecretary: { chatty: 1.1, pace: 0.97 },
  secretary: { chatty: 1.5 },
  screenHr: { chatty: 1.2, favorite: "water" },
  security: { chatty: 0.35, pace: 1, wander: 0.4 },
  patrol: { chatty: 0.45, pace: 1, wander: 1.4 },
  boss: { chatty: 0.2, pace: 0.95 },
  grow2Worker: { energyRate: 1.45, favorite: "coffee" },
  grow3Worker: { energyRate: 1.25, chatty: 1.1 },
  processor4: { pace: 0.92, pauseScale: 0.7, favorite: "phone" },
  maintenance: { pace: 0.82, pauseScale: 1.3, favorite: "water", wander: 1.6, bladderRate: 0.8 },
  extractor: { chatty: 0.55, favorite: "water" },
  researcher: { favorite: "coffee", energyRate: 1.2 },
  rdSafety: { chatty: 0.8 },
  cultManager: { chatty: 1.0, favorite: "coffee" },
  opsManager: { chatty: 0.9 },
  logistics: { pace: 0.96, pauseScale: 0.9 },
  soilWorker: { pace: 0.85, pauseScale: 1.25 },
};

const gen2SimFavorites: Gen2BreakFavorite[] = ["coffee", "water", "fridge", "microwave", "sit", "phone"];

export function gen2SimTraitFor(id: string): Gen2SimTrait {
  const base: Gen2SimTrait = {
    pace: 0.82 + gen2Hash01(id, "pace") * 0.17,
    pauseScale: 0.7 + gen2Hash01(id, "pause") * 0.8,
    chatty: 0.55 + gen2Hash01(id, "chat") * 1.0,
    energyRate: 0.8 + gen2Hash01(id, "energy") * 0.5,
    socialRate: 0.75 + gen2Hash01(id, "social") * 0.6,
    hungerRate: 0.8 + gen2Hash01(id, "hunger") * 0.5,
    bladderRate: 0.8 + gen2Hash01(id, "bladder") * 0.5,
    wander: 0.6 + gen2Hash01(id, "wander") * 1.0,
    favorite: gen2SimFavorites[Math.floor(gen2Hash01(id, "fav") * gen2SimFavorites.length) % gen2SimFavorites.length],
  };
  return { ...base, ...(gen2SimTraitOverrides[id] ?? {}) };
}

/** Short lines (<= ~22 chars) so the 6px bubbles stay readable. */
export const gen2ChatTopics = {
  workByDepartment: {
    Cultivation: ["TRAYS LOOK GREAT", "WATER LINES ARE FULL", "CLONES ROOTED EARLY", "NEED MORE POTS", "CANOPY IS FILLING IN", "CHECKED THE PH TWICE"],
    Processing: ["TRIM QUEUE IS LONG", "LABELS RUNNING LOW", "BATCH WENT OUT CLEAN", "CONVEYOR WAS STICKY", "MORE CRATES PLEASE", "PROCESS LIST IS QUIET"],
    Research: ["MODEL RAN 20% FASTER", "TEST BATCH PASSED", "NEW SAMPLE IN THE LAB", "LOGGING TOKENS/SEC", "OLLAMA LOADED A MODEL"],
    Security: ["CAMS ALL CLEAR", "ALL DOORS LOCKED", "NOTHING ON PATROL", "HALLS ARE QUIET"],
    Logistics: ["WO PACKETS SORTED", "ARCHIVE IS UP TO DATE", "SIGNED THE HANDOFF", "TIMESTAMPS MATCH"],
    Operations: ["DOCKER LOOKS HEALTHY", "NOTES ARE FILED", "LISTS ARE IN", "REPORT DUE SOON"],
    Sales: ["CLIENT WANTS SAMPLES", "NEW PITCH IDEA", "STOCK IS MOVING", "DEMO IS READY"],
    Maintenance: ["MOPPED THE HALLWAY", "RESTOCKED THE SOAP", "FIXED A STUCK DOOR", "BULB WAS OUT"],
    Executive: ["REPORTS ARE IN", "DEBRIEF AT SIX", "OWNER WANTS NOTES"],
    "Grow Ops": ["NEW HIRE PAPERWORK", "BADGES ARE READY", "FILING ALL DAY"],
  } as Record<string, string[]>,
  joke: ["MY PLANT IS TALLER", "THIS COFFEE IS SOUP", "I SPEAK FLUENT BEEP", "DID YOU TURN IT OFF", "BEEP BOOP, BOSS", "I AM 80% COFFEE"],
  gripe: ["THE FRIDGE IS EMPTY", "WHO TOOK MY MUG", "THE FAN IS LOUD", "MY FEET HURT", "TOO MANY ALERTS", "MEETING AGAIN?"],
  gossip: ["HEARD DAN IS TESTING", "THE BOSS IS IN A MOOD", "NEW HIRE COMING?", "THEY MOVED THE DESKS", "GIGI NEEDS A RAISE", "KNOX SAW NOTHING"],
  reply: ["HA, TRUE", "SAME HERE", "NO WAY", "TELL ME ABOUT IT", "I HEARD THAT TOO", "LOL OK", "ROUGH", "BACK TO WORK?", "FAIR POINT", "YEP YEP"],
  breakRoom: ["WHO WANTS COFFEE", "ANY SNACKS LEFT", "THIS MICROWAVE SMELLS", "SIT FOR A MINUTE"],
  fireDrill: ["R&D FIRE DRILL AGAIN", "KEEP EXTINGUISHER CLOSE", "SMOKE TEST WAS LOUD"],
  telemetryByRoom: {
    grow1: ["GROW 1 RUNS WARM", "BAK3RY IS SPIKING"],
    grow2: ["GROW 2 CPU IS HIGH", "HACK-SAFE RUNNING HOT"],
    grow3: ["GROW 3 RUNS HOT!", "GROW 3 IS YELLOWING"],
    grow4: ["GROW 4 STILL EMPTY", "NO FEED IN GROW 4"],
    clone: ["CLONE LAPTOP IS WARM", "CLONE RH IS DRIFTING"],
    mother: ["NUKEBOX FANS ARE LOUD", "MOTHER ROOM IS BUSY"],
    soil: ["GARDEN VM IS BUSY", "SWAP IS CREEPING UP"],
    vmCreations: ["CREATIONS VM: NO FEED", "VAULT STILL PENDING"],
    ops: ["DOCKER IS BUSY TODAY", "CONTAINERS RESTARTED"],
    rd1: ["OLLAMA LAG TODAY", "MODEL QUEUE IS BACKED UP"],
    rd2: ["TERMINALS ARE SLOW", "SSH TARGET WENT AWAY"],
    trim: ["TRIM QUEUE IS BACKED UP"],
    extract: ["EXTRACTOR TEMP IS UP"],
    sales: ["HOST CPU IS HOT"],
  } as Record<string, string[]>,
};

// ---------------------------------------------------------------------------
// Work schedules. Times are minutes since midnight on the facility clock,
// which simply follows the browser's wall-clock time of day.
// Defaults come from gen2DefaultSchedule(); edits are stored on the staff
// record (Grow Ops > Staff > SCHEDULE) in localStorage.
// ---------------------------------------------------------------------------

export type Gen2BreakSlot = { id: "morning" | "lunch" | "afternoon"; label: string; start: number; length: number };
export type Gen2Schedule = { shiftStart: number; shiftEnd: number; breaks: Gen2BreakSlot[] };
export type Gen2ScheduleBlock = { kind: "WORKING" | "BREAK" | "SHIFT END"; label: string; nextBreakLabel: string };

export const GEN2_BREAK_GRACE_MINUTES = 12;

const DEPARTMENT_BREAK_OFFSET: Record<string, number> = {
  Cultivation: 0, Processing: 15, Research: 30, Security: 45, Logistics: 20, Operations: 10, Sales: 25, Maintenance: 35, Executive: 5, "Grow Ops": 40,
};

export function gen2FormatClock(minutes: number): string {
  const total = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function gen2ParseClock(value: string, fallback: number): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return fallback;
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (hours > 24 || mins > 59 || (hours === 24 && mins > 0)) return fallback;
  return hours * 60 + mins;
}

export function gen2DefaultSchedule(id: string, department: string): Gen2Schedule {
  const offset = (DEPARTMENT_BREAK_OFFSET[department] ?? 0) + Math.floor(gen2Hash01(id, "break-offset") * 50);
  const allDay = department === "Security" || id === "maintenance" || id === "logistics";
  return {
    shiftStart: allDay ? 0 : 6 * 60 + Math.floor(gen2Hash01(id, "shift-start") * 4) * 15,
    shiftEnd: allDay ? 1440 : 21 * 60 + Math.floor(gen2Hash01(id, "shift-end") * 5) * 15,
    breaks: [
      { id: "morning", label: "MORNING BREAK", start: 9 * 60 + 15 + offset, length: 10 },
      { id: "lunch", label: "LUNCH", start: 11 * 60 + 45 + offset, length: 30 },
      { id: "afternoon", label: "AFTERNOON BREAK", start: 14 * 60 + 45 + offset, length: 10 },
    ],
  };
}

export function gen2NormalizeSchedule(value: unknown, id: string, department: string): Gen2Schedule {
  const fallback = gen2DefaultSchedule(id, department);
  const raw = value as Partial<Gen2Schedule> | undefined;
  if (!raw || typeof raw !== "object") return fallback;
  const clampMin = (input: unknown, def: number, max = 1440) => (Number.isFinite(input) ? Math.max(0, Math.min(max, Math.round(Number(input)))) : def);
  const breaks = fallback.breaks.map((slot) => {
    const stored = Array.isArray(raw.breaks) ? (raw.breaks.find((item) => item?.id === slot.id) as Partial<Gen2BreakSlot> | undefined) : undefined;
    return { ...slot, start: clampMin(stored?.start, slot.start, 1439), length: Math.max(0, Math.min(90, clampMin(stored?.length, slot.length, 90))) };
  });
  return { shiftStart: clampMin(raw.shiftStart, fallback.shiftStart), shiftEnd: clampMin(raw.shiftEnd, fallback.shiftEnd), breaks };
}

export function gen2OnShift(schedule: Gen2Schedule, minute: number): boolean {
  const { shiftStart: start, shiftEnd: end } = schedule;
  if (start === end) return true;
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}

/** Break slot whose start window (start .. start + grace) contains the minute, if any. */
export function gen2BreakWindowAt(schedule: Gen2Schedule, minute: number): Gen2BreakSlot | undefined {
  return schedule.breaks.find((slot) => slot.length > 0 && ((minute - slot.start + 1440) % 1440) < Math.max(slot.length, GEN2_BREAK_GRACE_MINUTES) + 1);
}

export function gen2ScheduleBlock(schedule: Gen2Schedule, minute: number, onBreakNow: boolean): Gen2ScheduleBlock {
  const upcoming = [...schedule.breaks]
    .filter((slot) => slot.length > 0)
    .map((slot) => ({ slot, wait: (slot.start - minute + 1440) % 1440 }))
    .sort((a, b) => a.wait - b.wait)[0];
  const nextBreakLabel = upcoming ? `${gen2FormatClock(upcoming.slot.start)} ${upcoming.slot.label}` : "NONE";
  if (!gen2OnShift(schedule, minute)) return { kind: "SHIFT END", label: `OFF SHIFT UNTIL ${gen2FormatClock(schedule.shiftStart)}`, nextBreakLabel };
  if (onBreakNow) return { kind: "BREAK", label: "ON BREAK", nextBreakLabel };
  const allDay = schedule.shiftStart === schedule.shiftEnd || (schedule.shiftStart === 0 && schedule.shiftEnd >= 1440);
  return { kind: "WORKING", label: allDay ? "24H SHIFT" : `UNTIL ${gen2FormatClock(schedule.shiftEnd)}`, nextBreakLabel };
}
