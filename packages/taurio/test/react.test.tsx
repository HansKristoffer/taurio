import { beforeEach, expect, mock, test } from "bun:test";
import { act, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

import { AppShell, useAppShortcuts, useAppUpdate, useSecretEntry, type AppUpdate } from "../src/react/index.js";
import { fakeUpdate, tauri } from "./setup.js";

async function render(node: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<StrictMode>{node}</StrictMode>));
  return { container, unmount: () => act(async () => root.unmount()) };
}
const settle = (ms = 0) => act(() => Bun.sleep(ms));

beforeEach(() => {
  document.body.innerHTML = "";
  tauri.check.mockReset();
  tauri.check.mockImplementation(async () => null);
  tauri.relaunch.mockReset();
  tauri.relaunch.mockImplementation(async () => {});
});

/* ---------- updates ---------- */

let updater: AppUpdate;
function Updater(props: Parameters<typeof useAppUpdate>[0]) {
  updater = useAppUpdate(props);
  return null;
}

test("StrictMode's double mount neither doubles the check nor the offer", async () => {
  const raw = fakeUpdate("2.0.0");
  tauri.check.mockImplementation(async () => raw);
  await render(<Updater />);
  await settle();
  expect(tauri.check).toHaveBeenCalledTimes(1);
  expect(updater.update?.version).toBe("2.0.0");

  // Found again later: the update already on offer is kept, not replaced.
  const offered = updater.update;
  await act(async () => void (await updater.check()));
  expect(updater.update).toBe(offered);
});

test("a manual check reports its status and offers what it finds at once", async () => {
  await render(<Updater />);
  await settle();
  expect(updater.update).toBeNull();

  let pending!: Promise<unknown>;
  await act(async () => {
    pending = updater.check();
  });
  await act(async () => void (await pending));
  expect(updater.status).toBe("latest");

  tauri.check.mockImplementation(async () => {
    throw new Error("offline");
  });
  await act(async () => void (await updater.check()));
  expect(updater.status).toBe("failed");

  tauri.check.mockImplementation(async () => fakeUpdate("2.0.0"));
  await act(async () => void (await updater.check()));
  expect(updater.status).toBe("idle");
  expect(updater.update?.version).toBe("2.0.0");
});

test("install runs once at a time, and a failure keeps the offer for another try", async () => {
  const raw = fakeUpdate("2.0.0", async () => {
    await Bun.sleep(5);
    throw new Error("disk full");
  });
  tauri.check.mockImplementation(async () => raw);
  await render(<Updater />);
  await settle();

  const failures = mock();
  await act(async () => {
    void updater.install().catch(failures);
    void updater.install().catch(failures);
  });
  expect(updater.installing).toBe(true);
  await settle(20);
  expect(raw.downloadAndInstall).toHaveBeenCalledTimes(1);
  expect(failures).toHaveBeenCalledTimes(1);
  expect(tauri.relaunch).not.toHaveBeenCalled();
  expect(updater.installing).toBe(false);
  expect(updater.update?.version).toBe("2.0.0");
});

test("a disabled updater never checks", async () => {
  await render(<Updater enabled={false} />);
  await settle();
  expect(await updater.check()).toBeNull();
  expect(tauri.check).not.toHaveBeenCalled();
});

/* ---------- shell ---------- */

test("the shell drags by the sidebar and the card's top strip", async () => {
  const { container } = await render(
    <AppShell sidebar={<nav>nav</nav>} titlebar={<button>toggle</button>} collapsed>
      <p>content</p>
    </AppShell>,
  );
  expect(container.querySelector(".tau-app")?.getAttribute("data-tauri-drag-region")).toBe("true");
  expect(container.querySelector(".tau-sidebar.collapsed")?.getAttribute("data-tauri-drag-region")).toBe("deep");
  expect(container.querySelector(".tau-main > .tau-drag-strip")?.getAttribute("data-tauri-drag-region")).toBe("deep");
  expect(container.querySelector(".tau-titlebar button")?.textContent).toBe("toggle");
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

/* ---------- secret entry ---------- */

let secret: ReturnType<typeof useSecretEntry>;
function Secret(props: Parameters<typeof useSecretEntry>[0]) {
  secret = useSecretEntry(props);
  return null;
}

test("an empty secret asks for a value, verifies it and saves it trimmed", async () => {
  const save = mock(async (_value: string) => {});
  const onSaved = mock();
  await render(
    <Secret
      load={async () => false}
      save={save}
      onSaved={onSaved}
      verify={async (v) => (v === "bad" ? "That key was refused" : null)}
    />,
  );
  await settle();
  expect(secret.saved).toBe(false);
  expect(secret.showInput).toBe(true);
  expect(secret.canCancel).toBe(false);

  await act(async () => secret.setValue("bad"));
  await act(async () => secret.submit());
  expect(secret.error).toBe("That key was refused");
  expect(save).not.toHaveBeenCalled();
  await act(async () => secret.setValue("  good  "));
  expect(secret.error).toBe("");
  await act(async () => secret.submit());
  expect(save).toHaveBeenCalledWith("good");
  expect(onSaved).toHaveBeenCalledTimes(1);
  expect(secret.saved).toBe(true);
  expect(secret.showInput).toBe(false);
  expect(secret.value).toBe("");
});

test("a saved secret can be changed and the change cancelled; a failed load is shown", async () => {
  await render(<Secret load={async () => true} save={async () => {}} />);
  await settle();
  expect(secret.showInput).toBe(false);
  await act(async () => secret.edit());
  expect(secret.showInput).toBe(true);
  expect(secret.canCancel).toBe(true);
  await act(async () => secret.setValue("new"));
  await act(async () => secret.cancel());
  expect(secret.showInput).toBe(false);
  expect(secret.value).toBe("");

  await render(
    <Secret
      load={async () => {
        throw new Error("Keychain locked");
      }}
      save={async () => {}}
    />,
  );
  await settle();
  expect(secret.error).toBe("Keychain locked");
  expect(secret.showInput).toBe(true);
});
