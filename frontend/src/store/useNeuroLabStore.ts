import { create } from "zustand";
import type { ActivityEvent, Alert, Department, Employee, Report, Room, SimulationSnapshot, Task } from "../types/domain";

interface NeuroLabState {
  departments: Department[];
  rooms: Room[];
  employees: Employee[];
  tasks: Task[];
  alerts: Alert[];
  events: ActivityEvent[];
  reports: Report[];
  tick: number;
  tickMs: number;
  selectedEmployeeId?: number;
  selectedRoomId?: number;
  setBootstrap: (data: {
    departments: Department[];
    rooms: Room[];
    employees: Employee[];
    tasks: Task[];
    alerts: Alert[];
    events: ActivityEvent[];
    reports?: Report[];
  }) => void;
  applySnapshot: (snapshot: SimulationSnapshot) => void;
  setTasks: (tasks: Task[]) => void;
  selectEmployee: (id?: number) => void;
  selectRoom: (id?: number) => void;
}

export const useNeuroLabStore = create<NeuroLabState>((set) => ({
  departments: [],
  rooms: [],
  employees: [],
  tasks: [],
  alerts: [],
  events: [],
  reports: [],
  tick: 0,
  tickMs: 3000,
  setBootstrap: (data) => set(data),
  applySnapshot: (snapshot) =>
    set({
      rooms: snapshot.rooms,
      employees: snapshot.employees,
      events: snapshot.events,
      reports: snapshot.reports ?? [],
      tick: snapshot.tick,
      tickMs: snapshot.tickMs,
    }),
  setTasks: (tasks) => set({ tasks }),
  selectEmployee: (id) => set({ selectedEmployeeId: id, selectedRoomId: undefined }),
  selectRoom: (id) => set({ selectedRoomId: id, selectedEmployeeId: undefined }),
}));
