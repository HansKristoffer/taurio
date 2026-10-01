import { useCallback, useEffect, useRef, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";

import { checkForUpdate, watchForUpdates, type Update } from "../runtime/update.js";

export type AppUpdate = ReturnType<typeof useAppUpdate>;
/** The last manual check: running, nothing newer, or failed. A found update is in `update`. */
export type CheckStatus = "idle" | "checking" | "latest" | "failed";

/**
 * Watches for a signed build in the background and holds the one on offer.
 * Nothing downloads until `install` is called. Pass `enabled: false` on
 * platforms without the updater plugin (iOS updates through the App Store).
 * Render the offer with the app's own UI, e.g. a HeroUI toast.
 */
export function useAppUpdate({
  enabled = true,
  onError,
}: {
  enabled?: boolean;
  /** Background check failures, which are otherwise silent. */
  onError?(error: unknown): void;
} = {}) {
  const [update, setUpdate] = useState<Update | null>(null);
  const [installing, setInstalling] = useState(false);
  const [status, setStatus] = useState<CheckStatus>("idle");
  const errors = useRef(onError);
  useEffect(() => {
    errors.current = onError;
  });

  // The same version found again keeps the update already on offer, and with
  // it any install already under way.
  const offer = useCallback(
    (found: Update) => setUpdate((current) => (current?.version === found.version ? current : found)),
    [],
  );

  useEffect(() => {
    if (!enabled) return;
    return watchForUpdates(offer, { onError: (e) => errors.current?.(e) });
  }, [enabled, offer]);

  /** A manual check. A found update is offered at once; `status` says how it went. */
  const check = useCallback(async () => {
    if (!enabled) return null;
    setStatus("checking");
    try {
      const found = await checkForUpdate();
      if (found) offer(found);
      setStatus(found ? "idle" : "latest");
      return found;
    } catch {
      setStatus("failed");
      return null;
    }
  }, [enabled, offer]);

  /**
   * Rejects if the download or install fails, so the caller can say so. A call
   * while one is under way does nothing, so a failure is reported once.
   */
  const busy = useRef(false);
  const install = useCallback(async () => {
    if (!update || busy.current) return;
    busy.current = true;
    setInstalling(true);
    try {
      await update.install();
    } catch (e) {
      setInstalling(false);
      throw e;
    } finally {
      busy.current = false;
    }
  }, [update]);

  const dismiss = useCallback(() => setUpdate(null), []);

  return { enabled, update, installing, status, check, install, dismiss };
}

/** The running app's version, or "" until it is known (and outside Tauri). */
export function useAppVersion() {
  const [version, setVersion] = useState("");
  useEffect(() => {
    let live = true;
    getVersion().then(
      (v) => live && setVersion(v),
      () => {},
    );
    return () => {
      live = false;
    };
  }, []);
  return version;
}
