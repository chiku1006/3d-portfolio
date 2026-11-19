import type { Texture, WebGLRenderer } from "three";

export function createTexturePreparation() {
  const waiting = new Set<{ texture: Texture; ready: () => void }>();
  return {
    enqueue(texture: Texture, ready: () => void) {
      const item = { texture, ready };
      waiting.add(item);
      return () => { waiting.delete(item); };
    },
    prepareOne(renderer: WebGLRenderer) {
      const item = waiting.values().next().value;
      if (!item) return;
      waiting.delete(item);
      renderer.initTexture(item.texture);
      item.ready();
    },
    get pending() {
      return waiting.size > 0;
    },
  };
}

export type TexturePreparation = ReturnType<typeof createTexturePreparation>;
