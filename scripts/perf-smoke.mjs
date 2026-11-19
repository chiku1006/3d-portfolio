import assert from "node:assert/strict";
import path from "node:path";
import { chromium, devices, webkit } from "playwright";
import { expect } from "@playwright/test";
import { installProbe } from "./perf-probe.mjs";

const world = (page) => page.locator(".exhibition");
const canvas = (page) => page.locator(".exhibit-world canvas");
const button = (page) => page.locator(".exhibit-mode");
const active = (page, id) => expect(page.locator("[data-stop][data-active]")).toHaveAttribute("id", id, { timeout: 10000 });
const ready = (page) => expect(world(page)).toHaveAttribute("data-world", "true", { timeout: 18000 });
const nav = (page, label) => page.locator(".exhibit-nav").getByRole("link", { name: label, exact: true });
const stopAt = (page, id) => page.locator("#" + id).evaluate((item) => item.scrollIntoView({ behavior: "instant" }));
const clip = (page) => page.getByRole("dialog").locator("video").first();

async function verifyVideo(video, portrait) {
  await expect.poll(() => video.evaluate((element) => element.readyState)).toBeGreaterThanOrEqual(2);
  if (portrait) assert.ok(await video.evaluate((element) => element.videoHeight > element.videoWidth));
  await video.evaluate((element) => element.play());
  await expect.poll(() => video.evaluate((element) => element.currentTime)).toBeGreaterThan(0.15);
}

export async function smokeTest(url, directory, snapshots) {
  const browser = await chromium.launch({
    channel: process.env.PERF_CHANNEL || (process.platform === "win32" ? "msedge" : undefined),
    args: process.platform === "win32" ? ["--enable-gpu", "--use-angle=d3d11"] : [],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(installProbe, { gpuTiming: false });
    await page.addInitScript(() => {
      const make = document.createElement;
      window.previewVideos = [];
      document.createElement = function (tag, options) {
        const item = make.call(this, tag, options);
        if (tag.toLowerCase() === "video") window.previewVideos.push(item);
        return item;
      };
    });
    await page.goto(url + "#home");
    await ready(page);
    await active(page, "home");
    await page.locator("body").dispatchEvent("pointerdown");
    if (snapshots) {
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(directory, snapshots + "-hero.png") });
    }
    await page.evaluate(() => window.perfProbe.begin());
    await nav(page, "My Work").click();
    await active(page, "work");
    await page.waitForTimeout(620);
    const travel = await page.evaluate(() => window.perfProbe.end());
    assert.ok(travel.frames.length > 6);
    const z = travel.frames.map(({ z }) => z).filter(Number.isFinite);
    assert.ok(z.length > 6 && z.at(-1) < z[0]);
    assert.ok(z.slice(1).every((value, i) => value <= z[i] + 0.04), "Forward camera path must remain monotone in depth");
    if (snapshots) await page.screenshot({ path: path.join(directory, snapshots + "-flow.png") });

    await page.evaluate(() => window.perfProbe.begin());
    await page.waitForTimeout(460);
    assert.equal((await page.evaluate(() => window.perfProbe.end())).frames.length, 0);

    await page.mouse.move(980, 428);
    await expect(canvas(page)).toHaveClass(/is-interactive/);
    await expect.poll(() => page.evaluate(() => window.previewVideos.some((v) =>
      !v.isConnected && v.muted && !v.paused && v.currentTime > 0.12))).toBe(true);
    await page.mouse.move(25, 260);
    await expect.poll(() => page.evaluate(() => window.previewVideos.filter((v) => !v.isConnected)
      .every((v) => v.paused && !v.hasAttribute("src")))).toBe(true);

    await page.locator('#work .media-copy a[aria-haspopup="dialog"]').click();
    await verifyVideo(clip(page), false);
    await page.evaluate(() => window.perfProbe.begin());
    await page.waitForTimeout(450);
    assert.equal((await page.evaluate(() => window.perfProbe.end())).frames.length, 0);
    await page.keyboard.press("Escape");

    const picker = page.locator("#work select");
    await expect(picker.locator("option")).toHaveCount(6);
    await picker.selectOption({ index: 2 });
    const projectLink = new URL(page.url()).hash;
    assert.ok(projectLink && projectLink !== "#work");
    await page.reload();
    await ready(page);
    await active(page, "work");
    await expect(picker).toHaveJSProperty("selectedIndex", 2);

    await stopAt(page, "short-form");
    await active(page, "short-form");
    await page.locator('#short-form a[aria-haspopup="dialog"]').first().click();
    await verifyVideo(clip(page), true);
    await page.keyboard.press("Escape");
    await nav(page, "Info").click();
    await active(page, "info");
    await stopAt(page, "tools");
    await active(page, "tools");
    await expect(page.locator("#tools .suite-tools")).toBeVisible();
    await nav(page, "Hire Me").click();
    await active(page, "hire");
    await page.getByRole("button", { name: "Start a project" }).click();
    await expect(page.getByRole("dialog").locator("form")).toBeVisible();
    await page.keyboard.press("Escape");

    const hasLossExtension = await canvas(page).evaluate((element) => {
      window.contextTest = element.getContext("webgl2").getExtension("WEBGL_lose_context");
      window.contextTest?.loseContext();
      return Boolean(window.contextTest);
    });
    assert.ok(hasLossExtension, "WEBGL_lose_context is required for the recovery check");
    await expect(world(page)).not.toHaveAttribute("data-world", "true");
    await page.evaluate(() => window.contextTest.restoreContext());
    await ready(page);
    await active(page, "hire");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(canvas(page)).toHaveCount(0);
    await button(page).click();
    await ready(page);
    await nav(page, "Home").click();
    await active(page, "home");
    assert.deepEqual(errors, []);
    await page.close();
    console.log("PASS desktop journey, video decoding, deep links, modal idle, contact, recovery and reduced motion");

    const fallback = await browser.newPage();
    await fallback.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        return type === "webgl2" ? null : getContext.call(this, type, ...args);
      };
    });
    await fallback.goto(url + "#work");
    await expect(button(fallback)).toHaveText("3D view");
    await active(fallback, "work");
    await fallback.locator('#work .media-copy a[aria-haspopup="dialog"]').click();
    await expect(fallback.getByRole("dialog")).toBeVisible();
    await fallback.close();
    console.log("PASS WebGL-unavailable fallback");
  } finally {
    await browser.close();
  }

  const mobile = await webkit.launch({ timeout: 15000 });
  try {
    const page = await mobile.newPage(devices["iPhone 13"]);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(url + "#work");
    await ready(page);
    await active(page, "work");
    await nav(page, "Hire Me").click();
    await active(page, "hire");
    await nav(page, "My Work").click();
    await active(page, "work");
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(button(page)).toHaveText("3D view");
    await button(page).click();
    await ready(page);
    await expect(page.locator("#work .exhibit-poster")).toBeVisible();
    await page.setViewportSize({ width: 390, height: 760 });
    await expect(world(page)).toHaveAttribute("data-spatial", "true");
    await active(page, "work");
    assert.deepEqual(errors, []);
    console.log("PASS mobile WebKit tour, short viewport and orientation");
  } finally {
    await mobile.close();
  }
}
