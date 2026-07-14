import { useState } from 'react';
import { Box, Paper, Typography, ToggleButton, ToggleButtonGroup, Stack } from '@mui/material';
import { ACCENT, MONO } from '../theme';
import { useT } from '../i18n';

const METRICS = [
  { key: 'average', labelKey: 'tl.average', fmt: (v) => v.toFixed(2), color: ACCENT.green },
  { key: 'first9Avg', labelKey: 'tl.first9', fmt: (v) => v.toFixed(2), color: '#3B82F6' },
  { key: 'checkoutPct', labelKey: 'tl.checkoutPct', fmt: (v) => `${v.toFixed(1)} %`, color: '#F59E0B', unit: '%' },
  { key: 's180', labelKey: 'tl.s180', fmt: (v) => String(v), color: '#EC407A' },
];

const W = 640;
const H = 220;
const PAD = { l: 44, r: 12, t: 14, b: 34 };

function niceMax(v, isPct) {
  if (!v || v <= 0) return isPct ? 10 : 10;
  if (isPct) return Math.min(100, Math.ceil(v / 10) * 10);
  const step = v > 120 ? 20 : v > 40 ? 10 : 5;
  return Math.ceil(v / step) * step;
}

/**
 * Fortschritts-Timeline: eine Kennzahl je Kalenderwoche als Linie (Inline-SVG,
 * ohne externe Chart-Bibliothek). `data` = [{ label, average, first9Avg, checkoutPct, s180, games }].
 */
export default function TimelineChart({ data }) {
  const t = useT();
  const [metricKey, setMetricKey] = useState('average');
  const metric = METRICS.find((m) => m.key === metricKey);

  if (!data || data.length === 0) {
    return (
      <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
        {t('tl.none')}
      </Typography>
    );
  }

  const values = data.map((d) => d[metricKey] || 0);
  const yMax = niceMax(Math.max(...values), !!metric.unit);
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const n = data.length;
  const x = (i) => PAD.l + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v) => PAD.t + innerH - (v / yMax) * innerH;

  const pts = data.map((d, i) => [x(i), y(d[metricKey] || 0)]);
  const line = pts.map((p) => p.join(',')).join(' ');
  const gridY = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ f, v: yMax * f }));
  // Höchstens ~8 X-Beschriftungen zeigen.
  const stepLbl = Math.ceil(n / 8);

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack direction="row" justifyContent="center" sx={{ mb: 1 }}>
        <ToggleButtonGroup exclusive size="small" value={metricKey} onChange={(e, v) => v && setMetricKey(v)}>
          {METRICS.map((m) => (
            <ToggleButton key={m.key} value={m.key}>
              {t(m.labelKey)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>
      <Box sx={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', minWidth: 320 }}>
          {gridY.map((g) => (
            <g key={g.f}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(g.v)} y2={y(g.v)} stroke="currentColor" strokeOpacity="0.12" />
              <text x={PAD.l - 6} y={y(g.v) + 3} textAnchor="end" fontSize="10" fill="currentColor" fillOpacity="0.55" fontFamily={MONO}>
                {metric.unit ? Math.round(g.v) : Math.round(g.v)}
              </text>
            </g>
          ))}
          {n > 1 && <polyline points={line} fill="none" stroke={metric.color} strokeWidth="2.5" />}
          {pts.map((p, i) => (
            <g key={i}>
              <circle cx={p[0]} cy={p[1]} r="3.5" fill={metric.color}>
                <title>{`${data[i].label}: ${metric.fmt(data[i][metricKey] || 0)} (${data[i].games} Spiele)`}</title>
              </circle>
              {i % stepLbl === 0 && (
                <text x={p[0]} y={H - PAD.b + 16} textAnchor="middle" fontSize="9" fill="currentColor" fillOpacity="0.6" fontFamily={MONO}>
                  {data[i].label.replace('KW ', '')}
                </text>
              )}
            </g>
          ))}
        </svg>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 0.5 }}>
        {t('tl.perWeek', { metric: t(metric.labelKey), value: metric.fmt(values[values.length - 1]) })}
      </Typography>
    </Paper>
  );
}
