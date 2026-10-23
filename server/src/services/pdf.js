// PDF generation (pdfkit). Renders titled sections of label/value rows and simple tables.
const PDFDocument = require('pdfkit');

const BRAND = '#21496B';

const human = (key) => String(key)
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (c) => c.toUpperCase());

const fmt = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  if (Array.isArray(v)) return v.map(fmt).join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return String(v);
};

/**
 * @param {object} doc  { title, subtitle, sections: [{ heading, rows?: [[label, value]], table?: { columns:[], rows:[[]] }, text? }] }
 * @returns {Promise<Buffer>}
 */
function render({ title, subtitle, sections = [] }) {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
    const chunks = [];
    pdf.on('data', (c) => chunks.push(c));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);

    pdf.fillColor(BRAND).fontSize(18).font('Helvetica-Bold').text(title || 'Report');
    if (subtitle) pdf.moveDown(0.2).fillColor('#555').fontSize(10).font('Helvetica').text(subtitle);
    pdf.moveDown(0.5).strokeColor(BRAND).lineWidth(1).moveTo(40, pdf.y).lineTo(555, pdf.y).stroke();

    const pageWidth = 515;
    for (const s of sections) {
      if (pdf.y > 720) pdf.addPage();
      pdf.moveDown(0.8).fillColor(BRAND).fontSize(13).font('Helvetica-Bold').text(s.heading || '');
      pdf.moveDown(0.3);
      if (s.text) pdf.fillColor('#222').fontSize(10).font('Helvetica').text(s.text, { width: pageWidth });
      for (const [label, value] of s.rows || []) {
        if (pdf.y > 760) pdf.addPage();
        const y = pdf.y;
        pdf.fillColor('#555').fontSize(9.5).font('Helvetica-Bold').text(label, 40, y, { width: 190 });
        const h1 = pdf.y;
        pdf.fillColor('#111').font('Helvetica').text(fmt(value), 240, y, { width: pageWidth - 200 });
        pdf.y = Math.max(h1, pdf.y) + 3;
        pdf.x = 40;
      }
      if (s.table && s.table.rows?.length) {
        const cols = s.table.columns;
        const w = pageWidth / cols.length;
        const drawRow = (cells, bold) => {
          if (pdf.y > 760) pdf.addPage();
          const y = pdf.y;
          let maxY = y;
          cells.forEach((c, i) => {
            pdf.fillColor(bold ? '#fff' : '#111').fontSize(8.5).font(bold ? 'Helvetica-Bold' : 'Helvetica');
            if (bold) pdf.rect(40 + i * w, y - 2, w, 14).fill(BRAND).fillColor('#fff');
            pdf.text(fmt(c), 42 + i * w, y, { width: w - 4 });
            maxY = Math.max(maxY, pdf.y);
          });
          pdf.y = maxY + 3; pdf.x = 40;
        };
        drawRow(cols, true);
        s.table.rows.forEach((r) => drawRow(r, false));
      }
    }
    const range = pdf.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      pdf.switchToPage(i);
      pdf.fillColor('#999').fontSize(8).text(`M3M One · Page ${i + 1} of ${range.count} · Generated ${new Date().toLocaleString('en-GB')}`, 40, 810, { width: pageWidth, align: 'center' });
    }
    pdf.end();
  });
}

// Turn an arbitrary JSON chapter blob into PDF sections (objects → label/value rows, arrays of objects → tables)
function sectionsFromData(heading, data) {
  if (data === null || data === undefined) return [{ heading, text: 'No data entered yet.' }];
  if (Array.isArray(data)) {
    if (data.length && typeof data[0] === 'object') {
      const cols = [...new Set(data.flatMap((r) => Object.keys(r || {})))].filter((c) => !/^(id|_id|grid)$/i.test(c)).slice(0, 7);
      return [{ heading, table: { columns: cols.map(human), rows: data.map((r) => cols.map((c) => (typeof r[c] === 'object' ? fmt(r[c]) : r[c]))) } }];
    }
    return [{ heading, rows: [['Values', data]] }];
  }
  if (typeof data !== 'object') return [{ heading, rows: [['Value', data]] }];
  const rows = []; const nested = [];
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object' && (Array.isArray(v) ? v.length && typeof v[0] === 'object' : Object.keys(v).length > 3)) nested.push(...sectionsFromData(`${heading} — ${human(k)}`, v));
    else rows.push([human(k), v]);
  }
  return [{ heading, rows }, ...nested];
}

module.exports = { render, sectionsFromData, human, fmt };
