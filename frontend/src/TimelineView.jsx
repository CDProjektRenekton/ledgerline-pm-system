import React, { useMemo, useRef } from "react";

const STATUS_COLOR = { todo: "#6B92AD", inprogress: "#1A7FA8", review: "#F59E0B", done: "#10B981" };
const SUBTASK_COLOR = "#8B5CF6";
const DAY_WIDTH = 36;

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function dayDiff(a, b) {
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

export default function TimelineView({ tasks, onSelect }) {
  const dated = tasks.filter((t) => t.due_date);
  const scrollRef = useRef(null);

  const { rangeStart, totalDays } = useMemo(() => {
    if (dated.length === 0) {
      const today = new Date();
      return { rangeStart: today, totalDays: 14 };
    }
    // Use start_date if available, otherwise created_at as the left anchor.
    // Also widen the range to cover any subtask target dates so markers
    // never fall outside the visible grid. No artificial cap — a task
    // spanning January to December renders its full ~365-day width; use
    // the Prev/Next/Today controls below to navigate across it.
    const starts = dated.map((t) => new Date(t.start_date || t.created_at));
    const due    = dated.map((t) => new Date(t.due_date));
    const subDates = dated.flatMap((t) => (t.subtasks || []).filter((s) => s.target_at).map((s) => new Date(s.target_at)));
    const minDate = new Date(Math.min(...starts, ...due, ...(subDates.length ? subDates : [Infinity])));
    const maxDate = new Date(Math.max(...starts, ...due, ...(subDates.length ? subDates : [-Infinity])));
    const start = addDays(minDate, -1);
    const span = Math.max(dayDiff(start, addDays(maxDate, 2)), 10);
    return { rangeStart: start, totalDays: span };
  }, [dated]);

  const days = Array.from({ length: totalDays }, (_, i) => addDays(rangeStart, i));
  const todayKey = new Date().toDateString();

  // Move the visible window by a chunk of days (used by Prev/Next buttons)
  const scrollByDays = (n) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: n * DAY_WIDTH, behavior: "smooth" });
    }
  };
  const scrollToToday = () => {
    if (!scrollRef.current) return;
    const offset = dayDiff(rangeStart, new Date());
    scrollRef.current.scrollTo({ left: Math.max(0, offset * DAY_WIDTH - 200), behavior: "smooth" });
  };
  const scrollToStart = () => scrollRef.current?.scrollTo({ left: 0, behavior: "smooth" });
  const scrollToEnd = () => scrollRef.current?.scrollTo({ left: totalDays * DAY_WIDTH, behavior: "smooth" });

  return (
    <div style={{ display:"flex", flexDirection:"column", flex:1, minWidth:0, overflow:"hidden" }}>
      <style>{`
        .pm-tl-navbar { display:flex; align-items:center; justify-content:space-between; padding:14px 28px 0; flex-shrink:0; }
        .pm-tl-navgroup { display:flex; align-items:center; gap:8px; }
        .pm-tl-navbtn { display:flex; align-items:center; gap:5px; padding:6px 12px; border-radius:8px; border:1px solid var(--border); background:var(--card); font-size:12.5px; font-weight:600; color:var(--teal-deep); cursor:pointer; }
        .pm-tl-navbtn:hover { background:var(--paper-deep); }
        .pm-tl-navlabel { font-size:11.5px; color:var(--muted); }
        .pm-tlwrap { padding: 14px 28px 22px; overflow: auto; flex: 1; min-width: 0; }
        .pm-tl-table { display: grid; grid-template-columns: 220px 1fr; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; background: var(--card); min-width: 900px; }
        .pm-tl-rowlabel { padding: 9px 12px; font-size: 12.5px; font-weight: 600; border-bottom: 1px solid var(--border); border-right: 1px solid var(--border); display: flex; flex-direction: column; align-items: flex-start; justify-content: center; cursor: pointer; gap: 3px; min-height: 48px; position: sticky; left: 0; background: var(--card); z-index: 2; }
        .pm-tl-rowlabel:hover { background: #F4FAFE; }
        .pm-tl-track { position: relative; border-bottom: 1px solid var(--border); display: grid; min-height: 48px; }
        .pm-tl-cell { border-right: 1px solid #EEF6FC; }
        .pm-tl-cell.today { background: rgba(26,127,168,0.08); }
        .pm-tl-bar { position: absolute; top: 8px; height: 18px; border-radius: 6px; cursor: pointer; opacity: 0.9; transition: opacity .15s; }
        .pm-tl-bar:hover { opacity: 1; box-shadow: 0 2px 8px rgba(11,79,108,0.25); }
        .pm-tl-submarker { position: absolute; top: 31px; width: 9px; height: 9px; border-radius: 2px; transform: rotate(45deg); cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.25); }
        .pm-tl-header { display: contents; }
        .pm-tl-headlabel { padding: 8px 12px; font-size: 11px; text-transform: uppercase; color: var(--muted); border-bottom: 1px solid var(--border); border-right: 1px solid var(--border); background: var(--paper-deep); position: sticky; left: 0; z-index: 3; }
        .pm-tl-headtrack { display: grid; background: var(--paper-deep); border-bottom: 1px solid var(--border); }
        .pm-tl-headday { font-size: 10px; color: var(--muted); text-align: center; padding: 8px 2px; border-right: 1px solid #EEF6FC; }
      `}</style>

      {/* Navigation controls — move the visible window across long date ranges
          (e.g. a task spanning January to December) without relying only on
          the raw horizontal scrollbar. */}
      <div className="pm-tl-navbar">
        <div className="pm-tl-navlabel">
          {totalDays} day{totalDays !== 1 ? "s" : ""} shown — {rangeStart.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})} to {addDays(rangeStart, totalDays-1).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
        </div>
        <div className="pm-tl-navgroup">
          <button className="pm-tl-navbtn" onClick={scrollToStart} title="Jump to the earliest date">⏮ Start</button>
          <button className="pm-tl-navbtn" onClick={() => scrollByDays(-14)} title="Move back 2 weeks">‹ Prev</button>
          <button className="pm-tl-navbtn" onClick={scrollToToday} title="Jump to today">Today</button>
          <button className="pm-tl-navbtn" onClick={() => scrollByDays(14)} title="Move forward 2 weeks">Next ›</button>
          <button className="pm-tl-navbtn" onClick={scrollToEnd} title="Jump to the latest date">End ⏭</button>
        </div>
      </div>

      <div className="pm-tlwrap" ref={scrollRef}>

      <div className="pm-tl-table" style={{ gridTemplateColumns: `220px repeat(${totalDays}, 36px)` }}>
        <div className="pm-tl-headlabel">Task</div>
        {days.map((d, i) => (
          <div className="pm-tl-headday" key={i} style={{ background: d.toDateString() === todayKey ? "#DBEAFE" : undefined }}>
            {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </div>
        ))}

        {dated.length === 0 && (
          <div style={{ gridColumn: `1 / span ${totalDays + 1}`, padding: 30, textAlign: "center", color: "var(--muted)" }}>
            No tasks with due dates yet — set a due date on a task to see it here.
          </div>
        )}

        {dated.map((t) => {
          const due   = new Date(t.due_date);
          const start = new Date(t.start_date || t.created_at);
          const offset = Math.max(dayDiff(rangeStart, start), 0);
          const span   = Math.max(dayDiff(start, due) + 1, 1);
          const assigneeLabel = t.assignee_name ? t.assignee_name.split(" ")[0] : t.team_name || "";
          const subMarkers = (t.subtasks || []).filter((s) => s.target_at);
          // Row height: base 48px + 22px per subtask marker so labels don't overflow
          const rowH = Math.max(48, 36 + subMarkers.length * 22 + 8);
          return (
            <React.Fragment key={t.id}>
              <div className="pm-tl-rowlabel" style={{ minHeight: rowH }} onClick={() => onSelect(t)}>
                <div style={{ fontWeight:600, fontSize:12.5, lineHeight:1.3 }}>{t.title}</div>
                {assigneeLabel && (
                  <div style={{ display:"inline-flex", alignItems:"center", gap:4, marginTop:3, background:"#DBEAFE", color:"#1D4ED8", borderRadius:999, padding:"2px 8px", fontSize:10.5, fontWeight:700 }}>
                    👤 {assigneeLabel}
                  </div>
                )}
              </div>
              <div className="pm-tl-track" style={{ gridColumn:`2 / span ${totalDays}`, gridTemplateColumns:`repeat(${totalDays}, 36px)`, minHeight: rowH }}>
                {days.map((d, i) => (
                  <div key={i} className={`pm-tl-cell ${d.toDateString() === todayKey ? "today" : ""}`} />
                ))}
                <div
                  className="pm-tl-bar"
                  style={{ left:offset*36+2, width:span*36-4, background:STATUS_COLOR[t.status], borderRadius:6 }}
                  onClick={() => onSelect(t)}
                  title={`${t.title}${assigneeLabel ? ` · ${assigneeLabel}` : ""}`}
                />
                {subMarkers.map((s, si) => {
                  const sDate = new Date(s.target_at);
                  const sOffset = dayDiff(rangeStart, sDate);
                  if (sOffset < 0 || sOffset >= totalDays) return null;
                  const leftPx = sOffset * 36 + 14;
                  const topPx = 31 + si * 22; // stack vertically — each marker 22px below previous
                  return (
                    <React.Fragment key={s.id}>
                      <div
                        className="pm-tl-submarker"
                        style={{ left: leftPx, top: topPx, background: s.is_done ? "#A78BFA" : SUBTASK_COLOR, opacity: s.is_done ? 0.6 : 1 }}
                        title={`${s.title}${s.is_done ? " ✓" : ""} — ${sDate.toLocaleString([], { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" })}`}
                        onClick={(e) => { e.stopPropagation(); onSelect(t); }}
                      />
                      <div
                        style={{
                          position:"absolute", left: leftPx + 14, top: topPx - 1,
                          fontSize:9.5, color: s.is_done ? "#A78BFA" : SUBTASK_COLOR,
                          fontWeight:600, whiteSpace:"nowrap", pointerEvents:"none",
                          textDecoration: s.is_done ? "line-through" : "none",
                        }}
                      >
                        {sDate.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}_{s.title}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </React.Fragment>
          );
        })}
      </div>
      </div>

      {dated.some((t) => (t.subtasks || []).some((s) => s.target_at)) && (
        <div style={{ display:"flex", alignItems:"center", gap:6, padding:"0 28px 12px", fontSize:11.5, color:"var(--muted)", flexShrink:0 }}>
          <span style={{ width:9, height:9, borderRadius:2, background:SUBTASK_COLOR, transform:"rotate(45deg)", display:"inline-block" }} />
          Subtask target date
        </div>
      )}
    </div>
  );
}
