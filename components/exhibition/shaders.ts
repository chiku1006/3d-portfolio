export const spaceBackground = "#050812";

export const worldVertex = /* glsl */ `
  varying vec2 vUv;
  varying float vViewDepth;
  void main() {
    vUv = uv;
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    vViewDepth = -view.z;
    gl_Position = projectionMatrix * view;
  }
`;

export const screenFragment = /* glsl */ `
  uniform sampler2D uPoster;
  uniform sampler2D uVideo;
  uniform vec2 uPosterCrop;
  uniform vec2 uVideoCrop;
  uniform float uVideoMix;
  uniform vec3 uSpace;
  uniform float uFocus;
  varying vec2 vUv;
  varying float vViewDepth;

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
    float haze = (1.0 - uFocus) * smoothstep(29.0, 56.0, vViewDepth);
    gl_FragColor = vec4(mix(colour, uSpace, haze), 1.0);
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
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    vUv = uv;
    vNormal = normalMatrix * normal;
    vView = -view.xyz;
    gl_Position = projectionMatrix * view;
  }
`;

export const planetFragment = /* glsl */ `
  uniform sampler2D uSurface;
  uniform vec3 uRim;
  uniform vec3 uSun;
  uniform float uExposure;
  uniform float uPresence;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    vec3 n = normalize(vNormal);
    float facing = max(dot(n, normalize(vView)), 0.0);
    float sunlight = dot(n, mat3(viewMatrix) * uSun);
    float day = smoothstep(-0.11, 0.2, sunlight) * (0.44 + 0.56 * max(sunlight, 0.0));
    float rim = pow(1.0 - facing, 4.2) * (0.014 + 0.24 * smoothstep(-0.21, 0.81, sunlight));
    vec3 surface = texture2D(uSurface, vUv).rgb;
    vec3 colour = vec3(0.003, 0.005, 0.01) + surface * (0.012 + day * uExposure) + uRim * rim;
    gl_FragColor = vec4(colour, uPresence);
    #include <colorspace_fragment>
  }
`;

export const cloudsFragment = /* glsl */ `
  uniform sampler2D uClouds;
  uniform vec3 uSun;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    vec3 n = normalize(vNormal);
    float sunlight = dot(n, mat3(viewMatrix) * uSun);
    float day = smoothstep(-0.11, 0.53, sunlight);
    float facing = max(dot(n, normalize(vView)), 0.0);
    float cloud = texture2D(uClouds, vUv).r;
    float density = smoothstep(0.04, 0.67, cloud);
    vec3 colour = mix(vec3(0.02, 0.036, 0.06), vec3(0.44, 0.53, 0.62), day);
    gl_FragColor = vec4(colour, density * smoothstep(0.04, 0.27, facing) * (0.10 + day * 0.70));
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
    float lit = smoothstep(-0.6, 0.7, dot(n, mat3(viewMatrix) * uSun));
    float glow = pow(smoothstep(0.01, 0.3, edge), 2.3) * (0.015 + lit * 0.18);
    gl_FragColor = vec4(uRim, glow * uPresence);
    #include <colorspace_fragment>
  }
`;

export const saturnRingInner = 1.15;
export const saturnRingOuter = 2.23;

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
  uniform sampler2D uRingMap;
  uniform vec3 uSun;
  uniform vec3 uCenter;
  uniform float uRadius;
  uniform float uPresence;
  varying vec3 vLocal;
  varying vec3 vWorld;

  void main() {
    float r = length(vLocal.xy);
    float t = (r - ${saturnRingInner}) / (${saturnRingOuter} - ${saturnRingInner});
    vec4 map = texture2D(uRingMap, vec2(t, 0.5));
    vec3 toPlanet = (uCenter - vWorld) / uRadius;
    float sunward = dot(toPlanet, uSun);
    float rayDistance = length(toPlanet - uSun * sunward);
    float shadow = step(0.0, sunward) * (1.0 - smoothstep(0.88, 1.04, rayDistance));
    vec3 tint = mix(vec3(0.17, 0.145, 0.11), map.rgb, 0.76);
    float edge = smoothstep(0.0, 0.05, t) * (1.0 - smoothstep(0.92, 1.0, t));
    gl_FragColor = vec4(tint * (0.92 - shadow * 0.80), map.a * edge * uPresence);
    #include <colorspace_fragment>
  }
`;
