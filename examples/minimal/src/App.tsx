import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import {
  Button,
  Card,
  Chip,
  Description,
  Dropdown,
  FieldError,
  Input,
  Label,
  Modal,
  SearchField,
  Switch,
  TextField,
  Toast,
  toast,
  useOverlayState,
} from "@heroui/react";
import { confirmDialog, messageOf } from "@hanskristoffer/taurio/runtime";
import {
  AppShell,
  useAppShortcuts,
  useAppUpdate,
  useAppVersion,
  useSecretEntry,
  type AppUpdate,
} from "@hanskristoffer/taurio/react";

type View = "general" | "overlays";
const PAGES: Record<View, string> = { general: "General", overlays: "Overlays" };

/**
 * HeroUI for every control, taurio for the Tauri parts: the shell, the macOS
 * theme, updates, the native confirm sheet, shortcuts and the secret flow.
 */
export function App() {
  const [view, setView] = useState<View>("general");
  const [search, setSearch] = useState("");
  // Off outside Tauri, and in a real app on iOS too.
  const updater = useAppUpdate({ enabled: isTauri() });
  useUpdateToast(updater, "Taurio");
  useAppShortcuts({ ",": () => setView("general") });

  const pages = (Object.keys(PAGES) as View[]).filter((id) => PAGES[id].toLowerCase().includes(search.toLowerCase()));

  return (
    <AppShell
      sidebar={
        <>
          <div className="tau-drag-strip flex items-center pr-3 pl-[88px]">
            {/* HeroUI field, frosted by the sidebar's variables. */}
            <SearchField aria-label="Search pages" value={search} onChange={setSearch} className="w-full">
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="Search" />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
          </div>
          <nav className="flex flex-col gap-0.5 px-2">
            {pages.map((id) => (
              <button
                key={id}
                aria-current={view === id ? "page" : undefined}
                onClick={() => setView(id)}
                className="h-[34px] rounded-[10px] px-2.5 text-left text-sm font-medium hover:bg-(--tau-side-row-hover) aria-[current=page]:bg-(--tau-side-row)"
              >
                {PAGES[id]}
              </button>
            ))}
          </nav>
        </>
      }
    >
      <header className="flex items-center gap-2 px-6 pb-2" data-tauri-drag-region="deep">
        <h1 className="m-0 text-[22px] font-semibold">{PAGES[view]}</h1>
        <Dropdown>
          <Button aria-label="More actions" variant="ghost" size="sm" isIconOnly className="ml-auto">
            <Dots />
          </Button>
          <Dropdown.Popover>
            <Dropdown.Menu onAction={(key) => toast(`Chose ${String(key)}`)}>
              <Dropdown.Item id="rename" textValue="Rename">
                <Label>Rename</Label>
              </Dropdown.Item>
              <Dropdown.Item id="delete" textValue="Delete" variant="danger">
                <Label>Delete</Label>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </header>
      <div className="flex-1 overflow-auto px-6 pb-6">
        {view === "general" ? <General updater={updater} /> : <Overlays />}
      </div>
      <Toast.Provider placement="bottom end" />
    </AppShell>
  );
}

/** The update offer as a HeroUI toast, kept open until it is used or dismissed. */
function useUpdateToast({ update, install, dismiss }: AppUpdate, appName: string) {
  useEffect(() => {
    if (!update) return;
    const id = toast(`${appName} ${update.version} is available.`, {
      timeout: 0,
      onClose: dismiss,
      actionProps: {
        children: "Restart to update",
        onPress: () => void install().catch((e: unknown) => toast.danger(messageOf(e))),
      },
    });
    return () => toast.close(id);
  }, [update, install, dismiss, appName]);
}

function General({ updater }: { updater: AppUpdate }) {
  const [sync, setSync] = useState(true);
  const [url, setUrl] = useState("http://127.0.0.1:7878");
  const [apiKey, setApiKey] = useState("");
  const version = useAppVersion();
  const secret = useSecretEntry({
    load: async () => Boolean(apiKey),
    save: async (value) => setApiKey(value),
    verify: async (value) => (value.startsWith("sk-") ? null : "Keys start with sk-"),
  });
  const checkLabel = { idle: "Check for updates", checking: "Checking…", latest: "Up to date", failed: "Check failed" }[
    updater.status
  ];

  return (
    <div className="flex max-w-[580px] flex-col gap-4">
      <Card>
        <Card.Header>
          <Card.Title>Pool behaviour</Card.Title>
          <Card.Description>These settings sync to every paired machine.</Card.Description>
        </Card.Header>
        <Card.Content className="flex flex-col gap-4">
          <Switch isSelected={sync} onChange={setSync}>
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <div className="flex flex-col gap-0.5">
                <Label>Sync</Label>
                <Description>Across your machines.</Description>
              </div>
            </Switch.Content>
          </Switch>
          <TextField value={url} onChange={setUrl} isInvalid={!/^https?:\/\//.test(url)}>
            <Label>Daemon address</Label>
            <Input />
            <Description>This machine or a node on your Tailscale network.</Description>
            <FieldError>Start with http:// or https://</FieldError>
          </TextField>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title>API key</Card.Title>
          <Card.Description>The flow is useSecretEntry; the controls are HeroUI.</Card.Description>
        </Card.Header>
        <Card.Content>
          {secret.showInput ? (
            <div className="flex items-start gap-2">
              <TextField
                aria-label="API key"
                type="password"
                value={secret.value}
                onChange={secret.setValue}
                isInvalid={Boolean(secret.error)}
                className="flex-1"
              >
                <Input placeholder="sk-…" onKeyDown={(e) => e.key === "Enter" && void secret.submit()} />
                <FieldError>{secret.error}</FieldError>
              </TextField>
              <Button isDisabled={!secret.value.trim() || secret.checking} onPress={() => void secret.submit()}>
                {secret.checking ? "Checking…" : "Save"}
              </Button>
              {secret.canCancel && (
                <Button variant="secondary" onPress={secret.cancel}>
                  Cancel
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm text-success">Saved in your Keychain</span>
              <Button variant="secondary" size="sm" onPress={secret.edit}>
                Change
              </Button>
            </div>
          )}
        </Card.Content>
      </Card>

      <p className="text-xs text-muted">
        Version {version || "…"}
        {updater.enabled && (
          <>
            {" · "}
            <Button variant="ghost" size="sm" isDisabled={updater.status === "checking"} onPress={() => void updater.check()}>
              {checkLabel}
            </Button>
          </>
        )}
      </p>
    </div>
  );
}

function Overlays() {
  const modal = useOverlayState();
  return (
    <div className="flex max-w-[580px] flex-col gap-4">
      <Card>
        <Card.Header>
          <Card.Title>Status</Card.Title>
        </Card.Header>
        <Card.Content className="flex flex-row flex-wrap gap-2">
          <Chip color="success" variant="soft">
            Online
          </Chip>
          <Chip>Claude</Chip>
          <Chip color="danger" variant="soft">
            Exhausted
          </Chip>
        </Card.Content>
      </Card>
      <Card>
        <Card.Header>
          <Card.Title>Overlays</Card.Title>
          <Card.Description>HeroUI modal and toasts; taurio's native confirm sheet.</Card.Description>
        </Card.Header>
        <Card.Content className="flex flex-row flex-wrap gap-2">
          <Button variant="secondary" onPress={modal.open}>
            Open modal
          </Button>
          <Button variant="secondary" onPress={() => toast.success("Saved")}>
            Toast
          </Button>
          <Button variant="secondary" onPress={() => toast.danger("Lost the connection")}>
            Error toast
          </Button>
          <Button
            variant="danger-soft"
            onPress={() =>
              void confirmDialog("Delete this account?", { destructive: true, okLabel: "Delete" }).then(
                (ok) => ok && toast("Deleted"),
              )
            }
          >
            Delete…
          </Button>
        </Card.Content>
      </Card>
      <Modal.Backdrop isOpen={modal.isOpen} onOpenChange={modal.setOpen}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[420px]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Connect to Agentgate</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <TextField defaultValue="http://127.0.0.1:7878" autoFocus>
                <Label>Daemon address</Label>
                <Input />
              </TextField>
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close">Connect</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}

const Dots = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="5" cy="12" r="1.6" />
    <circle cx="12" cy="12" r="1.6" />
    <circle cx="19" cy="12" r="1.6" />
  </svg>
);
