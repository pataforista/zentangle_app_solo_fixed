export function renderSvgToString(doc) {
  const { wMm, hMm } = doc;

  const chunks = [];
  chunks.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${wMm}mm" height="${hMm}mm" viewBox="0 0 ${wMm} ${hMm}">`);
  chunks.push(`  <metadata>generator=${doc.meta.generator}; version=${doc.meta.version || '1.0'}; seed=${doc.meta.seed}</metadata>`);

  const defs = doc.defs || [];
  if (defs.length) {
    chunks.push('  <defs>');
    chunks.push(defs.join('\n'));
    chunks.push('  </defs>');
  }

  chunks.push(doc.body.join('\n'));
  chunks.push('</svg>');

  return chunks.join('\n');
}
