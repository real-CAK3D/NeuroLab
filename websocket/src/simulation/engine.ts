import { appConfig, EMPLOYEE_STATES, type EmployeeState } from "../../../shared/index";
import { db } from "../database/db";
import { eventBus } from "../events/bus";

let lastEventAt = Date.now();

export function advanceSimulation(tick: number, tickMs: number) {
  advanceEmployees();
  maybeCreateSimulationEvent(tickMs);
  maybeCreateEmployeeReport(tick);
  maybeCreateManagerSummaries(tick);
  maybeCreateBossBriefing(tick);
}

function advanceEmployees() {
  const rows = db.prepare(`
    SELECT employees.*, rooms.x AS room_x, rooms.y AS room_y, rooms.width AS room_width, rooms.height AS room_height
    FROM employees
    JOIN rooms ON rooms.id = employees.assigned_room_id
  `).all() as Array<Record<string, any>>;

  const update = db.prepare(`
    UPDATE employees
    SET x = ?, y = ?, state = ?, mood = ?, hunger = ?, fatigue = ?, stamina = ?, stress = ?, productivity = ?
    WHERE id = ?
  `);

  const tx = db.transaction(() => {
    for (const employee of rows) {
      const pad = appConfig.simulation.employeeRoomPadding;
      const x = clamp(
        employee.x + randomInt(-appConfig.simulation.employeeStepRange.x, appConfig.simulation.employeeStepRange.x),
        employee.room_x + pad,
        employee.room_x + employee.room_width - pad,
      );
      const y = clamp(
        employee.y + randomInt(-appConfig.simulation.employeeStepRange.y, appConfig.simulation.employeeStepRange.y),
        employee.room_y + pad,
        employee.room_y + employee.room_height - pad,
      );
      const state = pickState(employee.state);
      update.run(
        x,
        y,
        state,
        moodForState(state, employee.mood),
        clamp(employee.hunger + randomInt(-1, 3), 0, 100),
        clamp(employee.fatigue + randomInt(-2, 4), 0, 100),
        clamp(employee.stamina + randomInt(-3, 2), 0, 100),
        clamp(employee.stress + randomInt(-2, 3), 0, 100),
        clamp(employee.productivity + randomInt(-2, 2), 0, 100),
        employee.id,
      );

      eventBus.publish({
        type: "EMPLOYEE_UPDATED",
        message: `${employee.name} state updated to ${state}.`,
        entity_type: "employee",
        entity_id: employee.id,
        payload: { x, y, state },
      });
    }
  });

  tx();
}

function maybeCreateSimulationEvent(tickMs: number) {
  if (Date.now() - lastEventAt < tickMs * 2) return;
  lastEventAt = Date.now();
  const employee = db.prepare("SELECT id, name, role, state FROM employees ORDER BY RANDOM() LIMIT 1").get() as Record<string, any>;
  if (!employee) return;
  const templates = [
    `${employee.name} is ${String(employee.state).toLowerCase()} in assigned coverage.`,
    `${employee.role} checkpoint updated for the live floor.`,
    `${employee.name} logged a simulated status pulse.`,
  ];
  eventBus.publish({
    type: "SIMULATION",
    message: templates[randomInt(0, templates.length - 1)],
    entity_type: "employee",
    entity_id: employee.id,
    payload: { state: employee.state },
  });
}

function maybeCreateEmployeeReport(tick: number) {
  if (tick % 3 !== 0) return;
  const employee = db.prepare(`
    SELECT employees.*, departments.name AS department, rooms.name AS room
    FROM employees
    JOIN departments ON departments.id = employees.department_id
    JOIN rooms ON rooms.id = employees.current_room_id
    WHERE employees.role NOT LIKE '%Manager%' AND employees.role != 'Boss'
    ORDER BY
      CASE
        WHEN employees.stress >= 75 THEN 0
        WHEN employees.fatigue >= 80 THEN 1
        WHEN employees.hunger >= 80 THEN 2
        ELSE 3
      END,
      RANDOM()
    LIMIT 1
  `).get() as Record<string, any> | undefined;
  if (!employee) return;

  const report = employeeReportFor(employee);
  const manager = findManager(employee.department_id);
  insertReport(report.type, employee.department_id, employee.current_room_id, employee.id, manager ? "MANAGER" : "BOSS", report.severity, report.title, report.body);
  if (manager) {
    db.prepare("INSERT INTO messages (employee_id, body) VALUES (?, ?)").run(manager.id, `${employee.name}: ${report.body}`);
    db.prepare("UPDATE employees SET unread_messages = unread_messages + 1 WHERE id = ?").run(manager.id);
  }

  eventBus.publish({
    type: "MANAGER_REPORT",
    message: `${employee.name} sent ${report.type.toLowerCase().replaceAll("_", " ")} to ${manager?.name ?? "Boss"}.`,
    entity_type: "employee",
    entity_id: employee.id,
    payload: { report, managerId: manager?.id ?? null },
  });
}

function maybeCreateManagerSummaries(tick: number) {
  if (tick % appConfig.simulation.managerReportIntervalTicks !== 0) return;
  const departments = db.prepare("SELECT * FROM departments ORDER BY workload DESC, id LIMIT 3").all() as Array<Record<string, any>>;
  for (const department of departments) {
    const recent = db.prepare(`
      SELECT report_type, severity, title
      FROM reports
      WHERE department_id = ? AND report_type NOT IN ('MANAGER_SUMMARY', 'BOSS_BRIEFING')
      ORDER BY id DESC
      LIMIT 4
    `).all(department.id) as Array<Record<string, any>>;
    const manager = findManager(department.id);
    const title = `${department.name} manager summary`;
    const body = recent.length
      ? `${department.name} has ${recent.length} fresh updates. Top note: ${recent[0].title}. Workload is ${department.workload}%.`
      : `${department.name} is stable. Workload is ${department.workload}% with no urgent employee reports.`;
    insertReport("MANAGER_SUMMARY", department.id, null, manager?.id ?? null, "BOSS", highestSeverity(recent), title, body);
    eventBus.publish({
      type: "MANAGER_REPORT",
      message: body,
      entity_type: "department",
      entity_id: department.id,
      payload: { managerId: manager?.id ?? null, recent },
    });
  }
}

function maybeCreateBossBriefing(tick: number) {
  if (tick % appConfig.simulation.bossBriefingIntervalTicks !== 0) return;
  const summaries = db.prepare(`
    SELECT reports.*, departments.name AS department
    FROM reports
    LEFT JOIN departments ON departments.id = reports.department_id
    WHERE report_type = 'MANAGER_SUMMARY'
    ORDER BY reports.id DESC
    LIMIT 4
  `).all() as Array<Record<string, any>>;
  const urgent = summaries.find((summary) => ["WARNING", "CRITICAL"].includes(summary.severity));
  const body = summaries.length
    ? `Boss briefing: ${summaries.map((summary) => `${summary.department ?? "General"} ${String(summary.severity).toLowerCase()}`).join("; ")}. ${urgent ? "Recommend reviewing the highest severity department first." : "No urgent escalation right now."}`
    : "Boss briefing: facility is online and waiting for manager summaries.";
  const boss = db.prepare("SELECT id FROM employees WHERE role = 'Boss' ORDER BY id LIMIT 1").get() as { id: number } | undefined;
  insertReport("BOSS_BRIEFING", null, null, boss?.id ?? null, "USER", urgent?.severity ?? "INFO", "Boss facility briefing", body);
  eventBus.publish({
    type: "BOSS_BRIEFING",
    message: body,
    entity_type: "boss",
    entity_id: boss?.id ?? null,
    payload: { summaries },
  });
}

function employeeReportFor(employee: Record<string, any>) {
  if (employee.stress >= 75) {
    return {
      type: "WORKLOAD_WARNING",
      severity: employee.stress >= 90 ? "CRITICAL" : "WARNING",
      title: `${employee.name} workload warning`,
      body: `${employee.department} stress is high in ${employee.room}. Current stress: ${employee.stress}%.`,
    };
  }
  if (employee.fatigue >= 80 || employee.hunger >= 80) {
    return {
      type: "EMPLOYEE_COMPLAINT",
      severity: "NOTICE",
      title: `${employee.name} needs recovery`,
      body: `${employee.name} reports fatigue ${employee.fatigue}% and hunger ${employee.hunger}%.`,
    };
  }
  if (employee.state === "THINKING") {
    return {
      type: "OPTIMIZATION_SUGGESTION",
      severity: "INFO",
      title: `${employee.name} has an optimization note`,
      body: `${employee.name} suggests reviewing ${employee.department} workflow timing.`,
    };
  }
  return {
    type: "TASK_UPDATE",
    severity: "INFO",
    title: `${employee.name} status update`,
    body: `${employee.name} is ${String(employee.state).toLowerCase()} in ${employee.room}.`,
  };
}

function findManager(departmentId: number) {
  return db.prepare(`
    SELECT id, name FROM employees
    WHERE department_id = ? AND role LIKE '%Manager%'
    UNION
    SELECT id, name FROM employees
    WHERE role LIKE '%Manager%'
    ORDER BY id
    LIMIT 1
  `).get(departmentId) as { id: number; name: string } | undefined;
}

function insertReport(type: string, departmentId: number | null, roomId: number | null, sourceEmployeeId: number | null, recipientRole: string, severity: string, title: string, body: string) {
  db.prepare(`
    INSERT INTO reports (report_type, department_id, room_id, source_employee_id, recipient_role, severity, title, body)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(type, departmentId, roomId, sourceEmployeeId, recipientRole, severity, title, body);
}

function highestSeverity(reports: Array<Record<string, any>>) {
  const order = ["INFO", "NOTICE", "WARNING", "CRITICAL"];
  return reports.reduce((highest, report) => {
    return order.indexOf(report.severity) > order.indexOf(highest) ? report.severity : highest;
  }, "INFO");
}

function pickState(current: EmployeeState) {
  if (Math.random() < 0.55) return current === "IDLE" ? "WORKING" : current;
  const states = EMPLOYEE_STATES.filter((state) => !["ALERT", "COMPLAINING"].includes(state));
  return states[randomInt(0, states.length - 1)];
}

function moodForState(state: string, fallback: string) {
  const moods: Record<string, string> = {
    WORKING: "Focused",
    MOVING: "In transit",
    CLEANING: "Diligent",
    RESTING: "Recovering",
    SOCIALIZING: "Chatty",
    REPORTING: "Precise",
    THINKING: "Deep focus",
    WAITING: "Patient",
    ON_BREAK: "Relaxed",
    TALKING: "Chatty",
    ASSIGNED: "Ready",
    IDLE: "Calm",
  };
  return moods[state] || fallback || "Neutral";
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
