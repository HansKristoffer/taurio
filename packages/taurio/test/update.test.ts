import { beforeEach, expect, mock, test } from "bun:test";

import { checkForUpdate, watchForUpdates } from "../src/runtime/update.js";
import { fakeUpdate, tauri } from "./setup.js";

beforeEach(() => {
  tauri.check.mockReset();
  tauri.relaunch.mockReset();
  tauri.relaunch.mockImplementation(async () => {});
});

test("concurrent checks share one request", async () => {
  const { promise, resolve } = Promise.withResolvers<ReturnType<typeof fakeUpdate> | null>();
  tauri.check.mockImplementation(() => promise);
  const a = checkForUpdate();
  const b = checkForUpdate();
  resolve(fakeUpdate("2.0.0"));
  expect((await a)?.version).toBe("2.0.0");
  expect(await b).toBe(await a);
  expect(tauri.check).toHaveBeenCalledTimes(1);
  // Settled, so the next check asks again.
  tauri.check.mockImplementation(async () => null);
  expect(await checkForUpdate()).toBeNull();
  expect(tauri.check).toHaveBeenCalledTimes(2);
});

test("install runs once at a time, relaunches, and can be retried after failing", async () => {
  let fail = true;
  const raw = fakeUpdate("2.0.0", async () => {
    await Bun.sleep(5);
    if (fail) throw new Error("download failed");
  });
  tauri.check.mockImplementation(async () => raw);
  const update = (await checkForUpdate())!;

  const first = update.install();
  const second = update.install();
  await expect(first).rejects.toThrow("download failed");
  await expect(second).rejects.toThrow("download failed");
  expect(raw.downloadAndInstall).toHaveBeenCalledTimes(1);
  expect(tauri.relaunch).not.toHaveBeenCalled();

  fail = false;
  await update.install();
  expect(raw.downloadAndInstall).toHaveBeenCalledTimes(2);
  expect(tauri.relaunch).toHaveBeenCalledTimes(1);
});

test("the watcher checks on start and on its interval, and reports nothing once stopped", async () => {
  tauri.check.mockImplementation(async () => fakeUpdate("2.0.0"));
  const found = mock();
  const stop = watchForUpdates(found, { interval: 10 });
  await Bun.sleep(25);
  stop();
  const calls = found.mock.calls.length;
  expect(calls).toBeGreaterThanOrEqual(2);
  await Bun.sleep(25);
  expect(found.mock.calls.length).toBe(calls);
});

test("a check still running when the watcher stops is dropped, as is its failure", async () => {
  const { promise, resolve } = Promise.withResolvers<ReturnType<typeof fakeUpdate> | null>();
  tauri.check.mockImplementation(() => promise);
  const found = mock();
  const onError = mock();
  watchForUpdates(found, { onError })();
  resolve(fakeUpdate("2.0.0"));
  await promise;
  await Bun.sleep(0);
  expect(found).not.toHaveBeenCalled();

  tauri.check.mockImplementation(async () => {
    throw new Error("offline");
  });
  const stop = watchForUpdates(found, { onError });
  await Bun.sleep(0);
  stop();
  expect(onError).toHaveBeenCalledTimes(1);
  expect(found).not.toHaveBeenCalled();
});
