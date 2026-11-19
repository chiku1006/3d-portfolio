# Portfolio WebGL performance

`npm run build` produces the static production site used by the benchmark. Run `npm run perf` to exercise desktop, high-DPI, and mobile-emulated Chromium three times each. Run `npm run perf -- --smoke` for the browser regression suite. The Windows defaults use installed Edge for Chromium and Playwright WebKit for the mobile smoke test.

```sh
npm run perf -- --profile=high-dpi,software --runs=2 --label=local --trace
npm run perf -- --profile=desktop,mobile,reduced --runs=1 --label=layouts
npm run perf -- --profile=high-dpi --runs=1 --label=gpu --gpu
```

Reports and optional Chromium traces live in the ignored `artifacts/perf/` directory. `--root` accepts another static production export, so the same browser and scroll scripts can be used for A/B comparisons. `--continuous` forces the benchmark page’s React Three Fiber store to render continuously as an experiment. The application has no benchmark flags or instrumentation.

The suite records browser RAF intervals alongside callbacks that actually submit WebGL draws. Its camera samples are reconstructed from the submitted view matrix. Scroll-to-draw latency starts at the native scroll event and ends at the first measurable depth change sent to WebGL. Display scanout, compositor buffering, and physical input latency are outside that number. The JSON reports include raw camera and scroll timestamps, draw calls, triangles, effective resolution changes, long tasks, React commits, and CPU-side durations of shader and texture API calls. Use Chrome DevTools to analyze the optional traces. GPU timing is opt-in and reports available, non-disjoint draw samples only. Software WebGL uses SwiftShader, which is a stress case on the host CPU and differs from actual integrated graphics.

## Runtime

The exhibition reads native scroll events and caches section geometry. A bounded, frame-rate-independent camera response follows that input once. The camera path interpolates chapter poses with continuous tangents and retains clearance around project screens. A chapter is selected from the rendered camera progress in the fixed 3D layout. React updates when the chapter changes.

React Three Fiber still owns RAF and scene resources. The camera runs before scene callbacks, then the frame coordinator submits WebGL and schedules continuation during travel. Idle ambience keeps its separate low-rate cadence, static stations stop submitting work, and modal playback can pause submissions. The always-rendering prototype kept the old camera delay and increased idle draws from about 24 to 147 in the same window.

The planet lookup stores the existing procedural cloud and band inputs before lighting. Regenerate the texture with `node scripts/bake-planet-surface.mjs`. Rotation, lighting, rim shading, and rings are still calculated in world space. Planet meshes share reusable geometry tiers. Decoded texture uploads are staged one at a time when the camera settles. Where parallel compilation is available, shader programs are also prepared during that window. Adaptive resolution uses measured cadence and queues changes for a settled camera, with hysteresis between changes.

## Release measurements

Baseline `40a4ea3` and the candidate ran two repetitions each with the same high-DPI Chromium setup and wheel scenarios. The table pools rendered callback intervals during visible camera travel. Software WebGL runs used SwiftShader on the same PC.

| Profile | Baseline median / P95 / P99 | Candidate median / P95 / P99 |
| --- | --- | --- |
| RTX 4060, high DPI | 5.6 / 11.1 / 16.5 ms | 5.6 / 11.2 / 17.0 ms |
| SwiftShader | 20.0 / 97.3 / 187.2 ms | 21.9 / 97.3 / 195.8 ms |

On the RTX, the slow wheel scenario went from 161–178 ms between native scroll and the first measurable camera draw to movement on the first available rendered update. The baseline trace measured software poster-upload calls as high as 65.5 ms during warmup. Candidate posters were uploaded before that traversal. Warmup timing excludes work completed earlier in startup.

The candidate passed browser regression tests. Reduced tails were not demonstrated across the repeated runs, so the production release was withheld. The software trace still shows long Chromium swap, raster, and compositor waits. The GPU query probe ran separately from the frame-time comparison to keep instrumentation comparable.
