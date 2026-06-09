import { z } from "zod";
import {
  ALERT_CATEGORIES,
  ALERT_LEVELS,
  EMPLOYEE_STATES,
  EVENT_TYPES,
  INTERCOM_PRIORITIES,
  INTERCOM_TARGET_TYPES,
  REPORT_TYPES,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "../constants/domain";

export const employeeStateSchema = z.enum(EMPLOYEE_STATES);
export const alertLevelSchema = z.enum(ALERT_LEVELS);
export const alertCategorySchema = z.enum(ALERT_CATEGORIES);
export const taskStatusSchema = z.enum(TASK_STATUSES);
export const taskPrioritySchema = z.enum(TASK_PRIORITIES);
export const eventTypeSchema = z.enum(EVENT_TYPES);
export const intercomTargetTypeSchema = z.enum(INTERCOM_TARGET_TYPES);
export const intercomPrioritySchema = z.enum(INTERCOM_PRIORITIES);
export const reportTypeSchema = z.enum(REPORT_TYPES);

export const departmentSchema = z.object({
  id: z.number(),
  name: z.string(),
  status: z.string(),
  workload: z.number(),
});

export const roomSchema = z.object({
  id: z.number(),
  name: z.string(),
  department_id: z.number(),
  department: z.string(),
  department_status: z.string().optional(),
  workload: z.number().optional(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  cleanliness: z.number(),
  system_mapping: z.string(),
  current_issues: z.array(z.string()).optional(),
  recent_reports: z.array(z.string()).optional(),
});

export const taskSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  priority: taskPrioritySchema,
  status: taskStatusSchema,
  progress: z.number().default(0),
  source: z.string().nullable().optional(),
  department_id: z.number().nullable().optional(),
  room_id: z.number().nullable().optional(),
  assigned_employee_id: z.number().nullable().optional(),
  department: z.string().nullable().optional(),
  assigned_employee: z.string().nullable().optional(),
  created_at: z.string().optional(),
  due_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const createTaskSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().optional().default(""),
  priority: taskPrioritySchema.default("NORMAL"),
  departmentId: z.number().optional(),
  roomId: z.number().optional(),
  assignedEmployeeId: z.number().optional(),
  dueAt: z.string().optional(),
  notes: z.string().optional(),
});

export const intercomMessageSchema = z.object({
  id: z.number(),
  sender: z.string(),
  targetType: intercomTargetTypeSchema,
  targetId: z.number().nullable().optional(),
  message: z.string(),
  priority: intercomPrioritySchema,
  timestamp: z.string(),
  requiresAcknowledgement: z.boolean(),
  acknowledgedBy: z.array(z.number()).default([]),
  generatedTasks: z.array(taskSchema).default([]),
});

export const createIntercomMessageSchema = z.object({
  sender: z.string().trim().min(1).optional(),
  targetType: intercomTargetTypeSchema.default("GLOBAL"),
  targetId: z.number().optional(),
  message: z.string().trim().min(1),
  priority: intercomPrioritySchema.default("NORMAL"),
  requiresAcknowledgement: z.boolean().optional(),
});

export const employeeSchema = z.object({
  id: z.number(),
  name: z.string(),
  role: z.string(),
  department_id: z.number(),
  department: z.string(),
  assigned_room_id: z.number(),
  current_room_id: z.number(),
  current_location: z.string(),
  assigned_room: z.string(),
  state: employeeStateSchema,
  age: z.number(),
  sex: z.string(),
  mood: z.string(),
  hunger: z.number(),
  fatigue: z.number(),
  stamina: z.number(),
  iq: z.number(),
  stress: z.number(),
  productivity: z.number(),
  work_ethic: z.number().optional(),
  stress_tolerance: z.number().optional(),
  social_tendency: z.number().optional(),
  humor_level: z.number().optional(),
  personality_archetype: z.string().optional(),
  x: z.number(),
  y: z.number(),
  unread_messages: z.number(),
  current_task_id: z.number().nullable().optional(),
  current_task_title: z.string().nullable().optional(),
  schedule: z.string().optional(),
  priority_list: z.string().optional(),
  relationships: z.string().optional(),
  report_history: z.string().optional(),
  upcomingTasks: z.array(taskSchema).optional(),
  recentFinishedTasks: z.array(taskSchema).optional(),
  warnings: z.array(z.string()).optional(),
});

export const alertSchema = z.object({
  id: z.number(),
  level: alertLevelSchema,
  category: alertCategorySchema.default("SYSTEM"),
  title: z.string(),
  message: z.string(),
  created_at: z.string(),
});

export const reportSchema = z.object({
  id: z.number(),
  report_type: reportTypeSchema.or(z.string()).default("TASK_UPDATE"),
  department_id: z.number().nullable().optional(),
  room_id: z.number().nullable().optional(),
  source_employee_id: z.number().nullable().optional(),
  recipient_role: z.string().nullable().optional(),
  severity: alertLevelSchema.or(z.string()).default("INFO"),
  title: z.string(),
  body: z.string(),
  created_at: z.string(),
});

export const eventSchema = z.object({
  id: z.number().optional(),
  type: eventTypeSchema.or(z.string()),
  message: z.string(),
  entity_type: z.string().nullable().optional(),
  entity_id: z.number().nullable().optional(),
  payload: z.record(z.unknown()).optional().default({}),
  created_at: z.string().optional(),
});

export const simulationSnapshotSchema = z.object({
  tick: z.number(),
  tickMs: z.number(),
  rooms: z.array(roomSchema),
  employees: z.array(employeeSchema),
  events: z.array(eventSchema),
  reports: z.array(reportSchema).optional(),
});

export const bootstrapPayloadSchema = z.object({
  departments: z.array(departmentSchema),
  rooms: z.array(roomSchema),
  employees: z.array(employeeSchema),
  tasks: z.array(taskSchema),
  alerts: z.array(alertSchema),
  events: z.array(eventSchema),
  reports: z.array(reportSchema).optional(),
  settings: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
});

export type EmployeeState = z.infer<typeof employeeStateSchema>;
export type AlertLevel = z.infer<typeof alertLevelSchema>;
export type AlertCategory = z.infer<typeof alertCategorySchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type TaskPriority = z.infer<typeof taskPrioritySchema>;
export type IntercomTargetType = z.infer<typeof intercomTargetTypeSchema>;
export type IntercomPriority = z.infer<typeof intercomPrioritySchema>;
export type Department = z.infer<typeof departmentSchema>;
export type Room = z.infer<typeof roomSchema>;
export type Employee = z.infer<typeof employeeSchema>;
export type Task = z.infer<typeof taskSchema>;
export type Alert = z.infer<typeof alertSchema>;
export type Report = z.infer<typeof reportSchema>;
export type ActivityEvent = z.infer<typeof eventSchema>;
export type BootstrapPayload = z.infer<typeof bootstrapPayloadSchema>;
export type SimulationSnapshot = z.infer<typeof simulationSnapshotSchema>;
export type CreateTaskInput = z.input<typeof createTaskSchema>;
export type IntercomMessage = z.infer<typeof intercomMessageSchema>;
export type CreateIntercomMessageInput = z.input<typeof createIntercomMessageSchema>;
