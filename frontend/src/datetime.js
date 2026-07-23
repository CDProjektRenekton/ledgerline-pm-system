// <input type="datetime-local"> always holds a *naive* local wall-clock
// string like "2024-01-16T07:30" — no timezone attached. The browser reads
// and writes that value as "whatever the user's local clock says", never
// as UTC.
//
// The bug this file fixes: code elsewhere in this file used
// `date.toISOString().slice(0, 16)` to both read AND write these inputs.
// toISOString() always returns UTC components, not local ones — so:
//   - Writing a default/existing value into the input showed the WRONG
//     time (UTC hour mislabeled as local hour).
//   - Reading a value out of the input and sending it straight to the
//     backend sent a naive string with no timezone info. Postgres then
//     interpreted it using its own session timezone (UTC on this server),
//     not the user's actual local timezone (UTC+8 for the Philippines) —
//     silently shifting every saved time by the difference (e.g. 7:30 AM
//     entered became 3:30 PM once round-tripped through storage).
//
// Fix: always convert explicitly at the boundary, using LOCAL date/time
// getters (never toISOString) to build the input value, and letting the
// browser's own local-time parsing (guaranteed by spec) turn the input's
// naive string back into a correct absolute instant before it ever reaches
// the backend.

// A real timestamp (Date, ISO string, or timestamptz value from the API)
// -> the "YYYY-MM-DDTHH:mm" string a datetime-local input expects, using
// LOCAL wall-clock components so the input displays the correct time.
export function toLocalInputValue(dateLike) {
  if (!dateLike) return "";
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// A datetime-local input's raw value ("2024-01-16T07:30") -> a real,
// unambiguous ISO-8601 UTC string safe to send to the backend. Relies on
// the browser correctly parsing a naive datetime string as local time
// (guaranteed behavior, unlike the Node backend where "local" depends on
// the server's own TZ setting) — so this conversion always happens on the
// client, never trusting the server to guess the user's timezone.
export function fromLocalInputValue(value) {
  if (!value) return undefined;
  const d = new Date(value);
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString();
}
