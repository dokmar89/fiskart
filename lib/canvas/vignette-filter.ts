import { classRegistry, filters } from "fabric";
import { shadeVignette } from "@/lib/vignette";

/** Registered with Fabric so saved filter JSON hydrates in the editor and export player. */
export class Vignette extends filters.BaseFilter<"Vignette", { strength: number }> {
  declare strength: number;
  static type = "Vignette";
  static defaults = { strength: 0 };
  static uniformLocations = ["uStrength"];

  getFragmentSource() {
    return `precision highp float;
      uniform sampler2D uTexture;
      uniform float uStrength;
      varying vec2 vTexCoord;
      void main() {
        vec4 color = texture2D(uTexture, vTexCoord);
        vec2 p = (vTexCoord - 0.5) * 2.0;
        float edge = clamp((length(p) / 1.41421356 - 0.14) / 0.86, 0.0, 1.0);
        color.rgb *= 1.0 - uStrength * pow(edge, 1.7) * 0.75;
        gl_FragColor = color;
      }`;
  }

  applyTo2d(options: Parameters<filters.BaseFilter<string>["applyTo2d"]>[0]) {
    const { data, width, height } = options.imageData;
    shadeVignette(data, width, height, this.strength);
  }

  isNeutralState() { return this.strength <= 0; }

  sendUniformData(gl: WebGLRenderingContext, locations: Parameters<filters.BaseFilter<string>["sendUniformData"]>[1]) {
    gl.uniform1f(locations.uStrength, this.strength);
  }
}

classRegistry.setClass(Vignette);
