export const WEEK_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday"
];

export function parseTime(value) {
  if (value === null || value === undefined || value === "") return null;
  const digits = String(value).trim().replace(":", "");
  if (!/^\d{3,4}$/.test(digits)) return null;

  const padded = digits.padStart(4, "0");
  const hours = Number(padded.slice(0, 2));
  const minutes = Number(padded.slice(2));
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function timeToMinutes(value) {
  const parsed = parseTime(value);
  if (!parsed) return null;
  const [hours, minutes] = parsed.split(":").map(Number);
  return hours * 60 + minutes;
}

export function shiftDurationHours(start, end) {
  const startMinutes = timeToMinutes(start);
  let endMinutes = timeToMinutes(end);
  if (startMinutes === null || endMinutes === null) return 0;
  if (endMinutes < startMinutes) endMinutes += 24 * 60;
  return Number(((endMinutes - startMinutes) / 60).toFixed(2));
}

export function totalScheduledHours(schedule = []) {
  return Number(
    schedule
      .reduce((total, shift) => total + shiftDurationHours(shift.start, shift.end), 0)
      .toFixed(2)
  );
}

export function emptySchedule() {
  return WEEK_DAYS.map((day) => ({ day, start: "", end: "" }));
}

export function shouldLeadWithDessert({
  shiftHours,
  serviceMoment,
  minutesAvailable,
  hasDessert
}) {
  return Boolean(
    hasDessert &&
      Number(shiftHours) > 0 &&
      Number(shiftHours) <= 4 &&
      serviceMoment === "break" &&
      Number(minutesAvailable) <= 20
  );
}
