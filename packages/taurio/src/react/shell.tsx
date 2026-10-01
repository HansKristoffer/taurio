import { useEffect, useRef, type ReactNode } from "react";

/**
 * Frosted sidebar beside one inset card. The window drags from the sidebar and
 * the card's top strip; Tauri already exempts buttons and inputs, so they keep
 * their clicks. Navigation, content and responsive policy stay in the app.
 */
export function AppShell({
  sidebar,
  titlebar,
  overlay,
  collapsed = false,
  className,
  children,
}: {
  sidebar: ReactNode;
  /** Controls on the titlebar row, right of the traffic lights. */
  titlebar?: ReactNode;
  /** Outside the card: dialogs, sheets. */
  overlay?: ReactNode;
  collapsed?: boolean;
  className?: string;
  /** The card's content, under its drag strip. */
  children: ReactNode;
}) {
  return (
    <div className={className ? `tau-app ${className}` : "tau-app"} data-tauri-drag-region>
      {titlebar && <div className="tau-titlebar">{titlebar}</div>}
      <aside className={collapsed ? "tau-sidebar collapsed" : "tau-sidebar"} data-tauri-drag-region="deep">
        {sidebar}
      </aside>
      <main className="tau-main">
        <div className="tau-drag-strip" data-tauri-drag-region="deep" />
        {children}
      </main>
      {overlay}
    </div>
  );
}

const apple = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);

/**
 * Cmd+key on Apple platforms, Ctrl+key elsewhere. Keys are lower-case
 * `KeyboardEvent.key` values: `useAppShortcuts({ ",": openSettings, b: toggleSidebar })`.
 */
export function useAppShortcuts(shortcuts: Record<string, (event: KeyboardEvent) => void>) {
  const current = useRef(shortcuts);
  useEffect(() => {
    current.current = shortcuts;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(apple ? e.metaKey : e.ctrlKey)) return;
      const run = current.current[e.key.toLowerCase()];
      if (!run) return;
      e.preventDefault();
      run(e);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
