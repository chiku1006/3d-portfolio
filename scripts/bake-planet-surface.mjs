import sharp from "sharp";

// Bake the planet shader's object-space detail into a linear RG lookup.
// R is the cloud veil and G is the latitude streak, before lighting.
const width = 512, height = 256;
const bytes = Buffer.alloc(width * height * 3);
const fract = (x) => x - Math.floor(x);
const mix = (a, b, t) => a + (b - a) * t;
const curve = (t) => t * t * (3 - 2 * t);

function hash(x, y, z) {
  x = fract(x * 0.3183099 + 0.1) * 17;
  y = fract(y * 0.3183099 + 0.2) * 17;
  z = fract(z * 0.3183099 + 0.3) * 17;
  return fract(x * y * z * (x + y + z));
}
function noise(x, y, z) {
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z);
  const s = curve(x - i), t = curve(y - j), u = curve(z - k);
  return mix(
    mix(mix(hash(i, j, k), hash(i + 1, j, k), s), mix(hash(i, j + 1, k), hash(i + 1, j + 1, k), s), t),
    mix(mix(hash(i, j, k + 1), hash(i + 1, j, k + 1), s), mix(hash(i, j + 1, k + 1), hash(i + 1, j + 1, k + 1), s), t),
    u,
  );
}
for (let row = 0; row < height; row++) {
  const theta = (row + 0.5) * Math.PI / height;
  const y = Math.cos(theta);
  const radius = Math.sin(theta);
  for (let col = 0; col < width; col++) {
    const phi = (col + 0.5) * Math.PI * 2 / width;
    const x = -Math.cos(phi) * radius, z = Math.sin(phi) * radius;
    const base = noise(x * 4.8 + 9.2, y * 4.8 + 9.2, z * 4.8 + 9.2);
    const detail = noise(x * 12 + base * 3.8, y * 19 + base * 3.8, z * 12 + base * 3.8);
    const fine = noise(x * 49 + detail * 1.3, y * 49 + detail * 1.3, z * 49 + detail * 1.3);
    const veil = curve(Math.min(1, Math.max(0, (base * 0.47 + detail * 0.39 + fine * 0.14 - 0.31) / 0.51)));
    const streak = 0.5 + 0.5 * Math.sin(y * 27 + base * 5.2 + detail);
    const index = (row * width + col) * 3;
    bytes[index] = Math.round(veil * 255);
    bytes[index + 1] = Math.round(streak * 255);
  }
}

await sharp(bytes, { raw: { width, height, channels: 3 } })
  .png()
  .toFile("public/textures/planet-surface.png");
