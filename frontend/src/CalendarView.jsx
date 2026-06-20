import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const PRIORITY_COLOR = { high: "#9C4221", medium: "#C9A227", low: "#5C7A89" };

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function daysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export default function CalendarView({ tasks, onSelect }) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));

  const tasksByDay = useMemo(() => {
    const map = {};
    for (const t of tasks) {
      if (!t.due_date) continue;
      const key = t.due_date.slice(0, 10);
      map[key] = map[key] || [];
      map[key].push(t);
    }
    return map;
  }, [tasks]);

  const totalDays = daysInMonth(cursor);
  const firstWeekday = startOfMonth(cursor).getDay(); // 0 = Sunday
  const monthLabel = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);

  const todayKey = new Date().toISOString().slice(0, 10);

  const changeMonth = (delta) => {
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
  };

  const keyFor = (day) => {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  return (
    <div className="pm-calwrap">
      <style>{`
        .pm-calwrap { padding: 18px 28px 22px; overflow-y: auto; flex: 1; }
        .pm-cal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
        .pm-cal-nav { display: flex; align-items: center; gap: 10px; }
        .pm-cal-navbtn { width: 28px; height: 28px; border-radius: 7px; border: 1px solid var(--border); background: var(--card); display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .pm-cal-month { font-family: 'Fraunces', serif; font-size: 17px; font-weight: 600; }
        .pm-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; }
        .pm-cal-weekday { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); text-align: center; padding-bottom: 4px; }
        .pm-cal-cell { min-height: 92px; background: var(--card); border: 1px solid var(--border); border-radius: 9px; padding: 6px; }
        .pm-cal-cell.empty { background: transparent; border: none; }
        .pm-cal-cell.today { border-color: var(--gold); border-width: 2px; }
        .pm-cal-daynum { font-size: 11px; color: var(--muted); margin-bottom: 4px; }
        .pm-cal-task { font-size: 10.5px; padding: 3px 6px; border-radius: 5px; margin-bottom: 3px; background: var(--paper-deep); cursor: pointer; display: flex; align-items: center; gap: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pm-cal-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
      `}</style>

      <div className="pm-cal-head">
        <div className="pm-cal-month">{monthLabel}</div>
        <div className="pm-cal-nav">
          <div className="pm-cal-navbtn" onClick={() => changeMonth(-1)}><ChevronLeft size={15} /></div>
          <div className="pm-cal-navbtn" onClick={() => changeMonth(1)}><ChevronRight size={15} /></div>
        </div>
      </div>

      <div className="pm-cal-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div className="pm-cal-weekday" key={d}>{d}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div className="pm-cal-cell empty" key={`e${i}`} />;
          const key = keyFor(day);
          const dayTasks = tasksByDay[key] || [];
          return (
            <div className={`pm-cal-cell ${key === todayKey ? "today" : ""}`} key={key}>
              <div className="pm-cal-daynum">{day}</div>
              {dayTasks.slice(0, 3).map((t) => (
                <div className="pm-cal-task" key={t.id} onClick={() => onSelect(t)} title={t.title}>
                  <span className="pm-cal-dot" style={{ background: PRIORITY_COLOR[t.priority] }} />
                  {t.title}
                </div>
              ))}
              {dayTasks.length > 3 && (
                <div style={{ fontSize: 10, color: "var(--muted)" }}>+{dayTasks.length - 3} more</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
