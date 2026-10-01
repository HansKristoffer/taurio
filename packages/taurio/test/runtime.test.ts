import { expect, mock, test } from "bun:test";

import { confirmDialog, followSystemTheme, messageOf } from "../src/runtime/index.js";
import { tauri } from "./setup.js";

test("confirmDialog uses the native sheet in Tauri and window.confirm in a browser", async () => {
  tauri.native = true;
  tauri.ask.mockImplementation(async () => false);
  expect(await confirmDialog("Delete this?", { destructive: true, okLabel: "Delete" })).toBe(false);
  expect(tauri.ask).toHaveBeenLastCalledWith("Delete this?", {
    title: undefined,
    okLabel: "Delete",
    cancelLabel: "Cancel",
    kind: "warning",
  });

  tauri.native = false;
  const original = window.confirm;
  window.confirm = mock(() => true);
  try {
    expect(await confirmDialog("Delete this?")).toBe(true);
    expect(window.confirm).toHaveBeenCalledWith("Delete this?");
  } finally {
    window.confirm = original;
    tauri.native = true;
  }
});

test("followSystemTheme mirrors the system appearance onto the dark class until stopped", () => {
  const listeners = new Set<() => void>();
  const query = {
    matches: true,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  };
  const original = window.matchMedia;
  window.matchMedia = (() => query) as unknown as typeof window.matchMedia;
  const root = document.createElement("html");
  try {
    const stop = followSystemTheme(root);
    expect(root.classList.contains("dark")).toBe(true);
    query.matches = false;
    listeners.forEach((fn) => fn());
    expect(root.classList.contains("dark")).toBe(false);
    stop();
    expect(listeners.size).toBe(0);
  } finally {
    window.matchMedia = original;
  }
});

test("messageOf reads an Error's message and stringifies anything else", () => {
  expect(messageOf(new Error("offline"))).toBe("offline");
  expect(messageOf("plain")).toBe("plain");
});
