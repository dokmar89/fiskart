import { classRegistry, Path } from "fabric";
import { deviceOverlaySvg, renderDeviceOverlay } from "@/lib/device-overlay";
import { isFrameShape } from "@/lib/frames";

/** An empty device frame keeps its bezel and controls visible before a photo is dropped. */
export class DeviceFrame extends Path {
  static type = "DeviceFrame";

  override _render(ctx: CanvasRenderingContext2D): void {
    super._render(ctx);
    if (isFrameShape(this.frame)) renderDeviceOverlay(ctx, this.frame, this.width, this.height);
  }

  override _toSVG(): string[] {
    return [...super._toSVG(), isFrameShape(this.frame) ? deviceOverlaySvg(this.frame, this.width, this.height) : ""];
  }
}

classRegistry.setClass(DeviceFrame);
