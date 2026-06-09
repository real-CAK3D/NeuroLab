import { db } from "./db";

export function employeesQuery(where = "1=1") {
  return db.prepare(`
    SELECT employees.*, departments.name AS department, rooms.name AS current_location, assigned_rooms.name AS assigned_room,
      current_tasks.title AS current_task_title
    FROM employees
    JOIN departments ON departments.id = employees.department_id
    JOIN rooms ON rooms.id = employees.current_room_id
    JOIN rooms AS assigned_rooms ON assigned_rooms.id = employees.assigned_room_id
    LEFT JOIN tasks AS current_tasks ON current_tasks.id = employees.current_task_id
    WHERE ${where}
    ORDER BY employees.id
  `);
}

export function tasksQuery(where = "1=1") {
  return db.prepare(`
    SELECT tasks.*, departments.name AS department, employees.name AS assigned_employee
    FROM tasks
    LEFT JOIN departments ON departments.id = tasks.department_id
    LEFT JOIN employees ON employees.id = tasks.assigned_employee_id
    WHERE ${where}
    ORDER BY tasks.id DESC
  `);
}

export function roomsQuery(where = "1=1") {
  return db.prepare(`
    SELECT rooms.*, departments.name AS department, departments.status AS department_status, departments.workload
    FROM rooms
    JOIN departments ON departments.id = rooms.department_id
    WHERE ${where}
    ORDER BY rooms.id
  `);
}

export function reportsQuery(where = "1=1") {
  return db.prepare(`
    SELECT reports.*, departments.name AS department, rooms.name AS room, employees.name AS source_employee
    FROM reports
    LEFT JOIN departments ON departments.id = reports.department_id
    LEFT JOIN rooms ON rooms.id = reports.room_id
    LEFT JOIN employees ON employees.id = reports.source_employee_id
    WHERE ${where}
    ORDER BY reports.id DESC
  `);
}
