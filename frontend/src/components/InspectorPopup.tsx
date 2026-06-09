import { useEffect, useState } from "react";
import type { Employee, Room, Task } from "../types/domain";
import { useNeuroLabStore } from "../store/useNeuroLabStore";
import { getEmployee, getRoom } from "../utils/api";

export function InspectorPopup() {
  const employeeId = useNeuroLabStore((state) => state.selectedEmployeeId);
  const roomId = useNeuroLabStore((state) => state.selectedRoomId);
  const clearEmployee = useNeuroLabStore((state) => state.selectEmployee);
  const clearRoom = useNeuroLabStore((state) => state.selectRoom);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [room, setRoom] = useState<(Room & Record<string, unknown>) | null>(null);

  useEffect(() => {
    setEmployee(null);
    if (employeeId) getEmployee(employeeId).then(setEmployee).catch(() => setEmployee(null));
  }, [employeeId]);

  useEffect(() => {
    setRoom(null);
    if (roomId) getRoom(roomId).then((data) => setRoom(data as Room & Record<string, unknown>)).catch(() => setRoom(null));
  }, [roomId]);

  if (!employeeId && !roomId) return null;

  return (
    <div className="absolute bottom-4 left-4 z-20 max-h-[78vh] w-[min(420px,calc(100vw-2rem))] overflow-y-auto rounded-md border border-lab-line bg-lab-panel/95 p-4 shadow-2xl">
      <button className="float-right text-lab-mist/70 hover:text-white" onClick={() => { clearEmployee(undefined); clearRoom(undefined); }}>Close</button>
      {employeeId && employee && <EmployeeView employee={employee} />}
      {roomId && room && <RoomView room={room} />}
      {((employeeId && !employee) || (roomId && !room)) && <p className="text-lab-mist">Loading detail...</p>}
    </div>
  );
}

function EmployeeView({ employee }: { employee: Employee }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-white">{employee.name}</h2>
      <p className="mb-3 text-sm text-lab-mist/70">{employee.role} / {employee.department}</p>
      <InfoGrid items={[
        ["Age", employee.age], ["Sex", employee.sex], ["Mood", employee.mood], ["Hunger", `${employee.hunger}%`],
        ["Fatigue", `${employee.fatigue}%`], ["Stamina", `${employee.stamina}%`], ["IQ", employee.iq],
        ["Stress", `${employee.stress}%`], ["Productivity", `${employee.productivity}%`],
        ["Current task", employee.current_task_title || "None"], ["Location", employee.current_location],
        ["Unread messages", employee.unread_messages],
      ]} />
      <List title="Upcoming Tasks" items={(employee.upcomingTasks || []).map((task: Task) => task.title)} empty="No upcoming tasks" />
      <List title="Recent Finished Tasks" items={(employee.recentFinishedTasks || []).map((task: Task) => task.title)} empty="No finished tasks yet" />
      <List title="Warnings/Needs" items={employee.warnings || []} empty="No warnings" />
      <List title="Actions" items={["Talk", "Assign Task", "Move to Department", "Send to Break Room", "Request Report", "Trigger Emote", "Change Priority", "View History", "Add to Task"]} empty="" />
    </div>
  );
}

function RoomView({ room }: { room: Room & Record<string, unknown> }) {
  const staff = ((room.assignedStaff as Employee[]) || []).map((employee) => `${employee.name} (${employee.state})`);
  const taskQueue = ((room.taskQueue as { title: string }[]) || []).map((task) => task.title);
  const activeEvents = ((room.activeEvents as { message: string }[]) || []).map((event) => event.message);
  return (
    <div>
      <h2 className="text-lg font-semibold text-white">{room.name}</h2>
      <p className="mb-3 text-sm text-lab-mist/70">{room.department}</p>
      <InfoGrid items={[
        ["Department status", String(room.department_status || "Online")],
        ["Workload", `${room.workload || 0}%`],
        ["Cleanliness", `${room.cleanliness}%`],
        ["System mapping", room.system_mapping],
      ]} />
      <List title="Assigned Staff" items={staff} empty="No assigned staff" />
      <List title="Active Events" items={activeEvents} empty="No active events" />
      <List title="Current Issues" items={(room.current_issues as string[]) || []} empty="No current issues" />
      <List title="Recent Reports" items={(room.recent_reports as string[]) || []} empty="No recent reports" />
      <List title="Task Queue" items={taskQueue} empty="No queued tasks" />
    </div>
  );
}

function InfoGrid({ items }: { items: [string, string | number][] }) {
  return (
    <dl className="mb-3 grid grid-cols-2 gap-2 text-sm">
      {items.map(([label, value]) => (
        <div className="rounded border border-lab-line/70 bg-black/20 p-2" key={label}>
          <dt className="text-lab-mist/60">{label}</dt>
          <dd className="text-white">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function List({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <section className="mb-3">
      <h3 className="mb-1 text-sm font-semibold text-lab-mist">{title}</h3>
      <div className="space-y-1">
        {(items.length ? items : [empty]).map((item, index) => (
          <div className="feed-item" key={`${title}-${index}`}>{item}</div>
        ))}
      </div>
    </section>
  );
}

