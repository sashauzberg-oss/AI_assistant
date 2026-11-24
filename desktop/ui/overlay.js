// The snip overlay: the frozen screenshot fills the screen and the user drags a box.
const shot = document.getElementById("shot");
const sel = document.getElementById("sel");
const size = document.getElementById("size");
let start = null;
let box = null;

window.overlay.onImage((dataUrl) => {
  shot.onload = () => requestAnimationFrame(() => window.overlay.ready());
  shot.src = dataUrl;
});

function draw() {
  Object.assign(sel.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.width}px`, height: `${box.height}px` });
  size.textContent = `${Math.round(box.width)} × ${Math.round(box.height)}`;
  const below = box.y + box.height + 26 < window.innerHeight;
  Object.assign(size.style, { left: `${box.x}px`, top: `${below ? box.y + box.height + 6 : Math.max(4, box.y - 24)}px` });
}

window.addEventListener("pointerdown", (e) => {
  if (e.button === 2) return window.overlay.result(null); // right-click cancels
  if (e.button !== 0) return;
  start = { x: e.clientX, y: e.clientY };
  box = { x: start.x, y: start.y, width: 0, height: 0 };
  document.body.classList.add("selecting");
  draw();
});

window.addEventListener("pointermove", (e) => {
  if (!start) return;
  box = {
    x: Math.min(start.x, e.clientX),
    y: Math.min(start.y, e.clientY),
    width: Math.abs(e.clientX - start.x),
    height: Math.abs(e.clientY - start.y),
  };
  draw();
});

window.addEventListener("pointerup", () => {
  if (!start) return;
  start = null;
  if (box.width < 6 || box.height < 6) {
    document.body.classList.remove("selecting");
    return;
  }
  window.overlay.result(box);
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") window.overlay.result(null);
  else if (e.key === "Enter") window.overlay.result("full");
});
window.addEventListener("contextmenu", (e) => e.preventDefault());
