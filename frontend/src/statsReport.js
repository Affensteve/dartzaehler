// Clientseitiger PDF-Spielerbericht – dependency-frei (SVG -> Canvas -> JPEG -> PDF),
// nutzt denselben Mechanismus wie der Turnierbaum-Export.
import { exportSvgAsPdf } from './tournamentExport';

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const BLUE = '#006EC7';
const GREEN = '#2E7D32';
const INK = '#1A1A1A';
const GREY = '#666';
const LINE = '#DDD';

const CO_KEYS = ['2-40', '41-70', '71-100', '101-170', 'pressure'];

/**
 * Baut den Bericht als SVG und lädt ihn als PDF herunter.
 * @param {object} o  { player, stats, timeline, rangeLabel, t }
 */
export async function exportPlayerReport({ player, stats, timeline = [], rangeLabel = '', t }) {
  const W = 794; // ~A4 @96dpi
  const H = 1123;
  const s = stats || {};
  const pct = (v) => `${(v || 0).toFixed(1)} %`;

  const metrics = [
    [t('sv.games') || 'Spiele', String(s.games ?? 0)],
    [t('sv.wins') || 'Siege', `${s.wins ?? 0} (${(s.winPct || 0).toFixed(0)} %)`],
    ['Ø', (s.average || 0).toFixed(2)],
    [t('sv.first9') || 'Erste 9', (s.first9Avg || 0).toFixed(2)],
    [t('sv.checkoutPct') || 'Checkout %', pct(s.checkoutPct)],
    ['180er', String(s.s180 ?? 0)],
    [t('sv.maxCheckout') || 'Höchstes Checkout', String(s.maxCheckout ?? 0)],
    [t('sv.minDarts') || 'Bestes Leg', s.minDarts ? String(s.minDarts) : '–'],
  ];

  let y = 0;
  const parts = [];
  parts.push(`<rect width="${W}" height="${H}" fill="#FFFFFF"/>`);
  // Kopf
  parts.push(`<rect x="0" y="0" width="${W}" height="8" fill="${BLUE}"/>`);
  parts.push(`<text x="40" y="60" font-family="Arial, sans-serif" font-size="30" font-weight="800" fill="${INK}">${esc(t('stats.pdfReport') || 'Bericht')}</text>`);
  parts.push(`<text x="40" y="96" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="${BLUE}">${esc(player)}</text>`);
  parts.push(`<text x="${W - 40}" y="96" text-anchor="end" font-family="Arial, sans-serif" font-size="16" fill="${GREY}">${esc(rangeLabel)}</text>`);
  parts.push(`<line x1="40" y1="116" x2="${W - 40}" y2="116" stroke="${LINE}" stroke-width="1"/>`);

  // Kennzahlen-Raster (4 Spalten x 2 Zeilen)
  y = 150;
  parts.push(`<text x="40" y="${y}" font-family="Arial, sans-serif" font-size="18" font-weight="800" fill="${INK}">${esc(t('stats.title') || 'Statistik')}</text>`);
  y += 20;
  const cols = 4;
  const cw = (W - 80) / cols;
  metrics.forEach((m, i) => {
    const cx = 40 + (i % cols) * cw;
    const cy = y + Math.floor(i / cols) * 78;
    parts.push(`<rect x="${cx}" y="${cy}" width="${cw - 12}" height="66" rx="8" fill="#F4F1E8"/>`);
    parts.push(`<text x="${cx + 14}" y="${cy + 26}" font-family="Arial, sans-serif" font-size="12" fill="${GREY}">${esc(m[0])}</text>`);
    parts.push(`<text x="${cx + 14}" y="${cy + 52}" font-family="Arial, sans-serif" font-size="24" font-weight="800" fill="${INK}">${esc(m[1])}</text>`);
  });
  y += 2 * 78 + 20;

  // Checkout nach Rest-Bereich
  parts.push(`<text x="40" y="${y}" font-family="Arial, sans-serif" font-size="18" font-weight="800" fill="${INK}">${esc(t('stats.coRanges') || 'Checkout nach Rest')}</text>`);
  y += 16;
  const cr = s.checkoutRanges || {};
  const barX = 190;
  const barW = W - 40 - barX;
  CO_KEYS.forEach((k) => {
    const e = cr[k] || { hits: 0, attempts: 0, pct: 0 };
    const label = k === 'pressure' ? (t('stats.pressure') || 'Unter Druck') : k;
    const p = Math.max(0, Math.min(100, e.pct || 0));
    parts.push(`<text x="40" y="${y + 16}" font-family="Arial, sans-serif" font-size="13" fill="${INK}">${esc(label)}</text>`);
    parts.push(`<rect x="${barX}" y="${y + 3}" width="${barW}" height="16" rx="4" fill="#ECECEC"/>`);
    parts.push(`<rect x="${barX}" y="${y + 3}" width="${(barW * p) / 100}" height="16" rx="4" fill="${k === 'pressure' ? BLUE : GREEN}"/>`);
    parts.push(`<text x="${W - 40}" y="${y + 16}" text-anchor="end" font-family="Arial, sans-serif" font-size="12" fill="${GREY}">${e.hits}/${e.attempts} · ${(e.pct || 0).toFixed(0)} %</text>`);
    y += 28;
  });
  y += 16;

  // Ø-Verlauf (Sparkline)
  const tl = Array.isArray(timeline) ? timeline.filter((d) => d && d.average != null) : [];
  parts.push(`<text x="40" y="${y}" font-family="Arial, sans-serif" font-size="18" font-weight="800" fill="${INK}">${esc(t('stats.progressWeek') || 'Ø-Verlauf')}</text>`);
  y += 12;
  const chartX = 40;
  const chartW = W - 80;
  const chartH = 160;
  const chartY = y;
  parts.push(`<rect x="${chartX}" y="${chartY}" width="${chartW}" height="${chartH}" rx="8" fill="#FAFAFA" stroke="${LINE}"/>`);
  if (tl.length >= 2) {
    const vals = tl.map((d) => d.average || 0);
    const max = Math.max(...vals, 1);
    const stepX = chartW / (tl.length - 1);
    const pts = vals
      .map((v, i) => `${chartX + i * stepX},${chartY + chartH - (v / max) * (chartH - 20) - 10}`)
      .join(' ');
    parts.push(`<polyline points="${pts}" fill="none" stroke="${GREEN}" stroke-width="3"/>`);
    parts.push(`<text x="${chartX + 8}" y="${chartY + 18}" font-family="Arial, sans-serif" font-size="11" fill="${GREY}">Ø max ${max.toFixed(1)}</text>`);
  } else {
    parts.push(`<text x="${chartX + chartW / 2}" y="${chartY + chartH / 2}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="${GREY}">–</text>`);
  }
  y = chartY + chartH + 40;

  parts.push(`<text x="40" y="${H - 30}" font-family="Arial, sans-serif" font-size="11" fill="${GREY}">DartZähler · ${new Date().toLocaleString()}</text>`);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join('')}</svg>`;
  const safe = String(player || 'spieler').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  await exportSvgAsPdf(svg, W, H, `dartzaehler-bericht-${safe}`);
}
