// Serialization for the inspection report. The UI (B2) adds localized labels;
// these functions stay i18n-free so tests and "copy as JSON" share one shape.

/**
 * @param {object} report
 * @returns {string}
 */
export function reportToJson(report) {
  return JSON.stringify(report, null, 2);
}

/**
 * @param {object} report
 * @returns {string}
 */
export function reportToText(report) {
  const lines = [];
  const { file, hashes, perceptual_hashes: perceptual, c2pa, image } = report;

  lines.push(`${file.name} (${file.size} bytes)`);
  if (image && image.width && image.height) {
    lines.push(`Dimensions: ${image.width}x${image.height}`);
  }
  if (image && image.error) {
    lines.push(`Image decode failed: ${image.error}`);
  }

  lines.push("", "Cryptographic hashes");
  for (const [name, value] of Object.entries(hashes)) {
    lines.push(`${name}: ${value}`);
  }

  if (perceptual && Object.keys(perceptual).length > 0) {
    lines.push("", "Perceptual hashes");
    for (const [name, value] of Object.entries(perceptual)) {
      lines.push(`${name}: ${value}`);
    }
  }

  lines.push("", "C2PA");
  if (c2pa && c2pa.present) {
    const standard = c2pa.standard === false ? " (non-standard chunk)" : "";
    lines.push(`Manifest store found: ${c2pa.format}${standard}`);
    lines.push(`Offset: ${c2pa.offset}, length: ${c2pa.length}`);
  } else {
    lines.push("No manifest store found");
  }

  return lines.join("\n");
}
