export const spaceBackground = "#020307";

export const worldVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const screenFragment = /* glsl */ `
  uniform sampler2D uPoster;
  uniform sampler2D uVideo;
  uniform vec2 uPosterCrop;
  uniform vec2 uVideoCrop;
  uniform float uVideoMix;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    vec2 posterUv = (vUv - 0.5) * uPosterCrop + 0.5;
    vec3 colour = texture2D(uPoster, posterUv).rgb;
    float vignette = smoothstep(0.27, 0.75, length(vUv - 0.5));
    colour *= 1.0 - vignette * 0.22;
    if (uVideoMix > 0.001) {
      vec2 uv = (vUv - 0.5) * uVideoCrop + 0.5;
      vec3 moving = sRGBTransferEOTF(texture2D(uVideo, uv)).rgb;
      colour = mix(colour, moving, uVideoMix);
    }
    gl_FragColor = vec4(colour, uOpacity);
    #include <colorspace_fragment>
  }
`;

export const nebulaVertex = /* glsl */ `
  varying vec3 vSky;

  void main() {
    vSky = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position.z = gl_Position.w;
  }
`;

export const nebulaFragment = /* glsl */ `
  uniform vec3 uSpace;
  varying vec3 vSky;

  float hash(vec2 p) {
    vec3 h = fract(p.xyx * 0.1031);
    h += dot(h, h.yzx + 33.33);
    return fract((h.x + h.y) * h.z);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1, 0)), f.x),
      mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y
    );
  }

  void main() {
    vec3 dir = normalize(vSky);
    vec2 sky = dir.xy / max(0.40, -dir.z);
    vec2 p = vec2(sky.x + sky.y * 0.70, sky.y - sky.x * 0.27);
    float warp = noise(p * 5.0 + 8.4) - 0.5;
    float soft = exp(-pow((p.y - 0.21 + warp * 0.14) * 4.9, 2.0));
    float fibres = noise(p * vec2(5.0, 15.0) + warp * 1.7) * 0.63 +
      noise(p * vec2(12.0, 38.0)) * 0.37;
    float arc = soft * (0.36 + 0.64 * smoothstep(0.23, 0.8, fibres));
    float right = smoothstep(-0.48, 0.63, sky.x);
    float low = exp(-length((sky - vec2(-0.57, -0.44)) * vec2(2.7, 3.3)));
    vec3 violet = vec3(0.024, 0.012, 0.052);
    vec3 indigo = vec3(0.008, 0.023, 0.050);
    vec3 light = mix(violet, indigo, right) * arc * (0.26 + 0.68 * right);
    gl_FragColor = vec4(uSpace + light * 0.22 + low * vec3(0.0020, 0.0024, 0.0050), 1.0);
    #include <colorspace_fragment>
  }
`;

export const starsVertex = /* glsl */ `
  uniform float uDpr;
  uniform float uNearLayer;
  attribute vec2 aAppearance;
  varying float vBrightness;
  varying float vTint;
  varying float vGlint;

  void main() {
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * view;
    // The distant shell keeps its world-space projection at the far clip plane.
    gl_Position.z = mix(gl_Position.w, gl_Position.z, uNearLayer);
    float distanceToEye = -view.z;
    float fade = smoothstep(2.5, 8.0, distanceToEye) *
      (1.0 - smoothstep(46.0, 82.0, distanceToEye));
    float distanceScale = clamp(27.0 / max(distanceToEye, 8.0), 0.75, 2.35);
    vec2 screen = gl_Position.xy / max(gl_Position.w, 0.001);
    float edge = smoothstep(0.20, 0.95, max(abs(screen.x), abs(screen.y)));
    vGlint = smoothstep(0.94, 1.0, aAppearance.x) * (1.0 - uNearLayer);
    gl_PointSize = (1.48 + aAppearance.x * 1.52 + 4.2 * vGlint) * uDpr *
      mix(1.0, distanceScale, uNearLayer);
    vBrightness = (0.13 + aAppearance.x * 0.49) * mix(0.62, 1.0, edge) *
      mix(1.0, fade, uNearLayer);
    vTint = aAppearance.y;
  }
`;

export const starsFragment = /* glsl */ `
  varying float vBrightness;
  varying float vTint;
  varying float vGlint;

  void main() {
    vec2 p = abs(gl_PointCoord - 0.5);
    float r = length(p);
    float core = 1.0 - smoothstep(0.045, mix(0.47, 0.24, vGlint), r);
    float spokes = (1.0 - smoothstep(0.015, 0.09, min(p.x, p.y))) *
      (1.0 - smoothstep(0.08, 0.49, max(p.x, p.y)));
    vec3 icy = vec3(0.28, 0.49, 0.83);
    vec3 lilac = vec3(0.58, 0.38, 0.81);
    vec3 warm = vec3(0.78, 0.66, 0.54);
    vec3 colour = mix(mix(icy, lilac, smoothstep(0.12, 0.65, vTint)), warm, smoothstep(0.81, 1.0, vTint));
    gl_FragColor = vec4(colour, vBrightness * max(core, spokes * vGlint * 0.7));
    #include <colorspace_fragment>
  }
`;

export const planetVertex = /* glsl */ `
  varying vec3 vSurface;
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    vSurface = normal;
    vNormal = normalMatrix * normal;
    vView = -view.xyz;
    gl_Position = projectionMatrix * view;
  }
`;

export const planetFragment = /* glsl */ `
  uniform vec3 uNight;
  uniform vec3 uDay;
  uniform vec3 uRim;
  uniform vec3 uSun;
  uniform float uBands;
  uniform float uPresence;
  varying vec3 vSurface;
  varying vec3 vNormal;
  varying vec3 vView;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 p = normalize(vSurface);
    float facing = max(dot(n, normalize(vView)), 0.0);
    float sunlight = dot(n, mat3(viewMatrix) * uSun);
    float day = smoothstep(-0.27, 0.86, sunlight);
    float current = noise(p * 4.8 + 9.2);
    float detail = noise(p * vec3(12.0, 19.0, 12.0) + current * 3.8);
    float fine = noise(p * 49.0 + detail * 1.3);
    float veil = smoothstep(0.31, 0.82, current * 0.47 + detail * 0.39 + fine * 0.14);
    float streak = 0.5 + 0.5 * sin(p.y * 27.0 + current * 5.2 + detail);
    float pattern = mix(veil, veil * 0.42 + streak * 0.58, uBands);
    float rim = pow(1.0 - facing, 4.7) * (0.035 + 0.64 * smoothstep(-0.52, 0.87, sunlight));
    vec3 colour = uNight * 0.72 + uDay * day * (0.07 + pattern * 0.42) + uRim * rim * 0.65;
    gl_FragColor = vec4(colour, uPresence);
    #include <colorspace_fragment>
  }
`;

export const atmosphereFragment = /* glsl */ `
  uniform vec3 uRim;
  uniform vec3 uSun;
  uniform float uPresence;
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    vec3 n = normalize(vNormal);
    float edge = abs(dot(n, normalize(vView)));
    float lit = smoothstep(-0.72, 0.69, dot(n, mat3(viewMatrix) * uSun));
    float glow = pow(smoothstep(0.0, 0.34, edge), 2.85) * (0.015 + lit * 0.19);
    gl_FragColor = vec4(uRim, glow * uPresence);
    #include <colorspace_fragment>
  }
`;

export const ringInner = 1.21;
export const ringOuter = 2.10;

export const ringsVertex = /* glsl */ `
  varying vec3 vLocal;
  varying vec3 vWorld;

  void main() {
    vLocal = position;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const ringsFragment = /* glsl */ `
  uniform vec3 uRing;
  uniform vec3 uSun;
  uniform vec3 uCenter;
  uniform float uRadius;
  uniform float uPresence;
  varying vec3 vLocal;
  varying vec3 vWorld;

  void main() {
    float r = length(vLocal.xy);
    float t = (r - ${ringInner}) / (${ringOuter} - ${ringInner});
    vec3 toPlanet = (uCenter - vWorld) / uRadius;
    float sunward = dot(toPlanet, uSun);
    float rayDistance = length(toPlanet - uSun * sunward);
    float shadow = step(0.0, sunward) * (1.0 - smoothstep(0.86, 1.08, rayDistance));
    float softEdge = smoothstep(0.01, 0.15, t) * (1.0 - smoothstep(0.72, 1.0, t));
    float division = smoothstep(0.024, 0.062, abs(t - 0.54));
    float threads = mix(0.62, 0.62 + 0.38 * sin(t * 118.0), 1.0 - smoothstep(0.01, 0.055, fwidth(t)));
    float shine = 0.39 + 0.43 * smoothstep(-0.7, 0.85, dot(normalize(vLocal.xy), vec2(-0.82, 0.42)));
    vec3 colour = mix(uRing, vec3(0.30, 0.50, 0.83), t * 0.26);
    float alpha = softEdge * division * threads * shine * (1.0 - shadow * 0.81) * uPresence;
    gl_FragColor = vec4(colour, alpha);
    #include <colorspace_fragment>
  }
`;
