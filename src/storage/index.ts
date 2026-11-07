import { useSyncExternalStore } from "react";
import { stateSchema, type AppState } from "../types";
export const STORAGE_KEY = "sobri-drugforge-v1";
export const emptyState = (): AppState => ({
  schemaVersion: 1,
  projects: [],
  candidates: [],
  analyses: [],
  theme: "dark",
  savedSearches: [],
});
export function parseBackup(raw: string): AppState {
  return stateSchema.parse(JSON.parse(raw));
}
let warning = "";
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? parseBackup(raw) : emptyState();
  } catch {
    warning =
      "Saved data could not be read. It has not been overwritten. Export the raw backup before restoring or resetting.";
    return emptyState();
  }
}
let current = load();
const listeners = new Set<() => void>();
export function storageWarning() {
  return warning;
}
export function update(fn: (s: AppState) => AppState, replaceCorrupt = false) {
  if (warning && !replaceCorrupt)
    throw Error(
      "Saved data needs recovery. Export a raw backup, then restore or reset in Local Data Manager.",
    );
  const next = stateSchema.parse(fn(current));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    throw Error(
      "Storage is unavailable or full. Export a backup and free space before saving.",
    );
  }
  current = next;
  warning = "";
  listeners.forEach((f) => f());
}
export function useStore() {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    () => current,
  );
}
window.addEventListener("storage", (e) => {
  if (e.key === STORAGE_KEY) {
    current = load();
    listeners.forEach((f) => f());
  }
});
export function download(
  name: string,
  data: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function csv(rows: Record<string, unknown>[]) {
  const keys = [...new Set(rows.flatMap(Object.keys))];
  const escape = (v: unknown) => {
    let text = String(v ?? "");
    if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return [
    keys.map(escape).join(","),
    ...rows.map((row) => keys.map((k) => escape(row[k])).join(",")),
  ].join("\r\n");
}
