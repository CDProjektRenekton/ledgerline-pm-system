import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

const PRIORITY_COLOR = { high: "#EF4444", medium: "#F59E0B", low: "#6B92AD" };
const STATUS_COLOR = { todo: "#6B92AD", inprogress: "#1A7FA8", review: "#F59E0B", done: "#10B981" };

function startOfMonth(date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function daysInMonth(date) { return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(); }
function toKey(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

const MAX_BARS_PER_WEEK = 3;

export default function CalendarView({ tasks, onSelect, onCreateDate }) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));

  const totalDays = daysInMonth(cursor);
  const firstWeekday = startOfMonth(cursor).getDay();
  const monthLabel = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const todayKey = toKey(new Date());

  // Build the full visible grid as actual Date objects (nulls for empty leading cells)
  const gridDays = useMemo(() => {
    const cells = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor, totalDays, firstWeekday]);

  const weeks = useMemo(() => {
    const w = [];
    for (let i = 0; i < gridDays.length; i += 7) w.push(gridDays.slice(i, i + 7));
    return w;
  }, [gridDays]);

  // Tasks that span a date range — anchor everything to start_date..due_date,
  // falling back to a single-day bar at due_date if no start_date is set.
  const rangedTasks = useMemo(() => {
    return tasks
      .filter((t) => t.due_date)
      .map((t) => {
        const due = new Date(t.due_date);
        const start = t.start_date ? new Date(t.start_date) : due;
        return { ...t, _start: start <= due ? start : due, _end: due };
      });
  }, [tasks]);

  // Subtasks with a target_at, keyed by day, sorted by time of day
  const subtasksByDay = useMemo(() => {
    const map = {};
    for (const t of tasks) {
      for (const s of t.subtasks || []) {
        if (!s.target_at) continue;
        const d = new Date(s.target_at);
        const key = toKey(d);
        map[key] = map[key] || [];
        map[key].push({ ...s, _date: d, parentTitle: t.title, parentId: t.id });
      }
    }
    // Sort each day's subtasks by time
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a._date - b._date);
    }
    return map;
  }, [tasks]);

  // For each week, compute which task-bars are active and their column span
  // within that week (0-6), then stack them into rows to avoid overlap.
  const weekBars = useMemo(() => {
    return weeks.map((week) => {
      const weekDates = week.filter(Boolean);
      if (weekDates.length === 0) return [];
      const weekStart = week.find(Boolean);
      const weekEnd = [...week].reverse().find(Boolean);
      if (!weekStart || !weekEnd) return [];

      const activeInWeek = rangedTasks
        .filter((t) => t._start <= weekEnd && t._end >= weekStart)
        .map((t) => {
          const clipStart = t._start < weekStart ? weekStart : t._start;
          const clipEnd = t._end > weekEnd ? weekEnd : t._end;
          const startCol = week.findIndex((d) => d && toKey(d) === toKey(clipStart));
          const endCol = week.findIndex((d) => d && toKey(d) === toKey(clipEnd));
          return {
            task: t,
            startCol: startCol === -1 ? 0 : startCol,
            endCol: endCol === -1 ? 6 : endCol,
            continuesLeft: t._start < weekStart,
            continuesRight: t._end > weekEnd,
          };
        })
        .sort((a, b) => a.startCol - b.startCol || (b.endCol - b.startCol) - (a.endCol - a.startCol));

      // Greedy row-stacking: place each bar in the first row where it doesn't overlap
      const rows = [];
      for (const bar of activeInWeek) {
        let placed = false;
        for (const row of rows) {
          const overlaps = row.some((b) => !(bar.endCol < b.startCol || bar.startCol > b.endCol));
          if (!overlaps) { row.push(bar); placed = true; break; }
        }
        if (!placed) rows.push([bar]);
      }
      return rows;
    });
  }, [weeks, rangedTasks]);

  const changeMonth = (delta) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));

  return (
    <div className="pm-calwrap">
      <style>{`
        .pm-calwrap { padding: 18px 28px 22px; overflow-y: auto; flex: 1; }
        .pm-cal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
        .pm-cal-nav { display: flex; align-items: center; gap: 10px; }
        .pm-cal-navbtn { width: 28px; height: 28px; border-radius: 7px; border: 1px solid var(--border); background: var(--card); display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .pm-cal-navbtn:hover { background: var(--paper-deep); }
        .pm-cal-month { font-family: 'Merriweather', serif; font-size: 17px; font-weight: 700; color: var(--teal-deep); }
        .pm-cal-grid2 { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; background: var(--card); }
        .pm-cal-weekday-row { display: grid; grid-template-columns: repeat(7, 1fr); background: var(--paper-deep); border-bottom: 1px solid var(--border); }
        .pm-cal-weekday2 { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); text-align: center; padding: 8px 0; font-weight: 600; }
        .pm-cal-week-row { position: relative; border-bottom: 1px solid var(--border); }
        .pm-cal-week-row:last-child { border-bottom: none; }
        .pm-cal-day-cells { display: grid; grid-template-columns: repeat(7, 1fr); }
        .pm-cal-cell2 { min-height: 108px; border-right: 1px solid var(--border); padding: 5px 6px; cursor: pointer; transition: background .12s; position: relative; }
        .pm-cal-cell2:last-child { border-right: none; }
        .pm-cal-cell2:hover { background: #F4FAFE; }
        .pm-cal-cell2.empty { background: #FBFDFF; cursor: default; }
        .pm-cal-cell2.today .pm-cal-daynum2 { background: var(--teal); color: #fff; }
        .pm-cal-daynum2 { font-size: 11px; color: var(--muted); width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-weight: 600; }
        .pm-cal-add-hint { position: absolute; top: 5px; right: 6px; opacity: 0; transition: opacity .12s; color: var(--teal); }
        .pm-cal-cell2:hover .pm-cal-add-hint { opacity: 1; }
        .pm-cal-bars-overlay { position: absolute; left: 0; right: 0; top: 26px; display: flex; flex-direction: column; gap: 2px; pointer-events: none; }
        .pm-cal-bar { position: relative; height: 17px; pointer-events: auto; }
        .pm-cal-bar-inner { position: absolute; top: 0; bottom: 0; display: flex; align-items: center; padding: 0 6px; font-size: 10px; color: #fff; font-weight: 600; overflow: hidden; white-space: nowrap; cursor: pointer; }
        .pm-cal-subtask-dots { display: flex; gap: 2px; margin-top: 2px; flex-wrap: wrap; }
        .pm-cal-subtask-dot { width: 6px; height: 6px; border-radius: 50%; background: #8B5CF6; cursor: pointer; }
        .pm-cal-more { font-size: 9.5px; color: var(--muted); padding-left: 6px; margin-top: 1px; }
      `}</style>

      <div className="pm-cal-head">
        <div className="pm-cal-month">{monthLabel}</div>
        <div className="pm-cal-nav">
          <div className="pm-cal-navbtn" onClick={() => changeMonth(-1)}><ChevronLeft size={15} /></div>
          <div className="pm-cal-navbtn" onClick={() => setCursor(startOfMonth(new Date()))} style={{ width: "auto", padding: "0 10px", fontSize: 11.5, fontWeight: 600, color: "var(--teal-deep)" }}>Today</div>
          <div className="pm-cal-navbtn" onClick={() => changeMonth(1)}><ChevronRight size={15} /></div>
        </div>
      </div>

      <div className="pm-cal-grid2">
        <div className="pm-cal-weekday-row">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div className="pm-cal-weekday2" key={d}>{d}</div>
          ))}
        </div>

        {weeks.map((week, wi) => {
          const rows = weekBars[wi] || [];
          const visibleRows = rows.slice(0, MAX_BARS_PER_WEEK);
          const overflowCountByCol = {}; // col -> number of hidden bars touching that col
          if (rows.length > MAX_BARS_PER_WEEK) {
            for (const row of rows.slice(MAX_BARS_PER_WEEK)) {
              for (const bar of row) {
                for (let c = bar.startCol; c <= bar.endCol; c++) {
                  overflowCountByCol[c] = (overflowCountByCol[c] || 0) + 1;
                }
              }
            }
          }
          return (
            <div className="pm-cal-week-row" key={wi} style={{ minHeight: 108 + visibleRows.length * 19 }}>
              <div className="pm-cal-day-cells">
                {week.map((d, di) => {
                  if (!d) return <div className="pm-cal-cell2 empty" key={di} />;
                  const key = toKey(d);
                  const isToday = key === todayKey;
                  const subDots = subtasksByDay[key] || [];
                  const hiddenHere = overflowCountByCol[di];
                  return (
                    <div
                      className={`pm-cal-cell2 ${isToday ? "today" : ""}`}
                      key={di}
                      style={{ minHeight: 108 + visibleRows.length * 19 }}
                      onClick={() => onCreateDate && onCreateDate(key)}
                    >
                      <div className="pm-cal-daynum2">{d.getDate()}</div>
                      <Plus size={12} className="pm-cal-add-hint" />
                      {subDots.length > 0 && (
                        <div style={{ marginTop:2 }}>
                          {subDots.slice(0, 3).map((s) => (
                            <div
                              key={s.id}
                              style={{ display:"flex", alignItems:"center", gap:3, fontSize:9.5, color: s.is_done ? "#A78BFA" : "#7C3AED", fontWeight:600, padding:"1px 0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", cursor:"pointer", textDecoration: s.is_done ? "line-through" : "none" }}
                              title={`${s.title} (${s.parentTitle})`}
                              onClick={(e) => { e.stopPropagation(); onSelect && onSelect({ id: s.parentId }); }}
                            >
                              <span style={{ width:5, height:5, borderRadius:"50%", background: s.is_done ? "#A78BFA" : "#7C3AED", flexShrink:0 }} />
                              {s._date.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}_{s.title}
                            </div>
                          ))}
                          {subDots.length > 3 && (
                            <div style={{ fontSize:9, color:"var(--muted)", paddingLeft:8 }}>+{subDots.length - 3} more</div>
                          )}
                        </div>
                      )}
                      {hiddenHere > 0 && <div className="pm-cal-more">+{hiddenHere} more</div>}
                    </div>
                  );
                })}
              </div>

              {/* Spanning event bars overlaid across the week's columns */}
              <div className="pm-cal-bars-overlay">
                {visibleRows.map((row, ri) => (
                  <div key={ri} style={{ position: "relative", height: 17 }}>
                    {row.map((bar) => {
                      const widthPct = ((bar.endCol - bar.startCol + 1) / 7) * 100;
                      const leftPct = (bar.startCol / 7) * 100;
                      return (
                        <div
                          key={bar.task.id}
                          className="pm-cal-bar-inner"
                          style={{
                            left: `calc(${leftPct}% + 3px)`,
                            width: `calc(${widthPct}% - 6px)`,
                            background: STATUS_COLOR[bar.task.status],
                            borderRadius: `${bar.continuesLeft ? 0 : 5}px ${bar.continuesRight ? 0 : 5}px ${bar.continuesRight ? 0 : 5}px ${bar.continuesLeft ? 0 : 5}px`,
                          }}
                          title={bar.task.title}
                          onClick={(e) => { e.stopPropagation(); onSelect(bar.task); }}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: PRIORITY_COLOR[bar.task.priority], flexShrink: 0, marginRight: 4 }} />
                          {bar.task.title}
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
  );
}
