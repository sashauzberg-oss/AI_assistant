// The answer bubble shown next to a snip. Its content is rendered by the Nova window
// (already HTML-escaped by Nova's Markdown renderer) and forwarded here.
const $ = (id) => document.getElementById(id);
let plainText = "";

function fit() {
  requestAnimationFrame(() => {
    const header = document.querySelector("header").offsetHeight;
    window.popup.resize(Math.ceil(header + $("card").getBoundingClientRect().height) + 6); // + borders and rounding
  });
}

window.popup.onInit(({ thumb, hotkey }) => {
  $("thumb").onload = fit;
  $("thumb").src = thumb;
  $("footer").textContent = `Snip again anytime: ${hotkey}`;
  fit();
});

window.popup.onUpdate((update) => {
  if (update.status !== undefined) {
    $("status").hidden = !update.status;
    $("status-text").textContent = update.status || "";
  }
  if (update.html !== undefined) {
    $("answer").innerHTML = update.html;
    if (update.html) $("status").hidden = true;
  }
  if (update.text !== undefined) plainText = update.text;
  if (update.error) {
    $("error").hidden = false;
    $("error").textContent = update.error;
  }
  if (update.done) {
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
