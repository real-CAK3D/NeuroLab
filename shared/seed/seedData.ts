import type { TaskPriority, TaskStatus } from "../schemas/domain";

export const departmentSeeds = [
  { name: "Boss Office", status: "Command-ready", workload: 42 },
  { name: "Cultivation", status: "Stable canopy", workload: 76 },
  { name: "Processing", status: "Batch queue active", workload: 61 },
  { name: "Extraction", status: "Read-only standby", workload: 34 },
  { name: "R&D", status: "Trial observations", workload: 53 },
  { name: "Security", status: "Monitoring", workload: 48 },
  { name: "Logistics", status: "Receiving prep", workload: 57 },
  { name: "Sales", status: "Client follow-ups", workload: 44 },
  { name: "Break Room", status: "Available", workload: 12 },
  { name: "Storage", status: "Inventory normal", workload: 39 },
] as const;

export const roomSeeds = [
  { name: "Boss Office", department: "Boss Office", x: 24, y: 24, width: 170, height: 172, cleanliness: 92, systemMapping: "command.office" },
  { name: "Clone Room", department: "Cultivation", x: 214, y: 24, width: 120, height: 120, cleanliness: 95, systemMapping: "cultivation.clone" },
  { name: "Mother Room", department: "Cultivation", x: 334, y: 24, width: 150, height: 120, cleanliness: 93, systemMapping: "cultivation.mother" },
  { name: "Processing/Trim Room", department: "Processing", x: 500, y: 24, width: 184, height: 144, cleanliness: 83, systemMapping: "processing.trim" },
  { name: "Packaging Room", department: "Processing", x: 684, y: 24, width: 108, height: 144, cleanliness: 87, systemMapping: "processing.package" },
  { name: "Extraction Lab", department: "Extraction", x: 792, y: 24, width: 110, height: 144, cleanliness: 94, systemMapping: "extraction.lab" },
  { name: "Security Office", department: "Security", x: 918, y: 24, width: 68, height: 188, cleanliness: 86, systemMapping: "security.watch" },
  { name: "Grow Room 1", department: "Cultivation", x: 214, y: 160, width: 135, height: 112, cleanliness: 91, systemMapping: "cultivation.grow1" },
  { name: "Grow Room 2", department: "Cultivation", x: 349, y: 160, width: 135, height: 112, cleanliness: 89, systemMapping: "cultivation.grow2" },
  { name: "Soil/Nutrition Prep", department: "Cultivation", x: 104, y: 318, width: 96, height: 118, cleanliness: 80, systemMapping: "cultivation.nutrients" },
  { name: "Storage", department: "Storage", x: 214, y: 286, width: 94, height: 150, cleanliness: 79, systemMapping: "storage.inventory" },
  { name: "Cultivation Manager Office", department: "Cultivation", x: 322, y: 286, width: 162, height: 150, cleanliness: 90, systemMapping: "cultivation.manager" },
  { name: "Operations Manager Office", department: "Boss Office", x: 500, y: 184, width: 112, height: 84, cleanliness: 88, systemMapping: "ops.manager" },
  { name: "Break Room/Kitchen", department: "Break Room", x: 548, y: 318, width: 192, height: 132, cleanliness: 78, systemMapping: "staff.breakroom" },
  { name: "Bathroom", department: "Break Room", x: 748, y: 318, width: 80, height: 112, cleanliness: 81, systemMapping: "staff.bathroom" },
  { name: "Logistics Warehouse", department: "Logistics", x: 756, y: 496, width: 230, height: 260, cleanliness: 76, systemMapping: "logistics.warehouse" },
  { name: "Loading Dock", department: "Logistics", x: 756, y: 430, width: 230, height: 66, cleanliness: 72, systemMapping: "logistics.dock" },
  { name: "Sales Office", department: "Sales", x: 24, y: 598, width: 260, height: 158, cleanliness: 86, systemMapping: "sales.office" },
  { name: "Meeting Room", department: "Boss Office", x: 24, y: 452, width: 170, height: 96, cleanliness: 84, systemMapping: "meetings.core" },
  { name: "R&D Lab", department: "R&D", x: 324, y: 598, width: 222, height: 158, cleanliness: 91, systemMapping: "research.lab" },
  { name: "R&D Test Room", department: "R&D", x: 546, y: 598, width: 190, height: 158, cleanliness: 88, systemMapping: "research.test" },
] as const;

export const employeePresetSeeds = [
  { role: "Boss", baseState: "REPORTING", defaultDepartment: "Boss Office", iq: 130, workEthic: 88, stressTolerance: 84, socialTendency: 62, humorLevel: 48, personalityArchetype: "strategist" },
  { role: "Manager", baseState: "REPORTING", defaultDepartment: "Boss Office", iq: 122, workEthic: 84, stressTolerance: 78, socialTendency: 70, humorLevel: 42, personalityArchetype: "coordinator" },
  { role: "Cultivation Worker", baseState: "WORKING", defaultDepartment: "Cultivation", iq: 108, workEthic: 76, stressTolerance: 68, socialTendency: 58, humorLevel: 54, personalityArchetype: "caretaker" },
  { role: "Processing Worker", baseState: "WORKING", defaultDepartment: "Processing", iq: 107, workEthic: 78, stressTolerance: 66, socialTendency: 50, humorLevel: 45, personalityArchetype: "operator" },
  { role: "Extraction Tech", baseState: "THINKING", defaultDepartment: "Extraction", iq: 118, workEthic: 75, stressTolerance: 72, socialTendency: 42, humorLevel: 38, personalityArchetype: "specialist" },
  { role: "R&D Tech", baseState: "THINKING", defaultDepartment: "R&D", iq: 126, workEthic: 73, stressTolerance: 70, socialTendency: 46, humorLevel: 58, personalityArchetype: "experimenter" },
  { role: "Security", baseState: "ALERT", defaultDepartment: "Security", iq: 114, workEthic: 82, stressTolerance: 88, socialTendency: 36, humorLevel: 28, personalityArchetype: "watcher" },
  { role: "Logistics", baseState: "MOVING", defaultDepartment: "Logistics", iq: 104, workEthic: 79, stressTolerance: 74, socialTendency: 64, humorLevel: 52, personalityArchetype: "runner" },
  { role: "Sales", baseState: "TALKING", defaultDepartment: "Sales", iq: 116, workEthic: 72, stressTolerance: 64, socialTendency: 86, humorLevel: 70, personalityArchetype: "connector" },
] as const;

export const employeeSeeds = [
  { name: "Avery Voss", role: "Boss", department: "Boss Office", assignedRoom: "Boss Office", age: 44, sex: "F", mood: "Focused", iq: 132 },
  { name: "Marcus Chen", role: "Manager", department: "Boss Office", assignedRoom: "Operations Manager Office", age: 39, sex: "M", mood: "Analytical", iq: 124 },
  { name: "Priya Sato", role: "Manager", department: "Cultivation", assignedRoom: "Cultivation Manager Office", age: 36, sex: "F", mood: "Calm", iq: 121 },
  { name: "Dina Alvarez", role: "Cultivation Worker", department: "Cultivation", assignedRoom: "Grow Room 1", age: 29, sex: "F", mood: "Steady", iq: 108 },
  { name: "Noah Reed", role: "Cultivation Worker", department: "Cultivation", assignedRoom: "Grow Room 2", age: 31, sex: "M", mood: "Upbeat", iq: 104 },
  { name: "Lena Brooks", role: "Cultivation Worker", department: "Cultivation", assignedRoom: "Clone Room", age: 27, sex: "F", mood: "Curious", iq: 112 },
  { name: "Owen Patel", role: "Processing Worker", department: "Processing", assignedRoom: "Processing/Trim Room", age: 33, sex: "M", mood: "Methodical", iq: 106 },
  { name: "Maya Klein", role: "Processing Worker", department: "Processing", assignedRoom: "Packaging Room", age: 28, sex: "F", mood: "Efficient", iq: 110 },
  { name: "Theo James", role: "R&D Tech", department: "R&D", assignedRoom: "R&D Lab", age: 35, sex: "M", mood: "Inventive", iq: 129 },
  { name: "Samira Ford", role: "Security", department: "Security", assignedRoom: "Security Office", age: 41, sex: "F", mood: "Alert", iq: 115 },
  { name: "Gabe Torres", role: "Logistics", department: "Logistics", assignedRoom: "Logistics Warehouse", age: 32, sex: "M", mood: "Busy", iq: 103 },
  { name: "Iris Morgan", role: "Sales", department: "Sales", assignedRoom: "Sales Office", age: 30, sex: "F", mood: "Persuasive", iq: 118 },
] as const;

export const taskSeeds: Array<{
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  department: string;
  source: string;
}> = [
  { title: "Review morning facility status", description: "Boss console placeholder task.", priority: "NORMAL", status: "QUEUED", department: "Boss Office", source: "seed" },
  { title: "Check grow room cleanliness", description: "Routine simulated inspection.", priority: "HIGH", status: "ASSIGNED", department: "Cultivation", source: "seed" },
  { title: "Package sample batch", description: "Processing queue placeholder.", priority: "NORMAL", status: "IN_PROGRESS", department: "Processing", source: "seed" },
];

export const alertSeeds = [
  { level: "INFO", category: "SYSTEM", title: "Simulation online", message: "Hybrid tick engine initialized with mocked infrastructure." },
  { level: "NOTICE", category: "SYSTEM", title: "Monitor read-only", message: "Monitor daemon is returning mock stats only." },
] as const;

export const animationSeeds = [
  { key: "employee-idle", sprite: "clean-room-rpg-placeholder-v1", frames: "[\"idle_down\",\"idle_up\",\"idle_left\",\"idle_right\"]", frameRate: 1 },
  { key: "employee-walk", sprite: "clean-room-rpg-placeholder-v1", frames: "[\"walk_down\",\"walk_up\",\"walk_left\",\"walk_right\"]", frameRate: 6 },
] as const;

export const emoteSeeds = [
  { key: "focused", label: "Focused", icon: "WRK" },
  { key: "tired", label: "Tired", icon: "zzz" },
  { key: "annoyed", label: "Annoyed", icon: "..." },
  { key: "reporting", label: "Reporting", icon: "RPT" },
] as const;
