import { mock } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Stand-ins for the Tauri plugins, which need a running app. */
export const tauri = {
  check: mock(async (): Promise<FakeUpdate | null> => null),
  relaunch: mock(async () => {}),
  ask: mock(async (_message: string, _options?: unknown) => true),
  native: true,
};
export type FakeUpdate = { version: string; downloadAndInstall: ReturnType<typeof mock> };
export const fakeUpdate = (version: string, install: () => Promise<void> = async () => {}): FakeUpdate => ({
  version,
  downloadAndInstall: mock(install),
});

mock.module("@tauri-apps/plugin-updater", () => ({ check: tauri.check }));
mock.module("@tauri-apps/plugin-process", () => ({ relaunch: tauri.relaunch }));
mock.module("@tauri-apps/api/app", () => ({ getVersion: async () => "1.2.3" }));
mock.module("@tauri-apps/api/core", () => ({ isTauri: () => tauri.native }));
mock.module("@tauri-apps/plugin-dialog", () => ({ ask: tauri.ask }));
