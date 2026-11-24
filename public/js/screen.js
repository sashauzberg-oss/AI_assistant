// Nova's snipping tool. It captures a screen or window with the browser's screen-share
// picker, then lets the user drag a box around the part they want (like the Snipping Tool).
// "Linking" a screen keeps the share open, so later snips (even by voice) need no picker.
import { $, sleep } from "./util.js";

const MAX_SIDE = 2000;

function canvasToImage(canvas) {
  let { width, height } = canvas;
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  let source = canvas;
  if (scale < 1) {
    width = Math.round(width * scale);
    height = Math.round(height * scale);
    source = document.createElement("canvas");
    source.width = width;
    source.height = height;
    const ctx = source.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(canvas, 0, 0, width, height);
  }
  const dataUrl = source.toDataURL("image/jpeg", 0.9);
  return { dataUrl, mediaType: "image/jpeg", data: dataUrl.split(",")[1], width, height };
}

/** Converts a pasted, dropped or uploaded image file into the same format as a snip. */
export async function imageFromFile(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; // transparent PNGs become white, not black, as JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return canvasToImage(canvas);
}

export class ScreenSnipper extends EventTarget {
  constructor() {
    super();
    this.stream = null;
    this.video = document.createElement("video");
    this.video.muted = true;
    this.video.playsInline = true;
  }

  get supported() {
    return !!navigator.mediaDevices?.getDisplayMedia;
  }

  get linked() {
    return !!this.stream?.getVideoTracks().some((t) => t.readyState === "live");
  }

  /** Opens the browser's share picker. Must be called from a click or key press. */
  async link() {
    if (!this.supported) throw new Error("This browser can't capture the screen. Paste a screenshot with Ctrl+V instead.");
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 5, max: 15 } },
      audio: false,
      selfBrowserSurface: "exclude",
      surfaceSwitching: "include",
    });
    this.stream = stream;
    stream.getVideoTracks()[0].addEventListener("ended", () => {
      this.stream = null;
      this.dispatchEvent(new Event("change"));
    });
    this.video.srcObject = stream;
    await this.video.play().catch(() => {});
    this.dispatchEvent(new Event("change"));
  }

  unlink() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.dispatchEvent(new Event("change"));
  }

  async grabFrame() {
    const video = this.video;
    for (let i = 0; i < 40 && (video.readyState < 2 || !video.videoWidth); i++) await sleep(50);
    if (!video.videoWidth) throw new Error("The shared screen didn't send a picture.");
    await new Promise((resolve) => (video.requestVideoFrameCallback ? video.requestVideoFrameCallback(resolve) : setTimeout(resolve, 120)));
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    return canvas;
  }

  /**
   * Returns { dataUrl, mediaType, data, width, height } or null if the user cancelled.
   * interactive: show the crop overlay. Hands-free and background snips skip it.
   */
  async capture({ interactive = true } = {}) {
    let temporary = false;
    if (!this.linked) {
      await this.link();
      temporary = true;
      await sleep(250); // let the share picker disappear before grabbing the frame
    }
    let canvas;
    try {
      canvas = await this.grabFrame();
    } finally {
      if (temporary) this.unlink();
    }
    if (!interactive) return canvasToImage(canvas);
    const region = await selectRegion(canvas);
    if (region === null) return null;
    if (region === "full") return canvasToImage(canvas);
    const crop = document.createElement("canvas");
    crop.width = region.width;
    crop.height = region.height;
    crop.getContext("2d").drawImage(canvas, region.x, region.y, region.width, region.height, 0, 0, region.width, region.height);
    return canvasToImage(crop);
  }
}

/** Full-screen overlay for dragging a box. Resolves a region in image pixels, "full", or null. */
export function selectRegion(canvas) {
  const overlay = $("#snip");
  const img = $("#snip-img");
  const rect = $("#snip-rect");
  img.src = canvas.toDataURL("image/png");
  overlay.hidden = false;
  rect.hidden = true;

  return new Promise((resolve) => {
    let start = null;
    let box = null;

    const finish = (result) => {
      overlay.hidden = true;
      img.removeAttribute("src");
      img.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey, true);
      $("#snip-full").removeEventListener("click", onFull);
      $("#snip-cancel").removeEventListener("click", onCancel);
      resolve(result);
    };
    const clampToImage = (x, y) => {
      const b = img.getBoundingClientRect();
      return { x: Math.min(Math.max(x, b.left), b.right), y: Math.min(Math.max(y, b.top), b.bottom) };
    };
    const onDown = (e) => {
      e.preventDefault();
      start = clampToImage(e.clientX, e.clientY);
      box = { left: start.x, top: start.y, width: 0, height: 0 };
      Object.assign(rect.style, { left: `${start.x}px`, top: `${start.y}px`, width: "0px", height: "0px" });
      rect.hidden = false;
    };
    const onMove = (e) => {
      if (!start) return;
      const p = clampToImage(e.clientX, e.clientY);
      box = { left: Math.min(start.x, p.x), top: Math.min(start.y, p.y), width: Math.abs(p.x - start.x), height: Math.abs(p.y - start.y) };
      Object.assign(rect.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` });
    };
    const onUp = () => {
      if (!start) return;
      start = null;
      if (!box || box.width < 8 || box.height < 8) {
        rect.hidden = true;
        return;
      }
      const b = img.getBoundingClientRect();
      const sx = canvas.width / b.width;
      const sy = canvas.height / b.height;
      const x = Math.round((box.left - b.left) * sx);
      const y = Math.round((box.top - b.top) * sy);
      finish({
        x,
        y,
        width: Math.max(1, Math.min(canvas.width - x, Math.round(box.width * sx))),
        height: Math.max(1, Math.min(canvas.height - y, Math.round(box.height * sy))),
      });
    };
    const onKey = (e) => {
      if (e.key === "Escape" || e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        finish(e.key === "Enter" ? "full" : null);
      }
    };
    const onFull = () => finish("full");
    const onCancel = () => finish(null);

    img.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey, true);
    $("#snip-full").addEventListener("click", onFull);
    $("#snip-cancel").addEventListener("click", onCancel);
  });
}
