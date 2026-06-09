import { FormEvent, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createTask, getBootstrap, getIntercomHistory, sendIntercom } from "../utils/api";
import { useNeuroLabStore } from "../store/useNeuroLabStore";
import type { IntercomMessage, IntercomPriority, IntercomTargetType, TaskPriority } from "../types/domain";

export function BossConsole() {
  const departments = useNeuroLabStore((state) => state.departments);
  const alerts = useNeuroLabStore((state) => state.alerts);
  const events = useNeuroLabStore((state) => state.events);
  const tasks = useNeuroLabStore((state) => state.tasks);
  const reports = useNeuroLabStore((state) => state.reports);
  const setBootstrap = useNeuroLabStore((state) => state.setBootstrap);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("NORMAL");
  const [departmentId, setDepartmentId] = useState<number | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [intercomText, setIntercomText] = useState("");
  const [intercomTarget, setIntercomTarget] = useState<IntercomTargetType>("GLOBAL");
  const [intercomTargetId, setIntercomTargetId] = useState<number | undefined>();
  const [intercomPriority, setIntercomPriority] = useState<IntercomPriority>("NORMAL");
  const [intercomHistory, setIntercomHistory] = useState<IntercomMessage[]>([]);
  const [isSendingIntercom, setIsSendingIntercom] = useState(false);

  useEffect(() => {
    getIntercomHistory().then(setIntercomHistory).catch(() => setIntercomHistory([]));
  }, []);

  async function submitTask(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setIsSaving(true);
    try {
      await createTask({ title, priority, departmentId });
      setBootstrap(await getBootstrap());
      setTitle("");
    } finally {
      setIsSaving(false);
    }
  }

  async function submitIntercom(event: FormEvent) {
    event.preventDefault();
    if (!intercomText.trim()) return;
    setIsSendingIntercom(true);
    try {
      const sent = await sendIntercom({
        targetType: intercomTarget,
        targetId: needsTargetId(intercomTarget) ? intercomTargetId : undefined,
        priority: intercomPriority,
        message: intercomText,
      });
      setIntercomHistory((current) => [sent, ...current].slice(0, 20));
      setBootstrap(await getBootstrap());
      setIntercomText("");
    } finally {
      setIsSendingIntercom(false);
    }
  }

  return (
    <aside className="flex h-full flex-col gap-3 overflow-y-auto border-l border-lab-line bg-lab-panel p-3">
      <Panel title="Global Commands">
        <div className="grid grid-cols-2 gap-2">
          <button className="command-button">Hold</button>
          <button className="command-button">Brief</button>
          <button className="command-button">Sweep</button>
          <button className="command-button">Report</button>
        </div>
      </Panel>
      <Panel title="Intercom">
        <form onSubmit={submitIntercom} className="space-y-2">
          <input className="field" value={intercomText} onChange={(event) => setIntercomText(event.target.value)} placeholder="Broadcast message" />
          <div className="grid grid-cols-2 gap-2">
            <select className="field" value={intercomTarget} onChange={(event) => {
              setIntercomTarget(event.target.value as IntercomTargetType);
              setIntercomTargetId(undefined);
            }}>
              {["GLOBAL", "DEPARTMENT", "MANAGER", "EMERGENCY"].map((item) => <option key={item}>{item}</option>)}
            </select>
            <select className="field" value={intercomPriority} onChange={(event) => setIntercomPriority(event.target.value as IntercomPriority)}>
              {["LOW", "NORMAL", "HIGH", "EMERGENCY"].map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
          {needsTargetId(intercomTarget) ? (
            <select className="field" value={intercomTargetId ?? ""} onChange={(event) => setIntercomTargetId(event.target.value ? Number(event.target.value) : undefined)}>
              <option value="">Select department</option>
              {departments.map((department) => <option value={department.id} key={department.id}>{department.name}</option>)}
            </select>
          ) : null}
          <button className="primary-button" disabled={isSendingIntercom}>{isSendingIntercom ? "Sending" : "Send Intercom"}</button>
        </form>
        <div className="mt-2 space-y-1">
          {intercomHistory.slice(0, 3).map((message) => (
            <div className="feed-item" key={message.id}>
              <strong>{message.priority}</strong> {message.message}
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Task Creation">
        <form onSubmit={submitTask} className="space-y-2">
          <input className="field" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Task title" />
          <div className="grid grid-cols-2 gap-2">
            <select className="field" value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}>
              {["LOW", "NORMAL", "HIGH", "URGENT"].map((item) => <option key={item}>{item}</option>)}
            </select>
            <select className="field" value={departmentId ?? ""} onChange={(event) => setDepartmentId(event.target.value ? Number(event.target.value) : undefined)}>
              <option value="">Any dept</option>
              {departments.map((department) => <option value={department.id} key={department.id}>{department.name}</option>)}
            </select>
          </div>
          <button className="primary-button" disabled={isSaving}>{isSaving ? "Queueing" : "Create Task"}</button>
        </form>
      </Panel>
      <Panel title="System Overview">
        <Metric label="AI summaries" value="placeholder" />
        <Metric label="Manager briefings" value={String(reports.filter((report) => report.report_type === "MANAGER_SUMMARY").length)} />
        <Metric label="Boss briefings" value={String(reports.filter((report) => report.report_type === "BOSS_BRIEFING").length)} />
        <Metric label="Department reports" value={`${departments.length} online`} />
      </Panel>
      <Panel title="Manager Briefings">
        {reports.filter((report) => report.report_type === "MANAGER_SUMMARY").slice(0, 4).map((report) => (
          <div className="feed-item" key={report.id}>
            <strong>{report.severity}</strong> {report.title}
          </div>
        ))}
        {reports.filter((report) => report.report_type === "MANAGER_SUMMARY").length === 0 ? <div className="feed-item">Awaiting first manager cycle.</div> : null}
      </Panel>
      <Panel title="Boss Briefings">
        {reports.filter((report) => report.report_type === "BOSS_BRIEFING").slice(0, 3).map((report) => (
          <div className="feed-item" key={report.id}>
            <strong>{report.severity}</strong> {report.body}
          </div>
        ))}
        {reports.filter((report) => report.report_type === "BOSS_BRIEFING").length === 0 ? <div className="feed-item">Boss is collecting manager summaries.</div> : null}
      </Panel>
      <Panel title="Alerts">
        {alerts.slice(0, 4).map((alert) => (
          <div className="feed-item" key={alert.id}>
            <strong>{alert.level}</strong> {alert.title}
          </div>
        ))}
      </Panel>
      <Panel title="Task Queue">
        {tasks.slice(0, 5).map((task) => (
          <div className="feed-item" key={task.id}>
            <strong>{task.priority}</strong> {task.title}
          </div>
        ))}
      </Panel>
      <Panel title="Live Activity Feed">
        {events.slice(-8).reverse().map((event, index) => (
          <div className="feed-item" key={event.id ?? `event-${index}`}>{event.message}</div>
        ))}
      </Panel>
    </aside>
  );
}

function needsTargetId(targetType: IntercomTargetType) {
  return targetType === "DEPARTMENT" || targetType === "MANAGER";
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-md border border-lab-line bg-black/20 p-3">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-normal text-lab-mist/80">{title}</h2>
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-lab-line/60 py-1 text-sm last:border-b-0">
      <span className="text-lab-mist/70">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}
