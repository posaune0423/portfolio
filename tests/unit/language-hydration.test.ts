import assert from "node:assert/strict";

import { afterEach, test } from "vite-plus/test";

import { useAppStore } from "../../src/lib/app-store";
import { translate } from "../../src/lib/i18n";

const originalWindow = globalThis.window;
const originalDocument = globalThis.document;
const originalLocalStorage = globalThis.localStorage;

function setGlobalValue(key: "window" | "document" | "localStorage", value: unknown) {
  Object.defineProperty(globalThis, key, {
    value,
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  setGlobalValue("window", originalWindow);
  setGlobalValue("document", originalDocument);
  setGlobalValue("localStorage", originalLocalStorage);
  useAppStore.setState({
    locale: "ja",
    soundEnabled: true,
    settingsHydrated: false,
  });
});

test("LanguageProvider keeps the first client render aligned with SSR even when english is stored", () => {
  setGlobalValue("window", undefined);
  setGlobalValue("document", undefined);
  setGlobalValue("localStorage", undefined);

  useAppStore.setState({
    locale: "ja",
    soundEnabled: true,
    settingsHydrated: false,
  });

  const serverLabel = translate(useAppStore.getState().locale, "browser.memoryCardWork");

  const storage = {
    getItem(key: string) {
      return key === "ps2-locale" ? "en" : null;
    },
    setItem() {},
    removeItem() {},
    clear() {},
    key() {
      return null;
    },
    length: 1,
  } satisfies Storage;

  setGlobalValue("window", { localStorage: storage });
  setGlobalValue("localStorage", storage);

  const clientFirstLabel = translate(useAppStore.getState().locale, "browser.memoryCardWork");

  assert.equal(serverLabel, "メモリーカード (work)");
  assert.equal(clientFirstLabel, serverLabel);

  useAppStore.getState().hydrateSettings();

  assert.equal(useAppStore.getState().locale, "en");
  assert.equal(translate(useAppStore.getState().locale, "browser.memoryCardWork"), "Memory Card (work)");
});
