export const simulationConfig = {
  simulationTickMs: 3000,
  renderTickMs: 1000 / 60,
  infrastructurePollingMs: 10000,
  aiReportGenerationMs: 30000,
  managerReportIntervalTicks: 10,
  bossBriefingIntervalTicks: 20,
  employeeDecisionIntervalTicks: 1,
  employeeRoomPadding: 18,
  employeeStepRange: { x: 28, y: 22 },
} as const;

export const roomBehaviorConfig = {
  cleanlinessWarning: 65,
  highWorkload: 75,
  criticalWorkload: 90,
} as const;

export const employeeDefaultsConfig = {
  hunger: { min: 12, max: 45 },
  fatigue: { min: 10, max: 42 },
  stamina: { min: 62, max: 96 },
  stress: { min: 12, max: 48 },
  productivity: { min: 58, max: 94 },
  workEthic: { min: 55, max: 95 },
  stressTolerance: { min: 45, max: 92 },
  socialTendency: { min: 20, max: 86 },
  humorLevel: { min: 10, max: 82 },
} as const;

export const alertThresholdConfig = {
  cpuNotice: 75,
  cpuWarning: 85,
  cpuCritical: 95,
  memoryNotice: 70,
  memoryWarning: 85,
  memoryCritical: 95,
  diskNotice: 75,
  diskWarning: 85,
  diskCritical: 95,
  employeeStressWarning: 75,
  employeeFatigueWarning: 80,
} as const;

export const dockerControlConfig = {
  enableDockerControl: false,
  allowlistedContainers: [] as string[],
  requireConfirmation: true,
} as const;

export const aiServiceConfig = {
  enableOllama: false,
  ollamaBaseUrl: "http://localhost:11434",
  model: "llama3.1",
  timeoutMs: 10000,
} as const;

export const intercomConfig = {
  defaultSender: "Boss Console",
  requiresAcknowledgementAt: "HIGH",
  maxHistory: 20,
  generatedTaskSource: "intercom",
} as const;

export const spriteConfig = {
  placeholderSpriteSet: "clean-room-rpg-placeholder-v1",
  characterWidth: 28,
  characterHeight: 40,
  directions: ["down", "up", "left", "right"],
  departmentAccents: {
    boss: "#f6c85f",
    managers: "#61d6ff",
    cultivation: "#39d98a",
    processing: "#f59f52",
    research: "#bda1ff",
    security: "#ff6b6b",
    logistics: "#f6d365",
    sales: "#45d6c8",
    default: "#8debc9",
  },
} as const;

export const uiSettingsConfig = {
  tileSize: 48,
  mapWidth: 1000,
  mapHeight: 810,
  defaultPanelWidth: 360,
  placeholderSpriteSet: spriteConfig.placeholderSpriteSet,
} as const;

export const appConfig = {
  simulation: simulationConfig,
  rooms: roomBehaviorConfig,
  employeeDefaults: employeeDefaultsConfig,
  alerts: alertThresholdConfig,
  dockerControl: dockerControlConfig,
  ai: aiServiceConfig,
  intercom: intercomConfig,
  sprites: spriteConfig,
  ui: uiSettingsConfig,
} as const;
