// A small, safe Markdown renderer: everything is HTML-escaped first, then a limited
// set of formatting is applied. Links are only created for http(s) URLs.
import { escapeHtml } from "./util.js";

const LINK_ATTRS = 'target="_blank" rel="noopener noreferrer"';

function inline(raw) {
  let text = escapeHtml(raw);
  const codes = [];
  text = text.replace(/`([^`\n]+)`/g, (_, code) => {
    codes.push(code);
    return `\u0000${codes.length - 1}\u0000`;
  });
  text = text.replace(
    /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_, label, url) => `<a href="${url}" ${LINK_ATTRS}>${label}</a>`,
  );
  text = text.replace(
    /(^|[\s(])(https?:\/\/[^\s<()]+[^\s<().,!?;:'"])/g,
    (_, pre, url) => `${pre}<a href="${url}" ${LINK_ATTRS}>${url}</a>`,
  );
  text = text
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_\n]+)__/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, "$1<em>$2</em>")
    .replace(/(^|[^_\w])_([^_\n]+)_(?!\w)/g, "$1<em>$2</em>")
    .replace(/~~([^~\n]+)~~/g, "<del>$1</del>");
  return text.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[Number(i)]}</code>`);
}

function splitRow(line) {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
}

export function renderMarkdown(source) {
  const lines = String(source || "").replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let paragraph = [];
  let list = null;

  const flushParagraph = () => {
    if (paragraph.length) out.push(`<p>${paragraph.map(inline).join("<br>")}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list) {
      const start = list.type === "ol" && list.start !== 1 ? ` start="${list.start}"` : "";
      out.push(`<${list.type}${start}>${list.items.map((item) => `<li>${inline(item)}</li>`).join("")}</${list.type}>`);
    }
    list = null;
  };
  const flush = () => {
    flushParagraph();
    flushList();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^\s*```/.test(line)) {
      flush();
      const code = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) code.push(lines[i++]);
      out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code><button class="copy-code" type="button">Copy</button></pre>`);
      continue;
    }
    if (/^\s*$/.test(line)) {
      flush();
      continue;
    }
    let m;
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
      flush();
      const level = Math.min(m[1].length + 1, 4);
      out.push(`<h${level}>${inline(m[2])}</h${level}>`);
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flush();
      out.push("<hr>");
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1] || "") && lines[i + 1].includes("-")) {
      flush();
      const head = splitRow(line);
      const rows = [];
      i += 2;
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(splitRow(lines[i++]));
      i--;
      out.push(
        `<div class="table-wrap"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${rows
          .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table></div>`,
      );
      continue;
    }
    if ((m = line.match(/^\s*[-*+•]\s+(.*)$/))) {
      flushParagraph();
      if (list?.type !== "ul") {
        flushList();
        list = { type: "ul", items: [] };
      }
      list.items.push(m[1]);
      continue;
    }
    if ((m = line.match(/^\s*(\d+)[.)]\s+(.*)$/))) {
      flushParagraph();
      if (list?.type !== "ol") {
        flushList();
        list = { type: "ol", start: Number(m[1]), items: [] };
      }
      list.items.push(m[2]);
      continue;
    }
    if ((m = line.match(/^\s*>\s?(.*)$/))) {
      flush();
      out.push(`<blockquote>${inline(m[1])}</blockquote>`);
      continue;
    }
    if (list && /^\s{2,}\S/.test(line)) {
      list.items[list.items.length - 1] += ` ${line.trim()}`;
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flush();
  return out.join("");
}

/** Plain text for speech: drops code blocks, links and formatting marks. */
export function toSpeech(source) {
  return String(source || "")
    .replace(/```[\s\S]*?(```|$)/g, " (code shown on screen) ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/^\s*\|.*$/gm, "")
    .replace(/[*_~`#>|]/g, "")
    .replace(/^\s*[-+•]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}
