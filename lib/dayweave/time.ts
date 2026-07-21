import type { Minute } from "./types";

export function minute(hour: number, minutes = 0): Minute {
  if (!Number.isInteger(hour) || !Number.isInteger(minutes)) {
    throw new Error("hour and minutes must be integers");
  }

  return hour * 60 + minutes;
}

export function parseTime(value: string): Minute {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid time: ${value}`);

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) throw new Error(`Invalid time: ${value}`);
  return minute(hours, minutes);
}

export function formatTime(value: Minute): string {
  const normalized = Math.max(0, Math.round(value));
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const suffix = hours % 24 >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}
