export function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function utcRoundKey(d = new Date()): string {
  const iso = d.toISOString();
  const hour = Math.floor(Number(iso.slice(11, 13)) / 3) * 3;
  return `${iso.slice(0, 10)}T${String(hour).padStart(2, "0")}`;
}

export function roundEndsAt(roundKey: string): string {
  const [day, h] = roundKey.split("T");
  const start = Date.parse(`${day}T${h}:00:00.000Z`);
  return new Date(start + 3 * 3600 * 1000).toISOString();
}
