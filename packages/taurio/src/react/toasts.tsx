import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export type ToastAction = { label: string; run(): void };
export type Toast = {
  id: number;
  text: ReactNode;
  kind: "ok" | "err";
  action?: ToastAction;
};

let nextId = 1;

/**
 * Errors and anything with a button stay until dismissed; confirmations fade
 * after `timeout` ms.
 */
export function useToasts({ timeout = 4000 }: { timeout?: number } = {}) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (text: ReactNode, kind: Toast["kind"] = "ok", action?: ToastAction) => {
      const id = nextId++;
      setToasts((list) => [...list, { id, text, kind, action }]);
      if (kind === "ok" && !action && timeout > 0)
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), timeout),
        );
      return id;
    },
    [dismiss, timeout],
  );

  return { toasts, push, dismiss };
}

const X = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

/** One notification. Toasts and UpdateToast both render through this. */
export function ToastCard({
  kind = "ok",
  children,
  action,
  busy,
  onDismiss,
  dismissIcon = <X />,
}: {
  kind?: Toast["kind"];
  children: ReactNode;
  action?: { label: ReactNode; run(): void };
  busy?: boolean;
  onDismiss(): void;
  dismissIcon?: ReactNode;
}) {
  return (
    <div className={`tau-toast ${kind}`} role={kind === "err" ? "alert" : "status"}>
      <span>{children}</span>
      {action && (
        <button type="button" className="tau-toast-action" disabled={busy} onClick={action.run}>
          {action.label}
        </button>
      )}
      <button type="button" aria-label="Dismiss notification" title="Dismiss" onClick={onDismiss}>
        {dismissIcon}
      </button>
    </div>
  );
}

/**
 * The stack in the corner of its positioned parent. `children` go above the
 * pushed toasts, which is where an UpdateToast belongs. Position it with
 * --tau-toast-right and --tau-toast-bottom, e.g. to clear a toolbar.
 */
export function Toasts({
  toasts,
  dismiss,
  dismissIcon,
  children,
}: {
  toasts: Toast[];
  dismiss(id: number): void;
  dismissIcon?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="tau-toasts">
      {children}
      {toasts.map((toast) => (
        <ToastCard
          key={toast.id}
          kind={toast.kind}
          dismissIcon={dismissIcon}
          onDismiss={() => dismiss(toast.id)}
          action={
            toast.action && {
              label: toast.action.label,
              run: () => {
                dismiss(toast.id);
                toast.action?.run();
              },
            }
          }
        >
          {toast.text}
        </ToastCard>
      ))}
    </div>
  );
}
