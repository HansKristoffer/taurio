import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";

/**
 * Self-update through the Tauri updater plugin. The app's tauri.conf.json holds
 * the endpoint and the public key, so a build not signed with the matching
 * private key is refused before it is unpacked. Nothing here knows either.
 *
 * Mobile has no updater plugin; callers skip all of this there (see the
 * `enabled` option of useAppUpdate).
 */

/** Four hours. Both apps are left open for days at a time. */
export const UPDATE_INTERVAL = 4 * 60 * 60 * 1000;

export type Update = {
  version: string;
  /** Downloads, installs and relaunches. Repeated calls share one attempt. */
  install(): Promise<void>;
};

let inFlight: Promise<Update | null> | undefined;

/**
 * Null when there is nothing newer. Rejects when the check could not be made,
 * which is usually being offline. Concurrent calls share one request, so a
 * manual check during the background one does not start a second.
 */
export function checkForUpdate(): Promise<Update | null> {
  inFlight ??= find().finally(() => {
    inFlight = undefined;
  });
  return inFlight;
}

async function find(): Promise<Update | null> {
  const update = await check();
  if (!update) return null;
  let installing: Promise<void> | undefined;
  return {
    version: update.version,
    install: () =>
      (installing ??= (async () => {
        await update.downloadAndInstall();
        await relaunch();
      })().catch((e: unknown) => {
        // A failed attempt can be retried; a running one cannot be doubled.
        installing = undefined;
        throw e;
      })),
  };
}

export type WatchOptions = {
  interval?: number;
  /** Background failures are otherwise silent: offline is not worth interrupting anyone over. */
  onError?(error: unknown): void;
};

/**
 * Checks now and every `interval` after. Returns the stop function, for an
 * effect cleanup; nothing is reported after it is called, including a check
 * that was already under way.
 */
export function watchForUpdates(
  found: (update: Update) => void,
  { interval = UPDATE_INTERVAL, onError }: WatchOptions = {},
): () => void {
  let stopped = false;
  const run = () =>
    checkForUpdate().then(
      (update) => {
        if (update && !stopped) found(update);
      },
      (e: unknown) => {
        if (!stopped) onError?.(e);
      },
    );
  void run();
  const timer = setInterval(() => void run(), interval);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
