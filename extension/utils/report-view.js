// Report presentation: a small, pure model builder plus a DOM renderer shared
// by the popup and the in-page panel. The model is what the tests assert; the
// renderer only turns it into nodes, with textContent everywhere so a page
// cannot inject markup through a file name or a digest.
import { translate } from "./messages.js";

/**
 * Format a byte count with the reader's locale.
 * @param {number} bytes Byte count.
 * @param {string} lang Language code used for number and unit formatting.
 * @returns {string} Localized size, e.g. `12.3 kB` or `١٢٫٣ كيلوبايت`.
 */
export function formatBytes(bytes, lang) {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  let unit = "byte";
  let value = bytes;
  if (bytes >= 1024 * 1024) {
    unit = "megabyte";
    value = bytes / (1024 * 1024);
  } else if (bytes >= 1024) {
    unit = "kilobyte";
    value = bytes / 1024;
  }
  return new Intl.NumberFormat(lang, {
    style: "unit",
    unit,
    unitDisplay: "short",
    maximumFractionDigits: unit === "byte" ? 0 : 1,
  }).format(value);
}

/**
 * Turn a report row into `{label, value}` pairs.
 * @param {Record<string, string>|null|undefined} values Name-to-value map.
 * @returns {Array<{label: string, value: string}>} Rows in the map's order.
 */
function hashRows(values) {
  return Object.entries(values ?? {}).map(([label, value]) => ({
    label,
    value: String(value),
  }));
}

/**
 * Build the display model for one report.
 *
 * Everything user-visible is resolved here, so the renderer needs no access to
 * the language and the tests can assert the exact strings.
 * @param {object} report Report returned by `inspectImage()`.
 * @param {string} lang Language code.
 * @returns {{
 *   title: string,
 *   subtitle: string,
 *   meta: string[],
 *   sections: Array<{id: string, heading: string, rows: Array<{label: string, value: string}>}>,
 *   notices: Array<{kind: string, text: string}>,
 * }} Display model.
 */
export function buildReportModel(report, lang) {
  const say = (key) => translate(key, lang);
  const file = report.file ?? { name: "", size: 0, type: "" };
  const image = report.image ?? null;
  const c2pa = report.c2pa ?? { present: false };
  const notices = [];
  const meta = [];

  if (image && image.width && image.height) {
    meta.push(`${say("reportDimensions")}: ${image.width}×${image.height}`);
  }
  if (image && image.error) {
    notices.push({
      kind: "warning",
      text: `${say("reportDecodeFailed")}: ${image.error}`,
    });
  }

  const sections = [];
  const crypto = hashRows(report.hashes);
  if (crypto.length > 0) {
    sections.push({
      id: "crypto",
      heading: say("reportCryptographic"),
      rows: crypto,
    });
  } else {
    notices.push({ kind: "info", text: say("reportNoHashes") });
  }

  const perceptual = hashRows(report.perceptual_hashes);
  if (perceptual.length > 0) {
    sections.push({
      id: "perceptual",
      heading: say("reportPerceptual"),
      rows: perceptual,
    });
  }

  const c2paRows = [];
  if (c2pa.present) {
    c2paRows.push({
      label: say("reportStatus"),
      value: say("reportC2paPresent"),
    });
    const container = [c2pa.format, c2pa.chunk]
      .filter((part) => typeof part === "string" && part !== "")
      .map((part) => part.toUpperCase())
      .join(" ");
    const suffix =
      c2pa.standard === false ? ` (${say("reportC2paNonStandard")})` : "";
    if (container !== "") {
      c2paRows.push({
        label: say("reportFormat"),
        value: `${container}${suffix}`,
      });
    }
    if (Number.isFinite(c2pa.offset)) {
      c2paRows.push({ label: say("reportOffset"), value: String(c2pa.offset) });
    }
    if (Number.isFinite(c2pa.length)) {
      c2paRows.push({ label: say("reportLength"), value: String(c2pa.length) });
    }
  } else {
    c2paRows.push({
      label: say("reportStatus"),
      value: say("reportC2paAbsent"),
    });
  }
  sections.push({ id: "c2pa", heading: say("reportC2pa"), rows: c2paRows });

  const type = typeof file.type === "string" ? file.type : "";
  const size = formatBytes(file.size, lang);
  const subtitle = type === "" ? size : `${size} · ${type}`;

  return {
    title: typeof file.name === "string" && file.name !== "" ? file.name : "—",
    subtitle,
    meta,
    sections,
    notices,
  };
}

/**
 * Replace a container's children with a rendered report.
 * @param {HTMLElement} container Element to render into.
 * @param {ReturnType<typeof buildReportModel>} model Model from
 *   `buildReportModel`.
 * @returns {void}
 */
export function renderReport(container, model) {
  container.replaceChildren();

  const header = document.createElement("header");
  header.className = "redosan-report__header";
  const title = document.createElement("p");
  title.className = "redosan-report__title";
  title.textContent = model.title;
  const subtitle = document.createElement("p");
  subtitle.className = "redosan-report__subtitle";
  subtitle.textContent = [model.subtitle, ...model.meta]
    .filter((part) => part !== "")
    .join(" · ");
  header.append(title, subtitle);
  container.append(header);

  for (const notice of model.notices) {
    container.append(renderNotice(notice.kind, notice.text));
  }

  for (const section of model.sections) {
    const element = document.createElement("section");
    element.className = "redosan-report__section";
    element.dataset.section = section.id;

    const heading = document.createElement("h2");
    heading.className = "redosan-report__heading";
    heading.textContent = section.heading;

    const list = document.createElement("dl");
    list.className = "redosan-report__list";
    for (const row of section.rows) {
      const term = document.createElement("dt");
      term.textContent = row.label;
      const value = document.createElement("dd");
      const code = document.createElement("code");
      code.textContent = row.value;
      value.append(code);
      list.append(term, value);
    }

    element.append(heading, list);
    container.append(element);
  }
}

/**
 * Render a standalone notice.
 * @param {string} kind `info`, `warning`, `error` or `success`.
 * @param {string} text Already-localized text.
 * @returns {HTMLParagraphElement} Notice element.
 */
export function renderNotice(kind, text) {
  const notice = document.createElement("p");
  notice.className = `redosan-report__notice redosan-report__notice--${kind}`;
  notice.textContent = text;
  return notice;
}
