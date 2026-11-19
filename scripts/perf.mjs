import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, devices } from "playwright";
import { installProbe } from "./perf-probe.mjs";
import { smokeTest } from "./perf-smoke.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((value) => {
  const [name, ...rest] = value.replace(/^--/, "").split("=");
  return [name, rest.join("=") || true];
}));
const root = path.resolve(args.root || "out");
const profiles = String(args.profile || "desktop,high-dpi,mobile").split(",");
const repeats = Number(args.runs || 3);
const reportDir = path.resolve("artifacts/perf");
await mkdir(reportDir, { recursive: true });
await stat(path.join(root, "index.html"));

const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".webp": "image/webp", ".png": "image/png", ".mp4": "video/mp4", ".woff2": "font/woff2",
  ".ttf": "font/ttf", ".svg": "image/svg+xml", ".txt": "text/plain" };
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://127.0.0.1").pathname;
  const file = path.resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
  try {
    if (!file.startsWith(root + path.sep)) return response.writeHead(403).end();
    const { size } = await stat(file);
    const headers = { "Content-Type": mime[path.extname(file)] ?? "application/octet-stream",
      "Accept-Ranges": "bytes" };
    const range = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    const start = range ? Number(range[1]) : 0;
    const end = range?.[2] ? Math.min(size - 1, Number(range[2])) : size - 1;
    if (start > end) return response.writeHead(416, { "Content-Range": `bytes */${size}` }).end();
    if (range) headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
    response.writeHead(range ? 206 : 200, { ...headers, "Content-Length": end - start + 1 });
    createReadStream(file, { start, end }).pipe(response);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}/`;

const round = (value) => Math.round(value * 100) / 100;
const intervals = (values) => values.slice(1).map((value, i) => value - values[i]).filter((value) => value > 0);
function percentiles(values) {
  const ordered = values.slice().sort((a, b) => a - b);
  const at = (p) => ordered.length ? round(ordered[Math.floor((ordered.length - 1) * p)]) : null;
  return { median: at(0.5), p95: at(0.95), p99: at(0.99) };
}
function summarize(data, settledZ) {
  const actual = data.frames;
  const rendered = intervals(actual.map((frame) => frame.timestamp));
  const moving = actual.map((frame, i) => i > 0 && frame.z !== null && actual[i - 1].z !== null &&
    Math.abs(frame.z - actual[i - 1].z) > 0.025 ? i : 0).filter(Boolean);
  const motionFrames = moving.length ? actual.slice(moving[0] - 1, moving.at(-1) + 1) : [];
  const motionIntervals = intervals(motionFrames.map(({ start }) => start));
  const firstScroll = data.scroll[0]?.[0];
  const lastScroll = data.scroll.at(-1)?.[0];
  const firstCamera = actual.find((frame) => frame.z !== null && data.initialZ !== null &&
    frame.start >= firstScroll && Math.abs(frame.z - data.initialZ) > 0.025)?.start;
  const settled = actual.slice().reverse().find((frame) =>
    frame.start >= lastScroll && frame.z !== null && Math.abs(frame.z - settledZ) > 0.12);
  const steps = actual.slice(1).map((frame, i) => Math.abs(frame.z - actual[i].z));
  return {
    rafMs: percentiles(intervals(data.raf)), renderMs: percentiles(rendered),
    motionMs: percentiles(motionIntervals),
    motionFps: motionIntervals.length
      ? round(1000 * motionIntervals.length / motionIntervals.reduce((sum, value) => sum + value, 0)) : null,
    fps: rendered.length ? round(1000 * rendered.length / rendered.reduce((sum, value) => sum + value, 0)) : null,
    frames: actual.length, frameCallbackMs: percentiles(actual.map(({ duration }) => duration)),
    longTasks: data.longTasks, over33ms: rendered.filter((value) => value > 34).length,
    inputToScrollMs: firstScroll !== undefined && data.wheel.length ? round(firstScroll - data.wheel[0]) : null,
    scrollToCameraMs: firstCamera === undefined ? null : round(firstCamera - firstScroll),
    settleAfterScrollMs: settled ? round(settled.start - lastScroll) : null,
    stationaryBeforeMs: firstCamera === undefined ? null : round(firstCamera - data.start),
    cameraStep: percentiles(steps),
    cameraSamples: actual.map(({ start, z }) => [round(start - data.start), round(z)]),
    scrollSamples: data.scroll.map(([time, y]) => [round(time - data.start), y]),
    initialZ: data.initialZ, settledZ,
    commits: data.reactCommits, callbacksWithoutDraw: data.otherRAF,
    draws: percentiles(actual.map(({ draws }) => draws)),
    triangles: percentiles(actual.map(({ triangles }) => triangles)),
    dpr: [...new Set(actual.map(({ dpr }) => round(dpr)))],
    gpuMs: data.gpuSupported ? { ...percentiles(data.gpu), samples: data.gpu.length } : null,
    gl: data.gl,
  };
}
const wheelPlan = {
  slow: [[24, 67, 39]],
  fast: [[9, 540, 25]],
  reverse: [[11, -470, 26]],
  turnaround: [[5, 550, 26], [6, -500, 26], [5, 360, 26]],
  planets: [[7, 494, 45], [5, -315, 38]],
};

async function runProfile(profile) {
  const software = profile === "software";
  const mobile = profile === "mobile";
  const highDPI = profile !== "desktop";
  const args = software
    ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
    : process.platform === "win32" ? ["--enable-gpu", "--use-angle=d3d11"] : [];
  const browser = await chromium.launch({
    channel: process.env.PERF_CHANNEL || (process.platform === "win32" ? "msedge" : undefined),
    args,
  });
  const result = [];
  try {
    const page = await browser.newPage(mobile ? devices["iPhone 13"] : {
      viewport: { width: 1280, height: 800 }, deviceScaleFactor: highDPI ? 1.5 : 1,
      reducedMotion: profile === "reduced" ? "reduce" : "no-preference",
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.text().startsWith("[Portfolio 3D]")) errors.push(message.text());
    });
    await page.addInitScript(installProbe, { gpuTiming: Boolean(options.gpu) });
    const cdp = await page.context().newCDPSession(page);
    let trace, traceDone;
    if (options.trace) {
      trace = [];
      cdp.on("Tracing.dataCollected", ({ value }) => trace.push(...value));
      traceDone = new Promise((resolve) => cdp.once("Tracing.tracingComplete", resolve));
      await cdp.send("Tracing.start", {
        categories: "devtools.timeline,disabled-by-default-devtools.timeline.frame,cc,gpu",
        transferMode: "ReportEvents",
      });
    }
    await page.goto(url + "#home", { waitUntil: "domcontentloaded" });
    if (profile === "reduced") await page.getByRole("button", { name: "3D view", exact: true }).click();
    await page.locator('.exhibition[data-world="true"]').waitFor({ timeout: 20000 });
    await page.locator("body").dispatchEvent("pointerdown");
    await page.waitForTimeout(650);
    const move = (id) => page.locator("#" + id).evaluate((item) => item.scrollIntoView({ behavior: "instant" }));
    const capture = async (action) => {
      await page.evaluate(() => window.perfProbe.begin());
      await action();
      const data = await page.evaluate(() => window.perfProbe.end());
      return summarize(data, await page.evaluate(() => window.perfProbe.eye()));
    };
    if (options.continuous && !await page.evaluate(() => window.perfProbe.setContinuous(true))) {
      throw new Error("Could not locate the Fiber store for the continuous-loop prototype.");
    }
    const warmup = await capture(async () => {
      for (const id of ["work", "short-form", "info", "tools", "hire", "home"]) {
        await move(id);
        await page.waitForTimeout(700);
      }
    });
    for (let run = 0; run < repeats; run++) {
      const record = {};
      for (const name of ["idle-hero", ...Object.keys(wheelPlan)]) {
        await move(name === "reverse" ? "hire" : "home");
        await page.waitForTimeout(680);
        record[name] = await capture(async () => {
          for (const [count, deltaY, gap] of wheelPlan[name] ?? []) {
            for (let i = 0; i < count; i++) {
              await cdp.send("Input.dispatchMouseEvent", {
                type: "mouseWheel", x: 20, y: 260, deltaX: 0, deltaY,
              });
              await page.waitForTimeout(gap);
            }
          }
          await page.waitForTimeout(800);
        });
      }
      if (!mobile && run === 0 && profile !== "reduced") {
        await move("work");
        await page.waitForTimeout(800);
        record.hover = await capture(async () => {
          await page.mouse.move(900, 400);
          await page.waitForTimeout(700);
          await page.mouse.move(20, 330);
          await page.waitForTimeout(350);
        });
        await page.locator('#work .media-copy a[aria-haspopup="dialog"]').click();
        record.modal = await capture(async () => {
          await page.getByRole("dialog").waitFor();
          await page.waitForTimeout(800);
        });
        await page.keyboard.press("Escape");
      }
      result.push(record);
      const compact = Object.fromEntries(Object.entries(record).map(([name, stats]) => [
        name, { p95: stats.renderMs.p95, p99: stats.renderMs.p99, fps: stats.fps,
          latency: stats.scrollToCameraMs, dpr: stats.dpr },
      ]));
      console.log(profile, run + 1, JSON.stringify(compact));
    }
    if (trace) {
      await cdp.send("Tracing.end");
      await traceDone;
      await writeFile(path.join(reportDir, `${options.label || "latest"}-${profile}.trace.json`), JSON.stringify({ traceEvents: trace }));
    }
    return { profile, errors, warmup, runs: result };
  } finally {
    await browser.close();
  }
}

const options = args;
try {
  const report = [];
  if (args.smoke) {
    await smokeTest(url, reportDir, args.snapshots);
  } else {
    for (const profile of profiles) report.push(await runProfile(profile));
    await writeFile(path.join(reportDir, `${args.label || "latest"}.json`), JSON.stringify(report, null, 2));
    const rows = report.flatMap(({ profile, runs }) => runs.flatMap((scenes, i) =>
      Object.entries(scenes).map(([name, scene]) => {
        const frame = scene.motionMs.median === null ? scene.renderMs : scene.motionMs;
        return [profile, i + 1, name, frame.median, frame.p95, frame.p99, scene.motionFps ?? scene.fps,
          scene.scrollToCameraMs, scene.dpr.join(", "), scene.longTasks.length].map((value) => value ?? "—").join(" | ");
      }),
    ));
    await writeFile(path.join(reportDir, `${args.label || "latest"}.md`), [
      "# WebGL performance",
      "",
      "Frame times use the visible travel window when a camera moves. Otherwise they describe all draws in the scenario.",
      "",
      "| Profile | Run | Scenario | Median ms | P95 ms | P99 ms | FPS | Scroll to draw ms | DPR | Long tasks |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
      ...rows.map((row) => `| ${row} |`),
      "",
      ...report.flatMap(({ profile, errors }) => errors.map((error) => `- ${profile} browser error: ${error}`)),
      "",
    ].join("\n"));
    if (report.some(({ errors }) => errors.length)) process.exitCode = 1;
  }
} finally {
  server.close();
}
