// Turnier-Export: rendert den KO-Baum (inkl. Ergebnissen und – bei beendetem
// Turnier – dem Endstand) aus den Turnierdaten als SVG und bietet Download als
// PNG oder PDF. Bewusst ohne externe Abhängigkeiten:
//   PNG  – SVG → <img> → <canvas> → Blob
//   PDF  – Canvas → JPEG → minimales, selbst gebautes PDF (DCTDecode)

// ---- Geometrie & Farben -------------------------------------------------
const CARD_W = 210;
const ROW_H = 30;
const CARD_H = ROW_H * 2; // 60
const LEG_W = 32;
const COL_GAP = 66; // Platz für Verbindungslinien
const SLOT_H = 104; // vertikaler Slot je Erstrunden-Paarung
const MARGIN = 28;
const HEAD_H = 74;

const COL = {
  text: '#14181C',
  muted: '#5B6472',
  border: '#C9C6BC',
  line: '#7A8089',
  colBg: '#ECEAE1',
  paper: '#FFFFFF',
  dark: '#1C1F22',
  green: '#1E8A46',
  onDark: '#FFFFFF',
};
const MEDAL = ['#D4AF37', '#A8A8A8', '#CD7F32'];

// ---- Helfer -------------------------------------------------------------
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function fit(s, max) {
  s = String(s == null ? '' : s);
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/** Ergebnis/Sieger einer Paarung fürs Rendering ableiten. */
export function matchExportModel(m) {
  if (!m) return null;
  const lv = m.live || {};
  const res = m.result || {};
  const legs = (side) =>
    m.status === 'done'
      ? res[side]
        ? res[side].legs
        : null
      : m.status === 'playing'
      ? side === 'p1'
        ? lv.p1Legs
        : lv.p2Legs
      : null;
  let winner = 0;
  if (m.status === 'done' && m.winnerId) winner = m.winnerId === m.p1 ? 1 : m.winnerId === m.p2 ? 2 : 0;
  return {
    p1Name: m.p1Name || '—',
    p2Name: m.p2Name || '—',
    p1Legs: legs('p1'),
    p2Legs: legs('p2'),
    winner,
  };
}

// ---- SVG-Bausteine ------------------------------------------------------
function matchBox(x, y, mm) {
  const mid = y + ROW_H;
  const nameX = x + 8;
  const legCx = x + CARD_W - LEG_W / 2;
  const row = (ry, name, legs, isWinner, isLoser) => {
    const ty = ry + ROW_H / 2 + 4;
    const deco = isLoser ? ' text-decoration="line-through"' : '';
    const weight = isWinner ? 800 : 600;
    const opacity = isLoser ? 0.55 : 1;
    const legBg = isWinner ? COL.green : COL.dark;
    return `
      <rect x="${x + CARD_W - LEG_W}" y="${ry}" width="${LEG_W}" height="${ROW_H}" fill="${legBg}"/>
      <text x="${nameX}" y="${ty}" font-size="14" font-weight="${weight}" fill="${COL.text}" opacity="${opacity}"${deco}>${esc(
      fit(name, 20)
    )}</text>
      <text x="${legCx}" y="${ty}" font-size="14" font-weight="800" fill="${COL.onDark}" text-anchor="middle" font-family="monospace">${
      legs == null ? '' : legs
    }</text>`;
  };
  return `
    <g>
      <rect x="${x}" y="${y}" width="${CARD_W}" height="${CARD_H}" fill="${COL.paper}" stroke="${COL.border}" stroke-width="1"/>
      ${row(y, mm.p1Name, mm.p1Legs, mm.winner === 1, mm.winner === 2)}
      ${row(mid, mm.p2Name, mm.p2Legs, mm.winner === 2, mm.winner === 1)}
      <line x1="${x}" y1="${mid}" x2="${x + CARD_W}" y2="${mid}" stroke="${COL.border}" stroke-width="1"/>
    </g>`;
}

/**
 * Erwartet ein Modell:
 * { title, subtitle, date, rounds:[{name, matches:[matchModel]}], standings?:{title, places:[{name}], best:[str]} }
 * Gibt { svg, width, height } zurück.
 */
export function buildTournamentSvg(model) {
  const rounds = model.rounds || [];
  const nCols = rounds.length;
  // y-Zentren je Runde berechnen (klassische Baum-Ausrichtung).
  const centers = [];
  const first = rounds[0] ? rounds[0].matches.length : 0;
  centers[0] = [];
  for (let i = 0; i < first; i++) centers[0][i] = HEAD_H + MARGIN + SLOT_H / 2 + i * SLOT_H;
  for (let r = 1; r < nCols; r++) {
    centers[r] = [];
    const cnt = rounds[r].matches.length;
    for (let i = 0; i < cnt; i++) {
      const a = centers[r - 1][2 * i];
      const b = centers[r - 1][2 * i + 1];
      if (a != null && b != null) centers[r][i] = (a + b) / 2;
      else if (a != null) centers[r][i] = a;
      else centers[r][i] = HEAD_H + MARGIN + SLOT_H / 2 + i * SLOT_H;
    }
  }
  const colX = (r) => MARGIN + r * (CARD_W + COL_GAP);
  const width = colX(nCols - 1) + CARD_W + MARGIN;

  // Höhe/Breite bestimmen.
  let maxY = HEAD_H + MARGIN;
  centers.forEach((arr) => arr.forEach((c) => (maxY = Math.max(maxY, c + CARD_H / 2))));
  let bracketBottom = maxY + MARGIN;

  const parts = [];
  // Kopf
  parts.push(
    `<text x="${MARGIN}" y="34" font-size="24" font-weight="800" fill="${COL.text}">${esc(model.title || '')}</text>`
  );
  if (model.subtitle)
    parts.push(
      `<text x="${MARGIN}" y="56" font-size="14" fill="${COL.muted}">${esc(model.subtitle)}</text>`
    );
  if (model.date)
    parts.push(
      `<text x="${width - MARGIN}" y="56" font-size="12" fill="${COL.muted}" text-anchor="end">${esc(
        model.date
      )}</text>`
    );

  // Spalten-Hintergründe + Rundentitel
  rounds.forEach((rd, r) => {
    const x = colX(r) - 10;
    const w = CARD_W + 20;
    parts.push(
      `<rect x="${x}" y="${HEAD_H}" width="${w}" height="${bracketBottom - HEAD_H}" fill="${COL.colBg}" rx="4"/>`
    );
    parts.push(
      `<text x="${colX(r) + CARD_W / 2}" y="${HEAD_H + 22}" font-size="14" font-weight="800" fill="${
        COL.text
      }" text-anchor="middle" letter-spacing="1">${esc((rd.name || '').toUpperCase())}</text>`
    );
  });

  // Verbindungslinien (Elbows)
  for (let r = 0; r < nCols - 1; r++) {
    const midX = colX(r) + CARD_W + COL_GAP / 2;
    // Stubs von jeder Paarung nach rechts
    rounds[r].matches.forEach((_, i) => {
      const cy = centers[r][i];
      parts.push(
        `<line x1="${colX(r) + CARD_W}" y1="${cy}" x2="${midX}" y2="${cy}" stroke="${COL.line}" stroke-width="2"/>`
      );
    });
    // Vertikale Verbindung je Folge-Paarung + Eingang
    rounds[r + 1].matches.forEach((_, j) => {
      const a = centers[r][2 * j];
      const b = centers[r][2 * j + 1];
      const cyNext = centers[r + 1][j];
      if (a != null && b != null)
        parts.push(`<line x1="${midX}" y1="${a}" x2="${midX}" y2="${b}" stroke="${COL.line}" stroke-width="2"/>`);
      parts.push(
        `<line x1="${midX}" y1="${cyNext}" x2="${colX(r + 1)}" y2="${cyNext}" stroke="${COL.line}" stroke-width="2"/>`
      );
    });
  }

  // Paarungs-Karten
  rounds.forEach((rd, r) => {
    rd.matches.forEach((mm, i) => {
      const cy = centers[r][i];
      parts.push(matchBox(colX(r), cy - CARD_H / 2, mm));
    });
  });

  let totalH = bracketBottom;

  // Spiel um Platz 3 + Endstand unter dem Baum
  const blocks = [];
  if (model.third) blocks.push({ title: model.third.title, kind: 'match', match: model.third.match });
  if (model.standings) blocks.push({ title: model.standings.title, kind: 'stand', data: model.standings });

  blocks.forEach((blk) => {
    const by = totalH;
    parts.push(
      `<text x="${MARGIN}" y="${by + 22}" font-size="16" font-weight="800" fill="${COL.text}">${esc(
        (blk.title || '').toUpperCase()
      )}</text>`
    );
    if (blk.kind === 'match') {
      parts.push(matchBox(MARGIN, by + 34, blk.match));
      totalH = by + 34 + CARD_H + MARGIN;
    } else {
      const d = blk.data;
      let ly = by + 44;
      (d.places || []).forEach((p, i) => {
        parts.push(`<circle cx="${MARGIN + 8}" cy="${ly - 4}" r="8" fill="${MEDAL[i] || COL.muted}"/>`);
        parts.push(
          `<text x="${MARGIN + 4}" y="${ly}" font-size="12" font-weight="800" fill="${COL.dark}" text-anchor="middle">${
            i + 1
          }</text>`
        );
        parts.push(
          `<text x="${MARGIN + 24}" y="${ly}" font-size="15" font-weight="${i === 0 ? 800 : 600}" fill="${
            COL.text
          }">${esc(p.name)}</text>`
        );
        ly += 26;
      });
      (d.best || []).forEach((line) => {
        parts.push(`<text x="${MARGIN}" y="${ly}" font-size="13" fill="${COL.muted}">${esc(line)}</text>`);
        ly += 22;
      });
      totalH = ly + MARGIN;
    }
  });

  const height = Math.max(totalH, bracketBottom);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Arial, Helvetica, sans-serif">
    <rect x="0" y="0" width="${width}" height="${height}" fill="${COL.paper}"/>
    ${parts.join('\n')}
  </svg>`;
  return { svg, width, height };
}

// ---- Rasterung & Download ----------------------------------------------
function rasterize(svg, width, height, scale) {
  return new Promise((resolve, reject) => {
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas);
    };
    img.onerror = reject;
    img.src = url;
  });
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Minimales einseitiges PDF mit einem eingebetteten JPEG (DCTDecode). */
function pdfFromJpeg(jpegBin, imgW, imgH, pageW, pageH) {
  const offsets = [];
  let pdf = '%PDF-1.4\n';
  const add = (n, body) => {
    offsets[n] = pdf.length;
    pdf += `${n} 0 obj\n${body}\nendobj\n`;
  };
  add(1, '<</Type/Catalog/Pages 2 0 R>>');
  add(2, '<</Type/Pages/Kids[3 0 R]/Count 1>>');
  add(
    3,
    `<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${pageW} ${pageH}]/Resources<</XObject<</Im0 4 0 R>>>>/Contents 5 0 R>>`
  );
  offsets[4] = pdf.length;
  pdf += `4 0 obj\n<</Type/XObject/Subtype/Image/Width ${imgW}/Height ${imgH}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${jpegBin.length}>>\nstream\n`;
  pdf += jpegBin;
  pdf += `\nendstream\nendobj\n`;
  const content = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im0 Do Q`;
  offsets[5] = pdf.length;
  pdf += `5 0 obj\n<</Length ${content.length}>>\nstream\n${content}\nendstream\nendobj\n`;
  const xref = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n`;
  for (let i = 1; i <= 5; i++) pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  pdf += `trailer\n<</Size 6/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF`;
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return bytes;
}

// Generisch: beliebiges SVG (String) als PDF exportieren (dependency-frei).
export async function exportSvgAsPdf(svg, width, height, filename) {
  const canvas = await rasterize(svg, width, height, 2);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const jpegBin = atob(dataUrl.split(',')[1]);
  const bytes = pdfFromJpeg(jpegBin, canvas.width, canvas.height, width, height);
  triggerDownload(new Blob([bytes], { type: 'application/pdf' }), filename.endsWith('.pdf') ? filename : filename + '.pdf');
}

export async function exportTournamentPng(model, filename) {
  const { svg, width, height } = buildTournamentSvg(model);
  const canvas = await rasterize(svg, width, height, 2);
  await new Promise((resolve) =>
    canvas.toBlob((b) => {
      triggerDownload(b, (filename || 'turnierbaum') + '.png');
      resolve();
    }, 'image/png')
  );
}

export async function exportTournamentPdf(model, filename) {
  const { svg, width, height } = buildTournamentSvg(model);
  const canvas = await rasterize(svg, width, height, 2);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const b64 = dataUrl.split(',')[1];
  const jpegBin = atob(b64);
  const bytes = pdfFromJpeg(jpegBin, canvas.width, canvas.height, width, height);
  triggerDownload(new Blob([bytes], { type: 'application/pdf' }), (filename || 'turnierbaum') + '.pdf');
}
