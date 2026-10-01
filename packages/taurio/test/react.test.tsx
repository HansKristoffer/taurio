import { beforeEach, expect, mock, test } from "bun:test";
import { act, StrictMode, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

import {
  Segmented,
  SwitchRow,
  Toasts,
  UpdateCheckButton,
  UpdateToast,
  useAppShortcuts,
  useAppUpdate,
  useToasts,
} from "../src/react/index.js";
import { fakeUpdate, tauri } from "./setup.js";

async function render(node: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<StrictMode>{node}</StrictMode>));
  return {
    container,
    unmount: () => act(async () => root.unmount()),
  };
}
const settle = (ms = 0) => act(() => Bun.sleep(ms));
const click = (el: Element | null | undefined) => act(async () => (el as HTMLElement).click());
const byText = (root: Element, text: string) =>
  [...root.querySelectorAll("button")].find((b) => b.textContent === text);

beforeEach(() => {
  document.body.innerHTML = "";
  tauri.check.mockReset();
  tauri.check.mockImplementation(async () => null);
  tauri.relaunch.mockReset();
  tauri.relaunch.mockImplementation(async () => {});
});

/* ---------- toasts ---------- */

let toasts: ReturnType<typeof useToasts>;
function ToastApp() {
  toasts = useToasts({ timeout: 20 });
  return <Toasts toasts={toasts.toasts} dismiss={toasts.dismiss} />;
}

test("confirmations fade; errors and toasts with an action stay", async () => {
  const { container } = await render(<ToastApp />);
  const run = mock();
  await act(async () => {
    toasts.push("Saved");
    toasts.push("Broke", "err");
    toasts.push("Ready", "ok", { label: "Open", run });
  });
  expect(container.querySelectorAll(".tau-toast")).toHaveLength(3);
  expect(container.querySelector(".tau-toast.err")?.getAttribute("role")).toBe("alert");

  await settle(40);
  expect([...container.querySelectorAll(".tau-toast > span")].map((s) => s.textContent)).toEqual(["Broke", "Ready"]);

  await click(byText(container, "Open"));
  expect(run).toHaveBeenCalledTimes(1);
  await click(container.querySelector('[aria-label="Dismiss notification"]'));
  expect(container.querySelectorAll(".tau-toast")).toHaveLength(0);
});

test("unmounting clears pending fade timers", async () => {
  const { unmount } = await render(<ToastApp />);
  const cleared = mock();
  const original = globalThis.clearTimeout;
  globalThis.clearTimeout = ((id: Parameters<typeof clearTimeout>[0]) => {
    cleared(id);
    original(id);
  }) as typeof clearTimeout;
  try {
    await act(async () => void toasts.push("Saved"));
    await unmount();
    expect(cleared).toHaveBeenCalled();
  } finally {
    globalThis.clearTimeout = original;
  }
});

/* ---------- updates ---------- */

function UpdateApp({ onError = () => {} }: { onError?(e: unknown): void }) {
  const updater = useAppUpdate();
  return (
    <>
      <Toasts toasts={[]} dismiss={() => {}}>
        <UpdateToast updater={updater} onError={onError} />
      </Toasts>
      <UpdateCheckButton updater={updater} />
    </>
  );
}

test("StrictMode's double mount neither doubles the check nor the offer", async () => {
  tauri.check.mockImplementation(async () => fakeUpdate("2.0.0"));
  const { container } = await render(<UpdateApp />);
  await settle();
  expect(tauri.check).toHaveBeenCalledTimes(1);
  expect(container.querySelectorAll(".tau-toast")).toHaveLength(1);
  expect(container.querySelector(".tau-toast span")?.textContent).toBe("Version 2.0.0 is available.");
});

test("a manual check offers what it finds at once, and says when there is nothing", async () => {
  const { container } = await render(<UpdateApp />);
  await settle();
  expect(container.querySelector(".tau-toast")).toBeNull();

  await click(byText(container, "Check for updates"));
  await settle();
  expect(byText(container, "Up to date")).toBeDefined();

  tauri.check.mockImplementation(async () => {
    throw new Error("offline");
  });
  await click(byText(container, "Up to date"));
  await settle();
  expect(byText(container, "Check failed")).toBeDefined();

  tauri.check.mockImplementation(async () => fakeUpdate("2.0.0"));
  await click(byText(container, "Check failed"));
  await settle();
  expect(container.querySelector(".tau-toast")).not.toBeNull();
  expect(byText(container, "Check for updates")).toBeDefined();
});

test("install: double clicks start one download, and a failure keeps the offer", async () => {
  const raw = fakeUpdate("2.0.0", async () => {
    await Bun.sleep(5);
    throw new Error("disk full");
  });
  tauri.check.mockImplementation(async () => raw);
  const onError = mock();
  const { container } = await render(<UpdateApp onError={onError} />);
  await settle();

  const action = container.querySelector(".tau-toast-action") as HTMLButtonElement;
  await act(async () => {
    action.click();
    action.click();
  });
  expect(action.textContent).toBe("Installing…");
  expect(action.disabled).toBe(true);
  await settle(20);

  expect(raw.downloadAndInstall).toHaveBeenCalledTimes(1);
  expect(onError).toHaveBeenCalledTimes(1);
  expect(tauri.relaunch).not.toHaveBeenCalled();
  const again = container.querySelector(".tau-toast-action") as HTMLButtonElement;
  expect(again.textContent).toBe("Restart to update");
  expect(again.disabled).toBe(false);
});

test("disabled updater never checks and hides the button", async () => {
  function Off() {
    const updater = useAppUpdate({ enabled: false });
    return <UpdateCheckButton updater={updater} />;
  }
  const { container } = await render(<Off />);
  await settle();
  expect(tauri.check).not.toHaveBeenCalled();
  expect(container.querySelector("button")).toBeNull();
});

/* ---------- controls ---------- */

test("segmented control is a keyboard-operable radio group", async () => {
  function Seg() {
    const [value, setValue] = useState<"a" | "b" | "c">("a");
    return (
      <Segmented
        label="Mode"
        value={value}
        onChange={setValue}
        options={[
          { id: "a", label: "A" },
          { id: "b", label: "B" },
          { id: "c", label: "C" },
        ]}
      />
    );
  }
  const { container } = await render(<Seg />);
  const radios = () => [...container.querySelectorAll('[role="radio"]')] as HTMLButtonElement[];
  const checked = () => radios().findIndex((r) => r.getAttribute("aria-checked") === "true");
  const key = (key: string) =>
    act(async () => void document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })));

  expect(radios().map((r) => r.tabIndex)).toEqual([0, -1, -1]);
  radios()[0]!.focus();
  await key("ArrowLeft");
  expect(checked()).toBe(2);
  expect(document.activeElement).toBe(radios()[2]!);
  await key("ArrowRight");
  expect(checked()).toBe(0);
  await key("End");
  expect(checked()).toBe(2);
  await key("Home");
  expect(checked()).toBe(0);
  await click(radios()[1]);
  expect(checked()).toBe(1);
  expect(radios().map((r) => r.tabIndex)).toEqual([-1, 0, -1]);
});

test("switch row works as an uncontrolled form field", async () => {
  const { container } = await render(
    <form>
      <SwitchRow label="Sync" description="Across machines" name="sync" defaultChecked />
    </form>,
  );
  const input = container.querySelector('input[role="switch"]') as HTMLInputElement;
  expect(input.closest("label")?.textContent).toBe("SyncAcross machines");
  expect(new FormData(container.querySelector("form")!).get("sync")).toBe("on");
});

test("shortcuts fire with the platform modifier only", async () => {
  const settings = mock();
  function Keys() {
    useAppShortcuts({ ",": settings });
    return null;
  }
  await render(<Keys />);
  const apple = /Mac|iPhone|iPad/.test(navigator.userAgent);
  const press = (init: KeyboardEventInit) => {
    const event = new KeyboardEvent("keydown", { key: ",", cancelable: true, ...init });
    window.dispatchEvent(event);
    return event;
  };
  expect(press({}).defaultPrevented).toBe(false);
  expect(press(apple ? { metaKey: true } : { ctrlKey: true }).defaultPrevented).toBe(true);
  expect(settings).toHaveBeenCalledTimes(1);
});
