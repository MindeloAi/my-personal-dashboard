// Captures two screenshots of every site in portfolio/websites/_data.ts and saves
// them as WebP in public/assets/websites/:
//   <slug>.webp       the first screen at 1440x900, for the /portfolio/websites cards
//   <slug>-full.webp  the page from the top, up to four screens, for the /portfolio reel
// Re-run after adding a site.
//
//   node scripts/capture-websites.mjs                   (all sites)
//   node scripts/capture-websites.mjs goodwood-marine   (one site)
//
// Headless Chrome runs with its own throwaway profile and is driven over the
// DevTools protocol, so it never touches the Chrome you have open. The viewport
// stays 1440x900 and the full-page shot captures beyond it, so 100vh heroes keep
// their real height. CHROME_PATH overrides the default install location.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { websites } from "../src/app/(site)/portfolio/websites/_data.ts";

const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = path.resolve(import.meta.dirname, "..", "public", "assets", "websites");
const WIDTH = 1440;
const SCREEN = 900;
const MAX_HEIGHT = SCREEN * 4;
const only = process.argv[2];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Chrome writes its DevTools port and browser path to this file when started with port 0.
async function devtoolsUrl(profile) {
  const file = path.join(profile, "DevToolsActivePort");
  for (let i = 0; i < 100; i++) {
    if (existsSync(file)) {
      const [port, browserPath] = readFileSync(file, "utf8").split(/\r?\n/);
      if (port && browserPath) return `ws://127.0.0.1:${port}${browserPath}`;
    }
    await sleep(200);
  }
  throw new Error("Chrome did not open its DevTools port");
}

function connect(url) {
  const ws = new WebSocket(url);
  const waiting = new Map();
  let nextId = 0;
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    const pending = waiting.get(msg.id);
    if (!pending) return;
    waiting.delete(msg.id);
    if (msg.error) pending.reject(new Error(msg.error.message));
    else pending.resolve(msg.result);
  });
  const failAll = (reason) => {
    for (const pending of waiting.values()) pending.reject(new Error(reason));
    waiting.clear();
  };
  ws.addEventListener("close", () => failAll("DevTools connection closed"));
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      if (ws.readyState !== WebSocket.OPEN) return reject(new Error("DevTools connection closed"));
      const id = ++nextId;
      waiting.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  return new Promise((resolve, reject) => {
    ws.addEventListener("open", () => resolve({ send, close: () => ws.close() }));
    ws.addEventListener("error", () => {
      failAll("DevTools connection failed");
      reject(new Error(`Could not connect to ${url}`));
    });
  });
}

async function capture(send, site) {
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const call = (method, params) => send(method, params, sessionId);
  try {
    await call("Emulation.setDeviceMetricsOverride", { width: WIDTH, height: SCREEN, deviceScaleFactor: 1, mobile: false });
    const { errorText } = await call("Page.navigate", { url: site.url });
    if (errorText) throw new Error(`Could not load ${site.url}: ${errorText}`);
    await sleep(6000);
    // Some sites lock scrolling (overflow: hidden on the page, or one full-height
    // scrolling container). Unlock it so the page flows to its full height; the
    // viewport stays 1440x900, so 100vh heroes keep their real height.
    await call("Runtime.evaluate", {
      expression: `(() => {
        for (const el of [document.documentElement, document.body]) {
          el.style.setProperty("overflow", "visible", "important");
          el.style.setProperty("height", "auto", "important");
        }
        for (const el of document.querySelectorAll("body *")) {
          const cs = getComputedStyle(el);
          if (/(auto|scroll)/.test(cs.overflowY) && el.clientHeight >= innerHeight * 0.6 && el.scrollHeight > el.clientHeight + 200) {
            el.style.setProperty("height", "auto", "important");
            el.style.setProperty("max-height", "none", "important");
            el.style.setProperty("overflow", "visible", "important");
          }
        }
      })()`,
    });
    // Scroll through the page so lazy images and scroll-triggered sections render, then return to the top.
    await call("Runtime.evaluate", {
      awaitPromise: true,
      expression: `(async () => {
        for (let y = 0; y < Math.min(document.documentElement.scrollHeight, ${SCREEN * 20}); y += ${SCREEN / 2}) {
          scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 300));
        }
        scrollTo(0, 0);
        await Promise.race([
          Promise.all([...document.images].map((img) => img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }))),
          new Promise((r) => setTimeout(r, 10000)),
        ]);
        await new Promise((r) => setTimeout(r, 1500));
      })()`,
    });
    const { result } = await call("Runtime.evaluate", { expression: "document.documentElement.scrollHeight", returnByValue: true });
    const height = Math.min(result.value, MAX_HEIGHT);
    const shot = async (h) => {
      const { data } = await call("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: true,
        clip: { x: 0, y: 0, width: WIDTH, height: h, scale: 1 },
      });
      return Buffer.from(data, "base64");
    };
    await sharp(await shot(SCREEN)).resize(1200).webp({ quality: 78 }).toFile(path.join(OUT, `${site.slug}.webp`));
    await sharp(await shot(height)).resize(600).webp({ quality: 70 }).toFile(path.join(OUT, `${site.slug}-full.webp`));
  } finally {
    await send("Target.closeTarget", { targetId }).catch(() => {});
  }
}

mkdirSync(OUT, { recursive: true });
const profile = mkdtempSync(path.join(tmpdir(), "capture-"));
const chrome = spawn(CHROME, ["--headless=new", `--user-data-dir=${profile}`, "--remote-debugging-port=0", "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
const exited = new Promise((resolve) => chrome.once("exit", resolve));
try {
  const { send, close } = await connect(await devtoolsUrl(profile));
  try {
    for (const site of websites.filter((s) => !only || s.slug === only)) {
      await capture(send, site);
      console.log(`saved ${site.slug}.webp and ${site.slug}-full.webp`);
    }
  } finally {
    await send("Browser.close").catch(() => {});
    close();
  }
} finally {
  // Browser.close ends Chrome. Never kill it: if it is still running, say so and leave it.
  const ended = await Promise.race([exited.then(() => true), sleep(10_000).then(() => false)]);
  if (ended) rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  else console.warn(`Headless Chrome (pid ${chrome.pid}) did not exit; its profile is ${profile}`);
}
