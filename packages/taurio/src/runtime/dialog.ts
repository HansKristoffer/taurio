import { isTauri } from "@tauri-apps/api/core";
import { ask } from "@tauri-apps/plugin-dialog";

/**
 * Asks before something that cannot be undone, as a native sheet: the dialog
 * plugin in Tauri (needs `dialog:allow-ask`), window.confirm in a browser.
 * `destructive` shows the warning style.
 */
export function confirmDialog(
  message: string,
  {
    title,
    okLabel = "OK",
    cancelLabel = "Cancel",
    destructive = false,
  }: { title?: string; okLabel?: string; cancelLabel?: string; destructive?: boolean } = {},
): Promise<boolean> {
  if (!isTauri()) return Promise.resolve(window.confirm(message));
  return ask(message, { title, okLabel, cancelLabel, kind: destructive ? "warning" : "info" });
}
