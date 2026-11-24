// The snip overlay: the frozen screenshot fills the screen and the user drags a box.
const shot = document.getElementById("shot");
const sel = document.getElementById("sel");
const size = document.getElementById("size");
let start = null;
let box = null;
let mode = "answer";

function setMode(next) {
  mode = next;
  for (const b of document.querySelectorAll("#modes button")) b.classList.toggle("on", b.dataset.mode === mode);
}
const hint = document.getElementById("hint");
hint.addEventListener("pointerdown", (e) => e.stopPropagation()); // clicks on the toolbar don't start a selection
hint.addEventListener("click", (e) => {
  const button = e.target.closest("button[data-mode]");
  if (button) setMode(button.dataset.mode);
});

window.overlay.onImage(({ dataUrl, mode: initialMode }) => {
  setMode(initialMode || "answer");
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
  window.overlay.result({ ...box, mode });
});

const MODE_KEYS = { 1: "answer", 2: "text", 3: "translate", 4: "explain", a: "answer", c: "text", t: "translate", e: "explain" };
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") window.overlay.result(null);
  else if (e.key === "Enter") window.overlay.result({ full: true, mode });
  else if (MODE_KEYS[e.key.toLowerCase()]) setMode(MODE_KEYS[e.key.toLowerCase()]);
});

window.addEventListener("contextmenu", (e) => e.preventDefault());
