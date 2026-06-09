import { db } from "./db";

export function buildSnapshot(tick: number, tickMs: number) {
  return {
    tick,
    tickMs,
    employees: db.prepare(`
      SELECT employees.*, departments.name AS department, rooms.name AS current_location, assigned_rooms.name AS assigned_room,
        current_tasks.title AS current_task_title
      FROM employees
      JOIN departments ON departments.id = employees.department_id
      JOIN rooms ON rooms.id = employees.current_room_id
      JOIN rooms AS assigned_rooms ON assigned_rooms.id = employees.assigned_room_id
      LEFT JOIN tasks AS current_tasks ON current_tasks.id = employees.current_task_id
      ORDER BY employees.id
    `).all(),
    rooms: db.prepare(`
      SELECT rooms.*, departments.name AS department, departments.status AS department_status, departments.workload
      FROM rooms
      JOIN departments ON departments.id = rooms.department_id
      ORDER BY rooms.id
    `).all(),
    events: db.prepare("SELECT * FROM events ORDER BY id DESC LIMIT 30").all().reverse(),
    reports: db.prepare(`
      SELECT reports.*, departments.name AS department, rooms.name AS room, employees.name AS source_employee
      FROM reports
      LEFT JOIN departments ON departments.id = reports.department_id
      LEFT JOIN rooms ON rooms.id = reports.room_id
      LEFT JOIN employees ON employees.id = reports.source_employee_id
      ORDER BY reports.id DESC
      LIMIT 20
    `).all(),
  };
}
