import React, { useMemo } from "react";

const STATUS_COLOR = { todo: "#8B8680", inprogress: "#1F6F78", review: "#C9A227", done: "#3F7D52" };

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

  const { rangeStart, totalDays } = useMemo(() => {
    if (dated.length === 0) {
      const today = new Date();
      return { rangeStart: today, totalDays: 14 };
    }
    // Use start_date if available, otherwise created_at as the left anchor
    const starts = dated.map((t) => new Date(t.start_date || t.created_at));
    const due    = dated.map((t) => new Date(t.due_date));
    const minDate = new Date(Math.min(...starts, ...due));
    const maxDate = new Date(Math.max(...starts, ...due));
    const start = addDays(minDate, -1);
    const span = Math.max(dayDiff(start, addDays(maxDate, 2)), 10);
    return { rangeStart: start, totalDays: span };
  }, [dated]);

  const days = Array.from({ length: totalDays }, (_, i) => addDays(rangeStart, i));
  const todayKey = new Date().toDateString();

  return (
    <div className="pm-tlwrap">
      <style>{`
        .pm-tlwrap { padding: 18px 28px 22px; overflow: auto; flex: 1; }
        .pm-tl-table { display: grid; grid-template-columns: 220px 1fr; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; background: var(--card); min-width: 900px; }
        .pm-tl-rowlabel { padding: 10px 12px; font-size: 12.5px; font-weight: 600; border-bottom: 1px solid var(--border); border-right: 1px solid var(--border); display: flex; align-items: center; cursor: pointer; }
        .pm-tl-rowlabel:hover { background: #FBF9F3; }
        .pm-tl-track { position: relative; border-bottom: 1px solid var(--border); display: grid; }
        .pm-tl-cell { border-right: 1px solid #F1EDE2; }
        .pm-tl-cell.today { background: rgba(201,162,39,0.08); }
        .pm-tl-bar { position: absolute; top: 6px; height: 18px; border-radius: 5px; cursor: pointer; display: flex; align-items: center; padding: 0 8px; font-size: 10px; color: #fff; font-weight: 600; white-space: nowrap; overflow: hidden; }
        .pm-tl-header { display: contents; }
        .pm-tl-headlabel { padding: 8px 12px; font-size: 11px; text-transform: uppercase; color: var(--muted); border-bottom: 1px solid var(--border); border-right: 1px solid var(--border); background: var(--paper-deep); }
        .pm-tl-headtrack { display: grid; background: var(--paper-deep); border-bottom: 1px solid var(--border); }
        .pm-tl-headday { font-size: 10px; color: var(--muted); text-align: center; padding: 8px 2px; border-right: 1px solid #F1EDE2; }
      `}</style>

      <div className="pm-tl-table" style={{ gridTemplateColumns: `220px repeat(${totalDays}, 36px)` }}>
        <div className="pm-tl-headlabel">Task</div>
        {days.map((d, i) => (
          <div className="pm-tl-headday" key={i} style={{ background: d.toDateString() === todayKey ? "#F3E9C7" : undefined }}>
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
          // Use start_date if set, otherwise fall back to created_at
          const start = new Date(t.start_date || t.created_at);
          const offset = Math.max(dayDiff(rangeStart, start), 0);
          const span   = Math.max(dayDiff(start, due) + 1, 1);
          const assigneeLabel = t.assignee_name ? t.assignee_name.split(" ")[0] : t.team_name || "";
          return (
            <React.Fragment key={t.id}>
              <div className="pm-tl-rowlabel" onClick={() => onSelect(t)}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 12.5 }}>{t.title}</div>
                  {assigneeLabel && <div style={{ fontSize: 10.5, color: "#6B92AD", marginTop: 1 }}>{assigneeLabel}</div>}
                </div>
              </div>
              <div style={{ position: "relative", gridColumn: `2 / span ${totalDays}`, display: "grid", gridTemplateColumns: `repeat(${totalDays}, 36px)`, borderBottom: "1px solid var(--border)" }}>
                {days.map((d, i) => (
                  <div key={i} className={`pm-tl-cell ${d.toDateString() === todayKey ? "today" : ""}`} />
                ))}
                <div
                  className="pm-tl-bar"
                  style={{ left: offset * 36 + 2, width: span * 36 - 4, background: STATUS_COLOR[t.status] }}
                  onClick={() => onSelect(t)}
                  title={`${t.title}${assigneeLabel ? ` · ${assigneeLabel}` : ""}`}
                >
                  {t.title}{assigneeLabel ? ` · ${assigneeLabel}` : ""}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
