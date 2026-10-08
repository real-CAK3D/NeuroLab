import { useEffect, useRef, useState } from "react";
import { LIFE_DRY, getMemories, getPersona, postMemory, type MemoryItem, type Persona } from "./lifeApi";

const LIST_FIELDS: Array<[keyof Persona, string]> = [["likes", "LIKES"], ["dislikes", "DISLIKES"], ["loves", "LOVES"], ["hates", "HATES"], ["hobbies", "HOBBIES"]];
const TEXT_FIELDS: Array<[keyof Persona, string, boolean?]> = [
  ["favoriteColor", "FAVORITE COLOR"], ["favoriteArtist", "FAVORITE ARTIST"], ["favoriteShow", "FAVORITE SHOW"], ["favoriteTeam", "FAVORITE TEAM"], ["favoriteFood", "FAVORITE FOOD"], ["music", "MUSIC"],
  ["pet", "PET"], ["home", "HOME"], ["family", "FAMILY"], ["quirk", "QUIRK"], ["catchphrase", "CATCHPHRASE"], ["relationship", "RELATIONSHIP"],
  ["commute", "COMMUTE"], ["morning", "MORNING"], ["fear", "FEAR"], ["guiltyPleasure", "GUILTY PLEASURE"],
];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** Drafts waiting for the Grow Ops SAVE button. Keyed by staff id so switching sprites does not lose edits. */
export type PersonaDrafts = Map<string, Partial<Persona>>;

type Props = { staffId: string; staffName: string; staffTitle: string; isNew: boolean; drafts: PersonaDrafts; revision: number };

/** Collapsible PERSONALITY + MEMORIES section of the Grow Ops staff editor. The parent saves `drafts` with its SAVE button. */
export function PersonaEditor({ staffId, staffName, staffTitle, isNew, drafts, revision }: Props) {
  const [open, setOpen] = useState(false);
  const [persona, setPersona] = useState<Persona | undefined>();
  const [status, setStatus] = useState("");
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [, force] = useState(0);
  const [listText, setListText] = useState<Record<string, string>>({});
  const loadedFor = useRef("");

  useEffect(() => {
    if (!open || isNew) return;
    let alive = true;
    loadedFor.current = staffId;
    setStatus("LOADING...");
    setPersona(undefined);
    setListText({});
    Promise.all([getPersona(staffId), getMemories(staffId).catch(() => [] as MemoryItem[])])
      .then(([loaded, mems]) => {
        if (!alive) return;
        setPersona({ ...loaded, ...(drafts.get(staffId) ?? {}) });
        setMemories(mems);
        setStatus(drafts.has(staffId) ? "UNSAVED CHANGES: PRESS SAVE." : "");
      })
      .catch(() => alive && setStatus("PERSONA NOT AVAILABLE (BACKEND OFFLINE OR OLDER)."));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, staffId, isNew, revision]);

  function edit(patch: Partial<Persona>) {
    drafts.set(staffId, { ...(drafts.get(staffId) ?? {}), ...patch });
    setPersona((current) => (current ? { ...current, ...patch } : current));
    setStatus(LIFE_DRY ? "DRY RUN (?lifeDry=1): SAVE WILL NOT WRITE." : "UNSAVED CHANGES: PRESS SAVE.");
    force((n) => n + 1);
  }

  async function addMemory(text: string) {
    const clean = text.trim();
    if (!clean || busy) return;
    setBusy(true);
    try {
      const saved = await postMemory(staffId, "note", clean, 3);
      if (saved) setMemories(saved);
      else setMemories((current) => [{ kind: "note", text: clean, when: "just now (dry run, not saved)", importance: 3 }, ...current]);
      setNote("");
    } catch {
      setStatus("COULD NOT SAVE THE MEMORY.");
    } finally {
      setBusy(false);
    }
  }

  const listValue = (key: keyof Persona) => ((persona?.[key] as string[] | undefined) ?? []).join(", ");

  return (
    <div className="persona-editor">
      <button type="button" className="persona-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {open ? "▾" : "▸"} PERSONALITY <em>{open ? "LIKES, FAVORITES, BIRTHDAY, MEMORIES" : "CLICK TO EDIT"}</em>
      </button>
      {open ? (
        isNew ? (
          <p className="persona-note">SAVE THE NEW HIRE FIRST. A PERSONALITY IS GENERATED AUTOMATICALLY WHEN THEY START WORKING, THEN EDIT IT HERE.</p>
        ) : !persona ? (
          <p className="persona-note">{status || "LOADING..."}</p>
        ) : (
          <>
            <div className="grow-ops-grid persona-grid">
              {LIST_FIELDS.map(([key, label]) => (
                <label key={key} className="grow-ops-wide">{label} (COMMA SEPARATED)
                  <input value={listText[key] ?? listValue(key)} maxLength={200} onChange={(event) => { setListText((current) => ({ ...current, [key]: event.target.value })); edit({ [key]: event.target.value.split(",").map((item) => item.trim().slice(0, 80)).filter(Boolean).slice(0, 8) } as Partial<Persona>); }} />
                </label>
              ))}
              {TEXT_FIELDS.map(([key, label]) => (
                <label key={key}>{label}
                  <input value={(persona[key] as string) ?? ""} maxLength={140} onChange={(event) => edit({ [key]: event.target.value } as Partial<Persona>)} />
                </label>
              ))}
              <label>BIRTHDAY MONTH
                <select value={persona.birthdayMonth} onChange={(event) => edit({ birthdayMonth: Number(event.target.value) })}>
                  {MONTHS.map((month, index) => <option value={index + 1} key={month}>{month}</option>)}
                </select>
              </label>
              <label>BIRTHDAY DAY
                <input type="number" min={1} max={31} value={persona.birthdayDay} onChange={(event) => edit({ birthdayDay: Math.max(1, Math.min(31, Number(event.target.value) || 1)) })} />
              </label>
            </div>
            <p className="persona-note">{status || "THESE FEED THE CHAT DIALOG, SPRITE BANTER AND BIRTHDAYS. SAVE STORES THEM ON THE BACKEND."}</p>
            <div className="persona-memories">
              <strong>MEMORIES <em>{staffName.toUpperCase()}</em></strong>
              <ul>
                {memories.length ? memories.map((memory, index) => <li key={`${memory.at ?? index}-${index}`}><span>{memory.text}</span><em>{memory.when}</em></li>) : <li><span>NO MEMORIES YET.</span></li>}
              </ul>
              <div className="persona-add">
                <input value={note} maxLength={200} placeholder="e.g. We threw a party when you got promoted" onChange={(event) => setNote(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void addMemory(note); } }} />
                <button type="button" disabled={busy || !note.trim()} onClick={() => void addMemory(note)}>ADD MEMORY</button>
                <button type="button" disabled={busy} title="Seed a promotion memory" onClick={() => void addMemory(`I got promoted to ${staffTitle}. It meant a lot to me.`)}>+ PROMOTION</button>
              </div>
            </div>
          </>
        )
      ) : null}
    </div>
  );
}
