// Clientseitiger PDF-Spielerbericht – dependency-frei (SVG -> Canvas -> JPEG -> PDF).
// Enthält: alle Kennzahlen, Checkout nach Rest-Bereich, Ø-Verlauf, persönliche
// Checkout-Tabelle (Abweichungen kursiv), beste Doppel und eine Feld×Pfeil-Matrix.
import { exportSvgAsPdf } from './tournamentExport';

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const BLUE = '#006EC7';
const GREEN = '#2E7D32';
const INK = '#1A1A1A';
const GREY = '#666';
const LINE = '#DDD';

const CO_KEYS = ['2-40', '41-70', '71-100', '101-170', 'pressure'];
const W = 794; // ~A4 @96dpi Breite

// Reihenfolge der Feld-Keys für die Matrix (nur Zeilen mit Treffern werden gezeigt).
function fieldRowOrder() {
  const rows = [];
  for (let n = 1; n <= 20; n++) {
    rows.push({ key: String(n), label: 'S' + n });
    rows.push({ key: 'D' + n, label: 'D' + n });
    rows.push({ key: 'T' + n, label: 'T' + n });
  }
  rows.push({ key: '25', label: 'Bull 25' });
  rows.push({ key: 'D25', label: 'Bull 50' });
  return rows;
}

export async function exportPlayerReport({
  player,
  stats,
  timeline = [],
  rangeLabel = '',
  t,
  lang = 'de',
  sectorsByDart = [],
  doubles = [],
  checkoutTable = null,
}) {
  const s = stats || {};
  const L = (de, en) => (lang === 'en' ? en : de);
  const T = (k, fallback) => (t ? t(k) : '') || fallback;
  const n2 = (v) => (Number(v) || 0).toFixed(2);
  const n0 = (v) => String(Math.round(Number(v) || 0));
  const pct = (v) => `${(Number(v) || 0).toFixed(1)} %`;

  const parts = [];
  let y = 40;
  const text = (x, yy, size, weight, fill, content, style) =>
    parts.push(
      `<text x="${x}" y="${yy}" font-family="Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}"${
        style ? ` font-style="${style}"` : ''
      }>${esc(content)}</text>`
    );
  const rect = (x, yy, w, h, fill, rx = 0) => parts.push(`<rect x="${x}" y="${yy}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"/>`);
  const hline = (yy) => parts.push(`<line x1="40" y1="${yy}" x2="${W - 40}" y2="${yy}" stroke="${LINE}" stroke-width="1"/>`);
  const sectionTitle = (title) => {
    y += 22;
    text(40, y, 16, 800, INK, title);
    y += 8;
    hline(y);
    y += 14;
  };

  // Kopf
  text(40, y, 28, 800, INK, T('stats.pdfReport', 'Bericht'));
  text(W - 40, y, 15, 400, GREY, rangeLabel || '');
  parts[parts.length - 1] = parts[parts.length - 1].replace('<text ', '<text text-anchor="end" ');
  y += 26;
  text(40, y, 20, 700, BLUE, player || '');
  y += 10;
  hline(y);

  // --- Alle Kennzahlen ---
  sectionTitle(T('stats.allStats', 'Alle Statistiken'));
  const metrics = [
    [L('Spiele', 'Games'), n0(s.games)],
    [L('Siege', 'Wins'), `${n0(s.wins)} (${(Number(s.winPct) || 0).toFixed(0)} %)`],
    ['Ø', n2(s.average)],
    [L('Erste 9 Ø', 'First-9 avg'), n2(s.first9Avg)],
    ['Checkout %', pct(s.checkoutPct)],
    [L('Doppelquote', 'Double %'), pct(s.doubleRatePct)],
    ['180', n0(s.s180)],
    ['140+', n0(s.s140)],
    ['100+', n0(s.s100)],
    ['60+', n0(s.s60)],
    [L('Höchste Aufnahme', 'Highest visit'), n0(s.maxTurn)],
    [L('Höchstes Checkout', 'Highest checkout'), n0(s.maxCheckout)],
    [L('Bestes Leg', 'Best leg'), s.minDarts ? n0(s.minDarts) : '–'],
    [L('Darts gesamt', 'Total darts'), n0(s.dartsTotal)],
  ];
  const cols = 4;
  const cw = (W - 80) / cols;
  metrics.forEach((m, i) => {
    const cx = 40 + (i % cols) * cw;
    const cy = y + Math.floor(i / cols) * 62;
    rect(cx, cy, cw - 10, 52, '#F4F1E8', 8);
    text(cx + 12, cy + 20, 11, 400, GREY, m[0]);
    text(cx + 12, cy + 42, 20, 800, INK, m[1]);
  });
  y += Math.ceil(metrics.length / cols) * 62 + 4;

  // --- Checkout nach Rest-Bereich ---
  const cr = s.checkoutRanges || {};
  if (CO_KEYS.some((k) => cr[k] && cr[k].attempts > 0)) {
    sectionTitle(T('stats.coRanges', 'Checkout nach Rest'));
    const barX = 190;
    const barW = W - 40 - barX;
    CO_KEYS.forEach((k) => {
      const e = cr[k] || { hits: 0, attempts: 0, pct: 0 };
      const label = k === 'pressure' ? T('stats.pressure', 'Unter Druck') : `Rest ${k}`;
      const p = Math.max(0, Math.min(100, e.pct || 0));
      text(40, y + 13, 12, k === 'pressure' ? 800 : 400, INK, label);
      rect(barX, y, barW, 15, '#ECECEC', 4);
      rect(barX, y, (barW * p) / 100, 15, k === 'pressure' ? BLUE : GREEN, 4);
      text(W - 40, y + 13, 11, 400, GREY, `${e.hits}/${e.attempts} · ${(e.pct || 0).toFixed(0)} %`);
      parts[parts.length - 1] = parts[parts.length - 1].replace('<text ', '<text text-anchor="end" ');
      y += 24;
    });
  }

  // --- Ø-Verlauf ---
  const tl = Array.isArray(timeline) ? timeline.filter((d) => d && d.average != null) : [];
  if (tl.length >= 2) {
    sectionTitle(T('stats.progressWeek', 'Ø-Verlauf'));
    const chartX = 40;
    const chartW = W - 80;
    const chartH = 130;
    rect(chartX, y, chartW, chartH, '#FAFAFA', 8);
    parts[parts.length - 1] = parts[parts.length - 1].replace('/>', ` stroke="${LINE}"/>`);
    const vals = tl.map((d) => d.average || 0);
    const max = Math.max(...vals, 1);
    const stepX = chartW / (tl.length - 1);
    const pts = vals.map((v, i) => `${chartX + i * stepX},${y + chartH - (v / max) * (chartH - 20) - 10}`).join(' ');
    parts.push(`<polyline points="${pts}" fill="none" stroke="${GREEN}" stroke-width="3"/>`);
    text(chartX + 8, y + 16, 11, 400, GREY, `Ø max ${max.toFixed(1)}`);
    y += chartH + 6;
  }

  // --- Beste Doppel (gemessen) ---
  if (Array.isArray(doubles) && doubles.length) {
    sectionTitle(T('stats.bestDoubles', 'Beste Doppel'));
    const top = doubles.slice(0, 10);
    const perRow = 2;
    const colW = (W - 80) / perRow;
    top.forEach((d, i) => {
      const cx = 40 + (i % perRow) * colW;
      const cy = y + Math.floor(i / perRow) * 22;
      text(cx, cy + 12, 12, 700, INK, d.label);
      text(cx + 70, cy + 12, 12, 400, GREY, `${(d.rate * 100).toFixed(0)} %  (${d.hits}/${d.attempts})`);
    });
    y += Math.ceil(top.length / perRow) * 22 + 4;
  }

  // --- Persönliche Checkout-Tabelle ---
  if (checkoutTable && Array.isArray(checkoutTable.rows) && checkoutTable.rows.length) {
    sectionTitle(T('stats.checkoutTable', 'Persönliche Checkout-Tabelle'));
    text(40, y, 10, 400, GREY, checkoutTable.hasProfile ? T('stats.checkoutHint', '') : T('stats.noProfile', ''));
    y += 16;
    const rows = checkoutTable.rows;
    const ncol = 3;
    const colW = (W - 80) / ncol;
    const perCol = Math.ceil(rows.length / ncol);
    const startY = y;
    let maxRowsY = 0;
    rows.forEach((r, i) => {
      const col = Math.floor(i / perCol);
      const rowInCol = i % perCol;
      const cx = 40 + col * colW;
      const cy = startY + rowInCol * 13 + 10;
      const route = (r.personal || r.standard || []).join(' ');
      text(cx, cy, 9, 700, INK, String(r.rest));
      text(cx + 26, cy, 9, r.deviates ? 800 : 400, r.deviates ? BLUE : INK, route);
      if (cy > maxRowsY) maxRowsY = cy;
    });
    y = maxRowsY + 8;
  }

  // --- Treffer-Heatmap (Dartboard) ---
  const heatDarts = Array.isArray(sectorsByDart) ? sectorsByDart : [];
  if (heatDarts.length) {
    const hv = {};
    let hbull = 0;
    for (const d of heatDarts)
      for (const [k, c] of Object.entries(d.sectors || {})) {
        if (k === '0') continue;
        const num = k[0] === 'D' || k[0] === 'T' ? parseInt(k.slice(1), 10) : parseInt(k, 10);
        if (num === 25) hbull += c;
        else if (num >= 1 && num <= 20) hv[num] = (hv[num] || 0) + c;
      }
    const hmax = Math.max(0, hbull, ...Object.values(hv));
    if (hmax > 0) {
      sectionTitle(T('stats.hitHeatmap', 'Treffer-Heatmap'));
      const cx = W / 2;
      const cy = y + 118;
      const R = 110;
      const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
      const polar = (r, deg) => { const a = ((deg - 90) * Math.PI) / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
      const wedge = (r0, r1, a0, a1) => {
        const [x0, y0] = polar(r1, a0), [x1, y1] = polar(r1, a1), [x2, y2] = polar(r0, a1), [x3, y3] = polar(r0, a0);
        return `M${x0} ${y0} A${r1} ${r1} 0 0 1 ${x1} ${y1} L${x2} ${y2} A${r0} ${r0} 0 0 0 ${x3} ${y3} Z`;
      };
      const fillFor = (v) => {
        if (!v) return '#F2F2F2';
        const tt = 0.15 + 0.85 * (v / hmax);
        const c = [242, 242, 242].map((x, i) => Math.round(x + ([46, 125, 50][i] - x) * tt));
        return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
      };
      ORDER.forEach((num, i) => {
        parts.push(`<path d="${wedge(30, R, i * 18 - 9, i * 18 + 9)}" fill="${fillFor(hv[num] || 0)}" stroke="#BBB" stroke-width="0.6"/>`);
      });
      parts.push(`<circle cx="${cx}" cy="${cy}" r="30" fill="${fillFor(hbull)}" stroke="#BBB" stroke-width="0.6"/>`);
      ORDER.forEach((num, i) => {
        const [lx, ly] = polar(70, i * 18);
        const v = hv[num] || 0;
        parts.push(`<text x="${lx}" y="${ly + 3}" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" font-weight="700" fill="#222">${num}${v ? '\u00B7' + v : ''}</text>`);
      });
      parts.push(`<text x="${cx}" y="${cy + 3}" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" font-weight="700" fill="#222">Bull${hbull ? '\u00B7' + hbull : ''}</text>`);
      y = cy + R + 20;
    }
  }

  // --- Feld × Pfeil ---
  const dartsCols = (Array.isArray(sectorsByDart) ? sectorsByDart : []).filter((d) => d && d.total > 0);
  if (dartsCols.length) {
    const order = fieldRowOrder();
    const usedRows = order.filter((r) => dartsCols.some((d) => (d.sectors || {})[r.key] > 0));
    // Fehlwurf-Zeile ans Ende (falls vorhanden)
    if (dartsCols.some((d) => (d.sectors || {})['0'] > 0)) usedRows.push({ key: '0', label: L('Fehlwurf', 'Miss') });
    if (usedRows.length) {
      sectionTitle(T('stats.fieldByDart', 'Treffer je Feld & Pfeil'));
      const labelW = 90;
      const gridX = 40;
      const colW = Math.min(90, (W - 80 - labelW) / dartsCols.length);
      // Kopfzeile
      text(gridX, y, 11, 800, INK, T('stats.field', 'Feld'));
      dartsCols.forEach((d, ci) => {
        const cx = gridX + labelW + ci * colW + colW / 2;
        text(cx, y, 10, 700, BLUE, `${d.name}${d.weightGrams ? ' ' + d.weightGrams + 'g' : ''}`);
        parts[parts.length - 1] = parts[parts.length - 1].replace('<text ', '<text text-anchor="middle" ');
      });
      y += 6;
      hline(y);
      y += 12;
      usedRows.forEach((r, ri) => {
        if (ri % 2 === 0) rect(gridX - 2, y - 10, W - 80 + 4, 13, '#F7F7F4');
        text(gridX, y, 10, 700, INK, r.label);
        dartsCols.forEach((d, ci) => {
          const v = (d.sectors || {})[r.key] || 0;
          const cx = gridX + labelW + ci * colW + colW / 2;
          text(cx, y, 10, 400, v ? INK : '#CCC', v ? String(v) : '·');
          parts[parts.length - 1] = parts[parts.length - 1].replace('<text ', '<text text-anchor="middle" ');
        });
        y += 13;
      });
    }
  }

  // Fußzeile
  y += 20;
  const H = Math.max(1123, y + 30);
  text(40, H - 20, 11, 400, GREY, `DartZähler · ${new Date().toLocaleString()}`);

  // Hintergrund + oberer Balken (mit finaler Höhe, vor den Inhalten)
  const bg = `<rect width="${W}" height="${H}" fill="#FFFFFF"/><rect x="0" y="0" width="${W}" height="8" fill="${BLUE}"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${bg}${parts.join('')}</svg>`;
  const safe = String(player || 'spieler').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  await exportSvgAsPdf(svg, W, H, `dartzaehler-bericht-${safe}`);
}
