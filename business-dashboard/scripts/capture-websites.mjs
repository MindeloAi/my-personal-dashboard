// Captures a 1440x900 screenshot of every site in portfolio/websites/_data.ts and saves
// it as WebP in public/assets/websites/. Re-run after adding a site.
//
//   node scripts/capture-websites.mjs            (all sites)
//   node scripts/capture-websites.mjs goodwood-marine   (one site)
//
// Headless Chrome runs with its own throwaway profile, so it never touches the
// Chrome you have open. CHROME_PATH overrides the default install location.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { websites } from "../src/app/(site)/portfolio/websites/_data.ts";

const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = path.resolve(import.meta.dirname, "..", "public", "assets", "websites");
const only = process.argv[2];

mkdirSync(OUT, { recursive: true });

for (const site of websites.filter((s) => !only || s.slug === only)) {
  const profile = mkdtempSync(path.join(tmpdir(), "capture-"));
  const png = path.join(profile, "shot.png");
  try {
    execFileSync(CHROME, [
      "--headless=new",
      `--user-data-dir=${profile}`,
      "--hide-scrollbars",
      "--window-size=1440,900",
      "--virtual-time-budget=10000",
      `--screenshot=${png}`,
      site.url,
    ], { stdio: "ignore", timeout: 90_000 });
    if (!existsSync(png)) throw new Error(`Chrome wrote no screenshot for ${site.url}`);
    await sharp(png).resize(1200).webp({ quality: 78 }).toFile(path.join(OUT, `${site.slug}.webp`));
    console.log(`saved ${site.slug}.webp`);
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }
}
