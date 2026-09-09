import { Box, Typography } from '@mui/material';

// Stilisiertes Dartboard, dessen Felder nach einem Wert (z. B. Treffer oder
// Fehlwürfe) eingefärbt werden. values: { 1..20: n }, bull: n.
const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

function polar(r, deg) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [110 + r * Math.cos(a), 110 + r * Math.sin(a)];
}
function wedge(r0, r1, a0, a1) {
  const [x0, y0] = polar(r1, a0);
  const [x1, y1] = polar(r1, a1);
  const [x2, y2] = polar(r0, a1);
  const [x3, y3] = polar(r0, a0);
  return `M${x0} ${y0} A${r1} ${r1} 0 0 1 ${x1} ${y1} L${x2} ${y2} A${r0} ${r0} 0 0 0 ${x3} ${y3} Z`;
}
function hexToRgb(h) {
  const m = h.replace('#', '');
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
}
function mix(base, tt) {
  const rgb = hexToRgb(base);
  const bg = [242, 242, 242];
  const c = bg.map((x, i) => Math.round(x + (rgb[i] - x) * tt));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

export default function DartboardHeatmap({ values = {}, bull = 0, base = '#2E7D32', size = 220, title }) {
  const max = Math.max(0, bull, ...ORDER.map((n) => values[n] || 0));
  const fillFor = (v) => (v > 0 && max ? mix(base, 0.15 + 0.85 * (v / max)) : '#f2f2f2');
  return (
    <Box sx={{ textAlign: 'center' }}>
      {title && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          {title}
        </Typography>
      )}
      <svg viewBox="0 0 220 220" width={size} height={size} style={{ maxWidth: '100%' }}>
        {ORDER.map((n, i) => {
          const a0 = i * 18 - 9;
          const a1 = i * 18 + 9;
          return <path key={n} d={wedge(30, 105, a0, a1)} fill={fillFor(values[n] || 0)} stroke="#bbb" strokeWidth="0.5" />;
        })}
        <circle cx="110" cy="110" r="30" fill={fillFor(bull)} stroke="#bbb" strokeWidth="0.5" />
        {ORDER.map((n, i) => {
          const [x, y] = polar(67, i * 18);
          const v = values[n] || 0;
          return (
            <text key={'t' + n} x={x} y={y + 3} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#222">
              {n}
              {v ? '·' + v : ''}
            </text>
          );
        })}
        <text x="110" y="113" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#222">
          {'Bull' + (bull ? '·' + bull : '')}
        </text>
      </svg>
    </Box>
  );
}
