import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

const STATUS_COLOR = { todo:"#6B92AD", inprogress:"#1A7FA8", review:"#F59E0B", done:"#10B981" };
const PRIORITY_COLOR = { high:"#EF4444", medium:"#F59E0B", low:"#6B92AD" };

function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function daysInMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }
function toKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export default function CalendarView({ tasks, onSelect, onCreateDate }) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));

  const totalDays = daysInMonth(cursor);
  const firstWeekday = startOfMonth(cursor).getDay();
  const monthLabel = cursor.toLocaleDateString("en-US", { month:"long", year:"numeric" });
  const todayKey = toKey(new Date());

  // Build 6-row grid (42 cells) so layout is always consistent
  const gridDays = useMemo(() => {
    const cells = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    while (cells.length < 42) cells.push(null);
    return cells;
  }, [cursor, totalDays, firstWeekday]);

  const weeks = useMemo(() => {
    const w = [];
    for (let i = 0; i < gridDays.length; i += 7) w.push(gridDays.slice(i, i+7));
    return w;
  }, [gridDays]);

  // Task spanning bars: use start_date..due_date, fall back to single-day on due_date
  const rangedTasks = useMemo(() => {
    return tasks.filter(t => t.due_date).map(t => {
      const end = new Date(t.due_date);
      const start = t.start_date ? new Date(t.start_date) : end;
      return { ...t, _start: start <= end ? start : end, _end: end };
    });
  }, [tasks]);

  // Subtasks by day, sorted by time
  const subtasksByDay = useMemo(() => {
    const map = {};
    for (const t of tasks) {
      for (const s of t.subtasks || []) {
        if (!s.target_at) continue;
        const d = new Date(s.target_at);
        const key = toKey(d);
        (map[key] = map[key] || []).push({ ...s, _date:d, parentId:t.id });
      }
    }
    for (const k of Object.keys(map)) map[k].sort((a,b) => a._date - b._date);
    return map;
  }, [tasks]);

  // For each week, compute event bars with row stacking
  const weekBars = useMemo(() => weeks.map(week => {
    const validDays = week.filter(Boolean);
    if (!validDays.length) return [];
    const wStart = week.find(Boolean);
    const wEnd = [...week].reverse().find(Boolean);

    const active = rangedTasks
      .filter(t => t._start <= wEnd && t._end >= wStart)
      .map(t => {
        const cs = t._start < wStart ? wStart : t._start;
        const ce = t._end > wEnd ? wEnd : t._end;
        const sc = week.findIndex(d => d && toKey(d) === toKey(cs));
        const ec = week.findIndex(d => d && toKey(d) === toKey(ce));
        return { task:t, sc: sc<0?0:sc, ec: ec<0?6:ec, left: t._start < wStart, right: t._end > wEnd };
      })
      .sort((a,b) => a.sc - b.sc || (b.ec-b.sc)-(a.ec-a.sc));

    // Greedy row stacking
    const rows = [];
    for (const bar of active) {
      let placed = false;
      for (const row of rows) {
        if (!row.some(b => !(bar.ec < b.sc || bar.sc > b.ec))) { row.push(bar); placed=true; break; }
      }
      if (!placed) rows.push([bar]);
    }
    return rows;
  }), [weeks, rangedTasks]);

  const changeMonth = (d) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth()+d, 1));

  const BAR_H = 18;   // bar height in px
  const BAR_GAP = 3;  // gap between bars
  const CELL_TOP = 28; // space for day number

  return (
    <div style={{ padding:"16px 24px 20px", overflow:"auto", flex:1 }}>
      <style>{`
        .cal-wrap { font-family:'Inter',sans-serif; }
        .cal-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
        .cal-month { font-family:'Merriweather',serif; font-size:18px; font-weight:700; color:var(--teal-deep,#0B4F6C); }
        .cal-nav { display:flex; align-items:center; gap:8px; }
        .cal-nav-btn { width:30px; height:30px; border-radius:8px; border:1px solid var(--border,#C5DFF0); background:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer; }
        .cal-nav-btn:hover { background:var(--paper-deep,#EEF6FC); }
        .cal-today-btn { border-radius:8px; border:1px solid var(--border,#C5DFF0); background:#fff; padding:0 12px; height:30px; font-size:12px; font-weight:600; color:var(--teal-deep,#0B4F6C); cursor:pointer; }
        .cal-today-btn:hover { background:var(--paper-deep,#EEF6FC); }
        .cal-grid { border:1px solid var(--border,#C5DFF0); border-radius:12px; overflow:hidden; background:#fff; }
        .cal-daynames { display:grid; grid-template-columns:repeat(7,1fr); background:var(--paper-deep,#EEF6FC); border-bottom:1px solid var(--border,#C5DFF0); }
        .cal-dayname { text-align:center; font-size:11px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--muted,#6B92AD); padding:9px 0; }
        .cal-week { display:grid; grid-template-columns:repeat(7,1fr); border-bottom:1px solid var(--border,#C5DFF0); position:relative; }
        .cal-week:last-child { border-bottom:none; }
        .cal-cell { border-right:1px solid var(--border,#C5DFF0); padding:4px 5px 6px; min-height:120px; cursor:pointer; position:relative; background:#fff; transition:background .1s; box-sizing:border-box; }
        .cal-cell:last-child { border-right:none; }
        .cal-cell:hover { background:#F4FAFE; }
        .cal-cell.empty { background:#FAFCFF; cursor:default; }
        .cal-cell.today .cal-daynum { background:var(--teal,#1A7FA8); color:#fff; }
        .cal-daynum { font-size:11.5px; font-weight:700; color:var(--muted,#6B92AD); width:22px; height:22px; display:flex; align-items:center; justify-content:center; border-radius:50%; margin-bottom:2px; }
        .cal-plus { position:absolute; top:5px; right:5px; color:var(--teal,#1A7FA8); opacity:0; transition:opacity .12s; }
        .cal-cell:hover .cal-plus { opacity:1; }
        .cal-bars { position:absolute; left:0; right:0; top:28px; display:flex; flex-direction:column; gap:2px; pointer-events:none; padding:0 1px; }
        .cal-bar-row { height:18px; position:relative; }
        .cal-bar { position:absolute; top:0; bottom:0; display:flex; align-items:center; padding:0 6px; font-size:9.5px; color:#fff; font-weight:700; overflow:hidden; white-space:nowrap; cursor:pointer; pointer-events:auto; border-radius:4px; }
        .cal-bar:hover { filter:brightness(1.1); }
        .cal-subtasks { margin-top:2px; pointer-events:auto; position:relative; z-index:1; }
        .cal-sub-item { font-size:9.5px; color:#7C3AED; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.4; cursor:pointer; display:flex; align-items:center; gap:2px; }
        .cal-sub-item.done { text-decoration:line-through; color:#A78BFA; }
        .cal-more-tasks { font-size:9px; color:var(--muted,#6B92AD); margin-top:1px; cursor:pointer; }
      `}</style>

      <div className="cal-wrap">
        <div className="cal-head">
          <div className="cal-month">{monthLabel}</div>
          <div className="cal-nav">
            <button className="cal-nav-btn" onClick={() => changeMonth(-1)}><ChevronLeft size={15}/></button>
            <button className="cal-today-btn" onClick={() => setCursor(startOfMonth(new Date()))}>Today</button>
            <button className="cal-nav-btn" onClick={() => changeMonth(1)}><ChevronRight size={15}/></button>
          </div>
        </div>

        <div className="cal-grid">
          <div className="cal-daynames">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
              <div className="cal-dayname" key={d}>{d}</div>
            ))}
          </div>

          {weeks.map((week, wi) => {
            const rows = weekBars[wi] || [];
            const BAR_AREA = rows.length * (BAR_H + BAR_GAP);
            const rowHeight = Math.max(120, CELL_TOP + BAR_AREA + 30);

            // Overflow count per column
            const maxRows = Math.min(rows.length, 3);
            const overflowByCol = {};
            if (rows.length > 3) {
              for (const row of rows.slice(3)) {
                for (const bar of row) {
                  for (let c = bar.sc; c <= bar.ec; c++) {
                    overflowByCol[c] = (overflowByCol[c] || 0) + 1;
                  }
                }
              }
            }

            return (
              <div className="cal-week" key={wi} style={{ minHeight: rowHeight }}>
                {week.map((d, di) => {
                  if (!d) return <div className="cal-cell empty" key={di} style={{ minHeight: rowHeight }} />;
                  const key = toKey(d);
                  const isToday = key === todayKey;
                  const subs = subtasksByDay[key] || [];
                  const overflow = overflowByCol[di] || 0;

                  return (
                    <div
                      className={`cal-cell${isToday ? " today" : ""}`}
                      key={di}
                      style={{ minHeight: rowHeight }}
                      onClick={() => onCreateDate && onCreateDate(key)}
                    >
                      <div className="cal-daynum">{d.getDate()}</div>
                      <Plus size={12} className="cal-plus" />

                      {/* Subtask items shown below day number, above bars */}
                      {subs.length > 0 && (
                        <div className="cal-subtasks">
                          {subs.slice(0,2).map(s => (
                            <div
                              key={s.id}
                              className={`cal-sub-item${s.is_done?" done":""}`}
                              title={s.title}
                              onClick={e => { e.stopPropagation(); onSelect && onSelect({ id: s.parentId }); }}
                            >
                              <span style={{ width:5, height:5, borderRadius:"50%", background: s.is_done?"#A78BFA":"#7C3AED", flexShrink:0 }} />
                              {s._date.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}_{s.title}
                            </div>
                          ))}
                          {subs.length > 2 && <div className="cal-more-tasks">+{subs.length-2} subtasks</div>}
                        </div>
                      )}

                      {overflow > 0 && (
                        <div className="cal-more-tasks">+{overflow} more events</div>
                      )}
                    </div>
                  );
                })}

                {/* Event bars rendered as absolute overlay per week row */}
                <div className="cal-bars" style={{ top: CELL_TOP + 24 }}>
                  {rows.slice(0, 3).map((row, ri) => (
                    <div className="cal-bar-row" key={ri}>
                      {row.map(bar => {
                        const totalCols = 7;
                        const leftPct = (bar.sc / totalCols) * 100;
                        const widthPct = ((bar.ec - bar.sc + 1) / totalCols) * 100;
                        return (
                          <div
                            key={bar.task.id}
                            className="cal-bar"
                            style={{
                              left: `calc(${leftPct}% + 2px)`,
                              width: `calc(${widthPct}% - 4px)`,
                              background: STATUS_COLOR[bar.task.status] || "#6B92AD",
                              borderRadius: `${bar.left?0:4}px ${bar.right?0:4}px ${bar.right?0:4}px ${bar.left?0:4}px`,
                            }}
                            title={`${bar.task.title}${bar.task.assignee_name ? " · " + bar.task.assignee_name : bar.task.team_name ? " · " + bar.task.team_name : ""}`}
                            onClick={e => { e.stopPropagation(); onSelect(bar.task); }}
                          >
                            {bar.task.title}
                            {(bar.task.assignee_name || bar.task.team_name) && (
                              <span style={{ opacity:0.85, marginLeft:4, fontWeight:600 }}>
                                · {bar.task.assignee_name ? bar.task.assignee_name.split(" ")[0] : bar.task.team_name}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
