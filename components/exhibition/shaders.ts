export const worldVertex = /* glsl */ `
  varying vec3 vWorld;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
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

export const floorFragment = /* glsl */ `
  varying vec3 vWorld;

  float grid(vec2 point) {
    vec2 width = max(fwidth(point), vec2(0.0001));
    vec2 tile = abs(fract(point - 0.5) - 0.5) / width;
    return 1.0 - clamp(min(tile.x, tile.y), 0.0, 1.0);
  }
  void main() {
    float distanceToEye = length(vWorld - cameraPosition);
    float haze = exp(-distanceToEye * 0.043);
    float axis = exp(-abs(vWorld.x) * 0.18);
    float lines = grid(vWorld.xz * 0.35) * 0.58 + grid(vWorld.xz * 0.07) * 0.42;
    float lanes = exp(-abs(abs(vWorld.x) - 8.7) * 5.0);
    vec3 base = vec3(0.0015, 0.0021, 0.0047);
    vec3 light = vec3(0.009, 0.036, 0.066) * haze * (lines * 0.9 + axis * 0.8 + lanes * 1.05);
    gl_FragColor = vec4(base + light, 1.0);
    #include <colorspace_fragment>
  }
`;

export const auraFragment = /* glsl */ `
  uniform vec3 uTint;
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vec2 local = (vUv - 0.5) * 2.0;
    float light = pow(max(0.0, 1.0 - length(local)), 2.25);
    float visibility = exp(-length(vWorld - cameraPosition) * 0.018);
    gl_FragColor = vec4(uTint, light * visibility * 0.45);
    #include <colorspace_fragment>
  }
`;
