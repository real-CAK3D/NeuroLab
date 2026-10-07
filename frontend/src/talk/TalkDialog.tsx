import { useCallback, useEffect, useRef, useState } from "react";
import { askNpc, paginate, TALK_MESSAGE_LIMIT, talkGreeting, type TalkBrief, type TalkTopic } from "./talkBrief";

type TalkOption = { label: string; topic?: TalkTopic; action?: "free" | "stats" | "bye" };

const OPTIONS: TalkOption[] = [
  { label: "JOB", topic: "job" },
  { label: "RECENTLY", topic: "recent" },
  { label: "UP NEXT", topic: "upcoming" },
  { label: "COWORKERS", topic: "coworkers" },
  { label: "THE DAY", topic: "day" },
  { label: "WEATHER", topic: "weather" },
  { label: "HOBBIES", topic: "interests" },
  { label: "PERSONAL LIFE", topic: "life" },
  { label: "FAVORITES", topic: "favorites" },
  { label: "MEMORIES", topic: "memories" },
  { label: "PLANS", topic: "plans" },
  { label: "FACILITY", topic: "facility" },
  { label: "ASK ANYTHING", action: "free" },
  { label: "STATS", action: "stats" },
  { label: "BYE", action: "bye" },
];
const MENU_ROWS = 5;
const TYPE_MS = 20;

type Phase = "text" | "menu" | "input" | "loading";

type TalkDialogProps = {
  /** Upper-case name for the name tag. */
  speaker: string;
  /** Fresh brief from the live dashboard state; called for the greeting and for every question. */
  getBrief: () => TalkBrief;
  /** Set when the worker has to leave mid-conversation (incident): they say it, then the dialog closes. */
  interrupt?: string;
  onStats: () => void;
  onClose: () => void;
};

/** Pokemon Gold/Silver style conversation: text box with name tag + typewriter, option menu, free-text input. */
export function TalkDialog({ speaker, getBrief, interrupt, onStats, onClose }: TalkDialogProps) {
  const [pages, setPages] = useState<string[]>(() => paginate(talkGreeting(getBrief())));
  const [pageIdx, setPageIdx] = useState(0);
  const [after, setAfter] = useState<"menu" | "close">("menu");
  const [phase, setPhase] = useState<Phase>("text");
  const [shown, setShown] = useState(0);
  const [cursor, setCursor] = useState(0);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const page = pages[pageIdx] ?? "";
  const typed = phase === "text" && shown >= page.length;

  const say = useCallback((list: string[], next: "menu" | "close") => {
    setPages(list);
    setPageIdx(0);
    setAfter(next);
    setPhase("text");
  }, []);

  // Typewriter: restarts for every page.
  useEffect(() => {
    if (phase !== "text") return undefined;
    setShown(0);
    const timer = window.setInterval(() => {
      setShown((current) => {
        if (current >= page.length) {
          window.clearInterval(timer);
          return current;
        }
        return current + 1;
      });
    }, TYPE_MS);
    return () => window.clearInterval(timer);
  }, [phase, pages, pageIdx, page.length]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (phase !== "input") return undefined;
    const timers = [0, 80, 250].map((delay) => window.setTimeout(() => { if (document.activeElement !== inputRef.current) inputRef.current?.focus(); }, delay));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [phase]);

  useEffect(() => {
    if (!interrupt) return;
    abortRef.current?.abort();
    say([interrupt], "close");
  }, [interrupt, say]);

  const ask = useCallback(
    (topic: TalkTopic, message?: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setPhase("loading");
      askNpc(getBrief(), topic, message, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return;
          say(paginate(result.reply), "menu");
        })
        .catch(() => {
          // cancelled by the player (B) or the dialog closing: nothing to show
        });
    },
    [getBrief, say],
  );

  const cancelAsk = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase("menu");
  };

  const advance = () => {
    if (phase !== "text") return;
    if (shown < page.length) {
      setShown(page.length);
      return;
    }
    if (pageIdx < pages.length - 1) setPageIdx(pageIdx + 1);
    else if (after === "close") onClose();
    else setPhase("menu");
  };

  const choose = (index: number) => {
    const option = OPTIONS[index];
    if (!option) return;
    setCursor(index);
    if (option.topic) ask(option.topic);
    else if (option.action === "free") {
      setDraft("");
      setPhase("input");
    } else if (option.action === "stats") onStats();
    else say(["Okay, take care! Back to work for me."], "close");
  };

  const send = () => {
    const message = draft.trim().slice(0, TALK_MESSAGE_LIMIT);
    if (!message) return;
    setDraft("");
    ask("free", message);
  };

  // One capture-phase key handler (kept fresh through a ref) so the walk engine and the dashboard hot keys never see keys meant for the dialog.
  const handler = useRef<(event: KeyboardEvent) => void>(() => undefined);
  handler.current = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (phase === "input") {
      if (event.target !== inputRef.current) return;
      event.stopPropagation();
      if (key === "enter") {
        event.preventDefault();
        send();
      } else if (key === "escape") {
        event.preventDefault();
        setPhase("menu");
      }
      return;
    }
    event.stopPropagation();
    if (key.startsWith("f") && key.length > 1 && /^f\d+$/.test(key)) return;
    const a = key === "enter" || key === " " || key === "spacebar" || key === "z";
    const b = key === "escape" || key === "x" || key === "backspace";
    if (a || b || key.startsWith("arrow") || "wasd".includes(key)) event.preventDefault();
    if (phase === "text") {
      if (a || b) advance();
    } else if (phase === "loading") {
      if (b) cancelAsk();
    } else if (phase === "menu") {
      if (key === "arrowdown" || key === "s") setCursor((c) => (c + 1) % OPTIONS.length);
      else if (key === "arrowup" || key === "w") setCursor((c) => (c - 1 + OPTIONS.length) % OPTIONS.length);
      else if (key === "arrowright" || key === "d") setCursor((c) => (c + MENU_ROWS < OPTIONS.length ? c + MENU_ROWS : c % MENU_ROWS));
      else if (key === "arrowleft" || key === "a") setCursor((c) => (c - MENU_ROWS >= 0 ? c - MENU_ROWS : Math.min(OPTIONS.length - 1, c + MENU_ROWS)));
      else if (a) choose(cursor);
      else if (b) choose(OPTIONS.length - 1);
    }
  };
  useEffect(() => {
    const listener = (event: KeyboardEvent) => handler.current(event);
    window.addEventListener("keydown", listener, true);
    return () => {
      window.removeEventListener("keydown", listener, true);
    };
  }, []);

  const body =
    phase === "text" ? (
      <>
        {page.slice(0, shown)}
        {typed ? <span className="talk-arrow" aria-hidden="true">▼</span> : null}
      </>
    ) : phase === "loading" ? (
      <span className="talk-dots" aria-label="Thinking"><i>.</i><i>.</i><i>.</i></span>
    ) : phase === "input" ? (
      "What do you want to ask?"
    ) : (
      "What would you like to talk about?"
    );

  return (
    <div className="talk-root" onClick={(event) => event.stopPropagation()} onContextMenu={(event) => event.preventDefault()}>
      {phase === "menu" ? (
        <div className="talk-menu" role="menu" aria-label="Conversation topics" style={{ gridTemplateRows: `repeat(${MENU_ROWS}, auto)` }}>
          {OPTIONS.map((option, index) => (
            <button
              key={option.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={index === cursor ? "is-selected" : ""}
              onMouseEnter={() => setCursor(index)}
              onClick={() => choose(index)}
            >
              <b aria-hidden="true">{index === cursor ? "▶" : ""}</b>
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
      {phase === "input" ? (
        <div className="talk-input">
          <input
            ref={inputRef}
            value={draft}
            maxLength={TALK_MESSAGE_LIMIT}
            placeholder="TYPE HERE..."
            aria-label="Ask anything"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="send"
            onChange={(event) => setDraft(event.target.value)}
          />
          <span className="talk-count">{draft.length}/{TALK_MESSAGE_LIMIT}</span>
          <button type="button" onClick={send} disabled={!draft.trim()}>SEND</button>
          <button type="button" onClick={() => setPhase("menu")}>BACK</button>
        </div>
      ) : null}
      <div className="talk-box" role="dialog" aria-label={`Talking to ${speaker}`} aria-live="polite" onClick={phase === "text" ? advance : undefined}>
        <span className="talk-name">{speaker}</span>
        <p>{body}</p>
      </div>
    </div>
  );
}
