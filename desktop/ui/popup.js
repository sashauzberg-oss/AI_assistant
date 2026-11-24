// The answer bubble shown next to a snip. Its content is rendered by the Nova window
// (already HTML-escaped by Nova's Markdown renderer) and forwarded here.
const $ = (id) => document.getElementById(id);
let plainText = "";

// The pet (sent as image frames by the Nova window): talks while answering, blinks when idle.
let frames = null;
let talking = false;
let tick = 0;
setInterval(() => {
  if (!frames) return;
  tick++;
  const img = $("pet");
  if (talking) img.src = tick % 3 ? frames.talk : frames.normal;
  else img.src = tick % 40 === 0 ? frames.blink : frames.normal;
}, 120);

function fit() {
  requestAnimationFrame(() => {
    const header = document.querySelector("header").offsetHeight;
    window.popup.resize(Math.ceil(header + $("card").getBoundingClientRect().height) + 30); // + the pixel frame and rounding
  });
}

const STATUS = { answer: "Reading your snip…", text: "Copying the text…", translate: "Translating…", explain: "Taking a look…" };

window.popup.onInit(({ thumb, hotkey, mode }) => {
  $("status-text").textContent = STATUS[mode] || STATUS.answer;
  $("thumb").hidden = !thumb;
  if (thumb) {
    $("thumb").onload = fit;
    $("thumb").src = thumb;
  }
  $("footer").textContent = `Snip again anytime: ${hotkey}`;
  fit();
});

window.popup.onUpdate((update) => {
  if (update.pet) {
    frames = update.pet.frames;
    $("pet").src = frames.normal;
    $("pet-name").textContent = update.pet.name.toUpperCase();
  }
  if (update.text) talking = true;
  if (update.status !== undefined) {
    $("status").hidden = !update.status;
    $("status-text").textContent = update.status || "";
  }
  if (update.html !== undefined) {
    $("answer").innerHTML = update.html;
    if (update.html) $("status").hidden = true;
  }
  if (update.text !== undefined) plainText = update.text;
  if (update.copied) {
    $("copied").hidden = false;
  }
  if (update.error) {
    $("error").hidden = false;
    $("error").textContent = update.error;
  }
  if (update.done) {
    talking = false;
    document.body.classList.remove("working");
    $("status").hidden = true;
    $("copy").hidden = !plainText;
  }
  fit();
});

$("close").addEventListener("click", () => window.popup.close());
$("open").addEventListener("click", () => window.popup.openNova());
$("copy").addEventListener("click", () => {
  window.popup.copy(plainText);
  $("copy").textContent = "Copied";
  setTimeout(() => ($("copy").textContent = "Copy"), 1500);
});
document.addEventListener("click", (e) => {
  const link = e.target.closest("a[href]");
  if (link) {
    e.preventDefault();
    window.popup.openLink(link.href);
    return;
  }
  const copyCode = e.target.closest(".copy-code");
  if (copyCode) window.popup.copy(copyCode.previousElementSibling.textContent);
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") window.popup.close();
});
