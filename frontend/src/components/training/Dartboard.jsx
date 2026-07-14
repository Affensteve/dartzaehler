// Stilisiertes Dartboard als SVG mit Highlight einzelner Felder/Ringe.
import { ACCENT } from '../../theme';

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

/**
 * @param numbers Array von Feldnummern (1–20) zum Hervorheben; Bull über `ring="bull"` oder 25.
 * @param ring    'number' (ganzes Feld) | 'double' | 'triple' | 'single' | 'bull'
 */
export default function Dartboard({ numbers = [], ring = 'number', size = 190 }) {
  const set = new Set(numbers.filter((n) => n !== 25 && n !== 'Bull'));
  const wantBull = ring === 'bull' || numbers.includes(25) || numbers.includes('Bull');
  const HL = `${ACCENT.double}8C`;
  const bands = [
    [97, 105, 'double'],
    [68, 97, 'single'],
    [60, 68, 'triple'],
    [16, 60, 'single'],
  ];
  const base = [];
  ORDER.forEach((n, i) => {
    const a0 = i * 18 - 9;
    const a1 = i * 18 + 9;
    const dark = i % 2 === 0;
    bands.forEach(([r0, r1, type], bi) => {
      const fill =
        type === 'single' ? (dark ? '#2b2b2b' : '#e8d9b5') : dark ? '#c0392b' : ACCENT.green;
      base.push(<path key={`${n}-${bi}`} d={wedge(r0, r1, a0, a1)} fill={fill} stroke="#111" strokeWidth="0.4" />);
    });
  });
  base.push(<circle key="bo" cx={110} cy={110} r={16} fill={ACCENT.green} stroke="#111" strokeWidth="0.4" />);
  base.push(<circle key="bi" cx={110} cy={110} r={7} fill="#c0392b" stroke="#111" strokeWidth="0.4" />);

  const hi = [];
  ORDER.forEach((n, i) => {
    if (!set.has(n)) return;
    const a0 = i * 18 - 9;
    const a1 = i * 18 + 9;
    if (ring === 'single') {
      hi.push(<path key={`hs1-${n}`} d={wedge(68, 97, a0, a1)} fill={HL} />);
      hi.push(<path key={`hs2-${n}`} d={wedge(16, 60, a0, a1)} fill={HL} />);
      return;
    }
    let r0 = 7;
    let r1 = 105;
    if (ring === 'double') {
      r0 = 97;
      r1 = 105;
    } else if (ring === 'triple') {
      r0 = 60;
      r1 = 68;
    }
    hi.push(<path key={`h-${n}`} d={wedge(r0, r1, a0, a1)} fill={HL} stroke={ACCENT.double} strokeWidth="1" />);
  });
  if (wantBull) hi.push(<circle key="hb" cx={110} cy={110} r={16} fill={HL} stroke={ACCENT.double} strokeWidth="1" />);

  const labels = ORDER.map((n, i) => {
    const [x, y] = polar(114, i * 18);
    return (
      <text key={`t${n}`} x={x} y={y} fontSize="9" fill="#bbb" textAnchor="middle" dominantBaseline="middle">
        {n}
      </text>
    );
  });

  return (
    <svg viewBox="0 0 220 230" width={size} height={(size * 230) / 220} role="img" aria-label="Dartboard">
      {base}
      {hi}
      {labels}
    </svg>
  );
}
