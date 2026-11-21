export function parseTimeToMinutes(time: string): number | null {
  const m = time.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]); const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

export function classifyAttendance(checkIn?: string | null, checkOut?: string | null, workStart = "08:00", graceMinutes = 20) {
  if (!checkIn) return { status: "ABSENT", minutesLate: 0 };
  const start = parseTimeToMinutes(workStart) ?? 480;
  const inMin = parseTimeToMinutes(checkIn);
  if (inMin == null) return { status: "INCOMPLETE", minutesLate: 0 };
  const minutesLate = Math.max(0, inMin - start);
  let status = "PRESENT";
  if (minutesLate > graceMinutes) status = "LATE";
  else if (minutesLate > 0) status = "GRACE";
  if (!checkOut) status = "INCOMPLETE";
  return { status, minutesLate };
}

export function normalizeDate(value: unknown): Date | null {
  if (value instanceof Date && !isNaN(value.getTime())) return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  if (typeof value === "number") {
    const d = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  const s = String(value ?? "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) { const d = new Date(s.slice(0,10)+"T00:00:00Z"); if(!isNaN(d.getTime())) return d; }
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const a = +m[1], b = +m[2], y = +(m[3].length === 2 ? "20"+m[3] : m[3]);
    const day = a > 12 ? a : b > 12 ? b : a;
    const month = a > 12 ? b : b > 12 ? a : b;
    const d = new Date(Date.UTC(y, month - 1, day));
    if (!isNaN(d.getTime())) return d;
  }
  const d = new Date(s); if(!isNaN(d.getTime())) return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  return null;
}

export function normalizeTime(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  if (value instanceof Date && !isNaN(value.getTime())) return `${String(value.getHours()).padStart(2,"0")}:${String(value.getMinutes()).padStart(2,"0")}`;
  if (typeof value === "number") { const total = Math.round(value * 24 * 60); if (total >=0 && total < 1440) return `${String(Math.floor(total/60)).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`; }
  const s = String(value).trim(); const m = s.match(/(\d{1,2}):(\d{2})/);
  if (m) { const hh = String(+m[1]).padStart(2,"0"); const mm = m[2]; const t = `${hh}:${mm}`; return parseTimeToMinutes(t)!=null ? t : undefined; }
  return undefined;
}
