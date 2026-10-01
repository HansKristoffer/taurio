import { useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import {
  AppShell,
  Badge,
  CheckboxRow,
  EmptyState,
  Field,
  NumberSelect,
  SecretField,
  Segmented,
  SettingsGroup,
  SettingsRow,
  SwitchRow,
  Toasts,
  UpdateCheckButton,
  UpdateToast,
  useAppShortcuts,
  useAppUpdate,
  useAppVersion,
  useToasts,
} from "@hanskristoffer/taurio/react";

type View = "home" | "settings";

/** Every export in one screen. Not an app template: copy the calls, not the layout. */
export function App() {
  const [view, setView] = useState<View>("home");
  const [sync, setSync] = useState(true);
  const [retries, setRetries] = useState(3);
  const [url, setUrl] = useState("http://127.0.0.1:7878");
  const [apiKey, setApiKey] = useState("");
  const { toasts, push, dismiss } = useToasts();
  // Off outside Tauri, and in a real app on iOS too.
  const updater = useAppUpdate({ enabled: isTauri() });
  const version = useAppVersion();
  useAppShortcuts({ ",": () => setView("settings") });

  return (
    <AppShell
      sidebar={
        <>
          <div className="tau-drag-strip" />
          <nav style={{ padding: "0 12px" }}>
            <Segmented
              label="View"
              value={view}
              onChange={setView}
              options={[
                { id: "home", label: "Home" },
                { id: "settings", label: "Settings" },
              ]}
            />
          </nav>
        </>
      }
    >
      <div style={{ padding: "0 24px", overflow: "auto" }}>
        {view === "home" ? (
          <EmptyState>
            <strong>Nothing here yet</strong>
            <button className="tau-button primary" onClick={() => push("Saved")}>
              Toast
            </button>
            <button className="tau-button danger" onClick={() => push("Something broke", "err")}>
              Error toast
            </button>
          </EmptyState>
        ) : (
          <>
            <SettingsGroup title="General" detail="Shown as in System Settings." action={<Badge tone="good">Synced</Badge>}>
              <SwitchRow label="Sync" description="Across your machines." checked={sync} onChange={setSync} />
              <SettingsRow label="Retries" description="Times a request is tried again." htmlFor="retries">
                <NumberSelect
                  id="retries"
                  value={retries}
                  onChange={setRetries}
                  options={[
                    [0, "Never"],
                    [3, "3 times"],
                    [10, "10 times"],
                  ]}
                />
              </SettingsRow>
              <SecretField
                label="API key"
                hint="Stored by the app; this example keeps it in memory."
                placeholder="sk-…"
                load={async () => Boolean(apiKey)}
                save={async (value) => setApiKey(value)}
                verify={async (value) => (value.startsWith("sk-") ? null : "Keys start with sk-")}
              />
            </SettingsGroup>
            <SettingsGroup title="MCP servers">
              <CheckboxRow label="github" name="server" value="github" defaultChecked />
              <CheckboxRow label="linear" description="Tool prefix: lin" name="server" value="linear" />
            </SettingsGroup>
            <form style={{ maxWidth: 420 }} onSubmit={(e) => e.preventDefault()}>
              <Field
                label="Daemon address"
                hint="This machine or a node on your Tailscale network."
                error={/^https?:\/\//.test(url) ? undefined : "Start with http:// or https://"}
              >
                <input value={url} onChange={(e) => setUrl(e.target.value)} />
              </Field>
              <Field label="When every account is exhausted">
                <select defaultValue="fail">
                  <option value="fail">Return a limit response</option>
                  <option value="wait">Wait for the next reset</option>
                </select>
              </Field>
              <Field label="Config">
                <textarea className="tau-mono" readOnly value={'{ "threshold": 90 }'} />
              </Field>
              <div className="tau-inline" style={{ marginBottom: 14 }}>
                <input className="tau-small" placeholder="owner/repo" />
                <select className="tau-small" style={{ flex: "none", width: "auto" }}>
                  <option>main</option>
                </select>
                <button className="tau-button tau-small">Add</button>
              </div>
            </form>
            <p style={{ fontSize: 12, color: "var(--fg-2)", margin: "0 4px" }}>
              Version {version || "…"} · <UpdateCheckButton updater={updater} />
            </p>
          </>
        )}
      </div>
      <Toasts toasts={toasts} dismiss={dismiss}>
        <UpdateToast updater={updater} onError={(e) => push(String(e), "err")} />
      </Toasts>
    </AppShell>
  );
}
