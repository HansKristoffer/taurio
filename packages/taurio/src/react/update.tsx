import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { getVersion } from "@tauri-apps/api/app";

import { checkForUpdate, watchForUpdates, type Update } from "../runtime/update.js";
import { ToastCard } from "./toasts.js";

export type AppUpdate = ReturnType<typeof useAppUpdate>;

/**
 * Watches for a signed build in the background and holds the one on offer.
 * Nothing downloads until `install` is called. Pass `enabled: false` on
 * platforms without the updater plugin (iOS updates through the App Store).
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

  /** A manual check. A found update is offered at once; rejects when the check fails. */
  const check = useCallback(async () => {
    if (!enabled) return null;
    const found = await checkForUpdate();
    if (found) offer(found);
    return found;
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

  return { enabled, update, installing, check, install, dismiss };
}

/** The offer as a toast. Render it inside Toasts. Nothing when there is no update. */
export function UpdateToast({
  updater,
  children,
  action = "Restart to update",
  installingLabel = "Installing…",
  onError,
  dismissIcon,
}: {
  updater: AppUpdate;
  /** The message. Defaults to "Version x is available." */
  children?: ReactNode;
  action?: string;
  installingLabel?: string;
  /** A failed install; the toast stays so it can be tried again. */
  onError?(error: unknown): void;
  dismissIcon?: ReactNode;
}) {
  const { update, installing, install, dismiss } = updater;
  if (!update) return null;
  return (
    <ToastCard
      busy={installing}
      onDismiss={dismiss}
      dismissIcon={dismissIcon}
      action={{
        label: installing ? installingLabel : action,
        run: () => void install().catch((e: unknown) => onError?.(e)),
      }}
    >
      {children ?? `Version ${update.version} is available.`}
    </ToastCard>
  );
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

const LABELS = {
  idle: "Check for updates",
  checking: "Checking…",
  latest: "Up to date",
  failed: "Check failed",
};

/**
 * For when you cannot wait for the next background check. A found update shows
 * up wherever `updater.update` is rendered, normally the UpdateToast.
 */
export function UpdateCheckButton({ updater, className = "tau-link-btn" }: { updater: AppUpdate; className?: string }) {
  const [state, setState] = useState<keyof typeof LABELS>("idle");
  if (!updater.enabled) return null;
  return (
    <button
      type="button"
      className={className}
      disabled={state === "checking"}
      onClick={() => {
        setState("checking");
        updater.check().then(
          (found) => setState(found ? "idle" : "latest"),
          () => setState("failed"),
        );
      }}
    >
      {LABELS[state]}
    </button>
  );
}
