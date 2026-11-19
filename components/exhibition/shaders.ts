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
  varying vec2 vUv;

  void main() {
    vec2 posterUv = (vUv - 0.5) * uPosterCrop + 0.5;
    vec3 colour = texture2D(uPoster, posterUv).rgb;
    if (uVideoMix > 0.001) {
      vec2 uv = (vUv - 0.5) * uVideoCrop + 0.5;
      vec2 stepUV = vec2(0.007) * uVideoCrop;
      vec3 moving = texture2D(uVideo, uv).rgb * 0.24;
      moving += texture2D(uVideo, uv + vec2(stepUV.x, 0.0)).rgb * 0.19;
      moving += texture2D(uVideo, uv - vec2(stepUV.x, 0.0)).rgb * 0.19;
      moving += texture2D(uVideo, uv + vec2(0.0, stepUV.y)).rgb * 0.19;
      moving += texture2D(uVideo, uv - vec2(0.0, stepUV.y)).rgb * 0.19;
      colour = mix(colour, moving * 0.68, uVideoMix);
    }
    float vignette = smoothstep(0.27, 0.75, length(vUv - 0.5));
    colour *= 1.0 - vignette * 0.22;
    gl_FragColor = vec4(colour, 1.0);
    #include <colorspace_fragment>
  }
`;

export const starsVertex = /* glsl */ `
  uniform float uDpr;
  uniform float uNearLayer;
  attribute vec2 aAppearance;
  varying float vBrightness;
  varying float vTint;

  void main() {
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * view;
    // Preserve the world-space projection of the distant shell at the far clip plane.
    gl_Position.z = mix(gl_Position.w, gl_Position.z, uNearLayer);
    float distanceToEye = -view.z;
    float fade = smoothstep(2.5, 8.0, distanceToEye) *
      (1.0 - smoothstep(42.0, 75.0, distanceToEye));
    float distanceScale = clamp(26.0 / max(distanceToEye, 8.0), 0.65, 2.2);
    vec2 screen = gl_Position.xy / max(gl_Position.w, 0.001);
    float edge = smoothstep(0.25, 0.95, max(abs(screen.x), abs(screen.y)));
    gl_PointSize = (1.33 + aAppearance.x * 1.2) * uDpr * mix(1.0, distanceScale, uNearLayer);
    vBrightness = (0.12 + aAppearance.x * 0.46) * mix(0.58, 1.0, edge) * mix(1.0, fade, uNearLayer);
    vTint = aAppearance.y;
  }
`;

export const starsFragment = /* glsl */ `
  varying float vBrightness;
  varying float vTint;

  void main() {
    float falloff = 1.0 - smoothstep(0.03, 0.5, length(gl_PointCoord - 0.5));
    vec3 colour = mix(vec3(0.23, 0.4, 0.65), vec3(0.65, 0.56, 0.53), vTint);
    gl_FragColor = vec4(colour, vBrightness * falloff);
    #include <colorspace_fragment>
  }
`;

export const planetVertex = /* glsl */ `
  varying vec3 vSurface;
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vSurface = normal;
    vNormal = mat3(modelMatrix) * normal;
    vView = cameraPosition - world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
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
    vec3 cell = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(cell), hash(cell + vec3(1,0,0)), f.x),
          mix(hash(cell + vec3(0,1,0)), hash(cell + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(cell + vec3(0,0,1)), hash(cell + vec3(1,0,1)), f.x),
          mix(hash(cell + vec3(0,1,1)), hash(cell + vec3(1,1,1)), f.x), f.y), f.z);
  }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 surface = normalize(vSurface);
    float sunlight = dot(n, uSun);
    float day = smoothstep(-0.24, 0.88, sunlight);
    float facing = max(dot(n, normalize(vView)), 0.0);
    float shape = noise(surface * 4.3 + 12.0);
    float detail = noise(surface * 12.0 + shape * 2.5);
    float grain = noise(surface * 37.0 + detail * 1.7);
    float clouds = smoothstep(0.39, 0.7, shape * 0.6 + detail * 0.3 + grain * 0.16);
    float bands = 0.5 + 0.5 * sin(surface.y * 31.0 + shape * 4.6 + detail * 0.8);
    float surfaceLight = mix(0.12 + clouds * 0.72, 0.28 + bands * 0.38 + detail * 0.27, uBands);
    float rim = pow(1.0 - facing, 3.6) * (0.07 + 0.72 * smoothstep(-0.45, 0.83, sunlight));
    vec3 colour = uNight + uDay * day * surfaceLight + uRim * rim;
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
    float lit = smoothstep(-0.6, 0.7, dot(n, uSun));
    float glow = pow(smoothstep(0.01, 0.33, edge), 2.3) * (0.018 + lit * 0.20);
    gl_FragColor = vec4(uRim, glow * uPresence);
    #include <colorspace_fragment>
  }
`;

export const ringsVertex = /* glsl */ `
  varying vec3 vLocal;

  void main() {
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const ringsFragment = /* glsl */ `
  uniform vec3 uRing;
  uniform float uPresence;
  varying vec3 vLocal;

  void main() {
    float r = length(vLocal.xy);
    float edge = smoothstep(1.22, 1.31, r) * (1.0 - smoothstep(1.77, 1.98, r));
    float division = mix(0.09, 1.0, smoothstep(0.012, 0.036, abs(r - 1.62)));
    float fine = mix(0.65, 0.65 + 0.35 * sin(r * 95.0), 1.0 - smoothstep(0.009, 0.035, fwidth(r)));
    float light = smoothstep(-0.95, 1.0, dot(normalize(vLocal.xy), vec2(-0.8, 0.6)));
    gl_FragColor = vec4(uRing, uPresence * edge * division * fine * (0.14 + light * 0.43));
    #include <colorspace_fragment>
  }
`;
