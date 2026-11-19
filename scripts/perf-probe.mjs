// Runs inside the benchmark page. It observes the renderer without adding app hooks.
export function installProbe({ gpuTiming }) {
  let sample;
  let frame;
  let pendingQuery;
  let gpu;
  let eyeZ = null;
  let renderCount = 0;
  const contexts = new WeakSet();
  const matrices = new WeakSet();
  const nativeRAF = window.requestAnimationFrame.bind(window);
  const now = () => performance.now();
  function heartbeat(time) {
    if (sample) sample.raf.push(time);
    nativeRAF(heartbeat);
  }
  nativeRAF(heartbeat);

  window.addEventListener("scroll", () => sample?.scroll.push([now(), window.scrollY]), { passive: true });
  window.addEventListener("wheel", () => sample?.wheel.push(now()), { passive: true });
  if (PerformanceObserver.supportedEntryTypes.includes("longtask")) {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (sample && entry.startTime >= sample.start) sample.longTasks.push([entry.startTime, entry.duration]);
      }
    }).observe({ type: "longtask" });
  }

  const originalContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...options) {
    const context = originalContext.call(this, type, ...options);
    if (type === "webgl2" && context && this.closest(".exhibit-world")) {
      contexts.add(context);
      if (gpuTiming && !gpu) {
        const extension = context.getExtension("EXT_disjoint_timer_query_webgl2");
        if (extension) gpu = { context, extension };
      }
    }
    return context;
  };

  function instrument(method, wrapped) {
    const proto = WebGL2RenderingContext.prototype;
    const original = proto[method];
    proto[method] = function (...args) {
      if (!contexts.has(this)) return original.apply(this, args);
      return wrapped.call(this, original, args);
    };
  }

  instrument("getUniformLocation", function (native, args) {
    const uniform = native.apply(this, args);
    if (uniform && args[1] === "viewMatrix") matrices.add(uniform);
    return uniform;
  });
  instrument("uniformMatrix4fv", function (native, args) {
    const matrix = args[2];
    if (matrices.has(args[0]) && matrix.length === 16) {
      eyeZ = -(matrix[8] * matrix[12] + matrix[9] * matrix[13] + matrix[10] * matrix[14]);
    }
    return native.apply(this, args);
  });
  for (const method of ["drawElements", "drawArrays", "drawElementsInstanced", "drawArraysInstanced"]) {
    instrument(method, function (native, args) {
      if (sample && frame) {
        if (!frame.draws) {
          frame.dpr = this.drawingBufferWidth / window.innerWidth;
          if (gpu?.context === this && !pendingQuery && renderCount % 24 === 0) {
            frame.query = this.createQuery();
            this.beginQuery(gpu.extension.TIME_ELAPSED_EXT, frame.query);
          }
        }
        frame.draws++;
        const count = args[method.includes("Elements") ? 1 : 2];
        if (args[0] === this.TRIANGLES) frame.triangles += count / 3 * (method.endsWith("Instanced") ? args.at(-1) : 1);
      }
      return native.apply(this, args);
    });
  }
  for (const method of ["compileShader", "linkProgram", "getProgramParameter", "texImage2D", "texSubImage2D", "texStorage2D", "generateMipmap"]) {
    instrument(method, function (native, args) {
      if (!sample) return native.apply(this, args);
      const start = now();
      const result = native.apply(this, args);
      const duration = now() - start;
      const metric = sample.gl[method] ??= { count: 0, max: 0, total: 0 };
      metric.count++;
      metric.max = Math.max(metric.max, duration);
      metric.total += duration;
      return result;
    });
  }

  window.requestAnimationFrame = (callback) => nativeRAF((timestamp) => {
    if (!sample) return callback(timestamp);
    const current = { timestamp, start: now(), draws: 0, triangles: 0 };
    frame = current;
    try {
      return callback(timestamp);
    } finally {
      frame = undefined;
      if (pendingQuery && gpu) {
        const { context, extension } = gpu;
        if (context.getQueryParameter(pendingQuery, context.QUERY_RESULT_AVAILABLE)) {
          if (!context.getParameter(extension.GPU_DISJOINT_EXT)) {
            sample.gpu.push(context.getQueryParameter(pendingQuery, context.QUERY_RESULT) / 1e6);
          }
          context.deleteQuery(pendingQuery);
          pendingQuery = undefined;
        }
      }
      if (current.query && gpu) {
        gpu.context.endQuery(gpu.extension.TIME_ELAPSED_EXT);
        pendingQuery = current.query;
        delete current.query;
      }
      if (current.draws) {
        renderCount++;
        current.duration = now() - current.start;
        current.z = eyeZ;
        sample.frames.push(current);
      } else sample.otherRAF++;
    }
  });

  let rendererId = 0;
  let fiberStore;
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    inject: () => ++rendererId,
    onCommitFiberRoot(_id, root) {
      if (root.containerInfo?.getState?.()?.gl) fiberStore = root.containerInfo;
      if (sample) sample.reactCommits++;
    },
    onCommitFiberUnmount() {},
  };

  window.perfProbe = {
    begin() {
      sample = {
        start: now(), initialZ: eyeZ, scroll: [], wheel: [], frames: [], raf: [],
        longTasks: [], reactCommits: 0, otherRAF: 0, gl: {}, gpu: [],
      };
    },
    end() {
      const result = sample;
      sample = undefined;
      result.end = now();
      result.gpuSupported = Boolean(gpu);
      if (pendingQuery && gpu) gpu.context.deleteQuery(pendingQuery);
      pendingQuery = undefined;
      return result;
    },
    eye: () => eyeZ,
    setContinuous(enabled) {
      if (!fiberStore) return false;
      fiberStore.getState().setFrameloop(enabled ? "always" : "demand");
      return true;
    },
  };
}
