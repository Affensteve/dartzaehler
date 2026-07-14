import { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Tooltip,
  Collapse,
  Link,
  TextField,
  MenuItem,
  Stack,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { ACCENT, MONO } from '../theme';
import { api } from '../api/client';
import { useT, t as tr } from '../i18n';

export const pctFmt = (v) => `${(v ?? 0).toFixed(2)}%`;

// Farbpalette für die Pfeil-Segmente (gestapelte Sektor-Balken).
const DART_COLORS = ['#2E9E4F', '#EC407A', '#3B82F6', '#F59E0B', '#8B5CF6', '#14B8A6', '#EF4444', '#0EA5E9'];
const NO_DART_COLOR = '#9E9E9E';

export const SECTOR_KEYS = (() => {
  const keys = ['0'];
  for (let i = 1; i <= 20; i++) keys.push(String(i));
  keys.push('25');
  for (let i = 1; i <= 20; i++) keys.push('D' + i);
  keys.push('D25');
  for (let i = 1; i <= 20; i++) keys.push('T' + i);
  return keys;
})();

const AXIS_LABELS = new Set([
  '0', '5', '10', '15', '20', '25',
  'D5', 'D10', 'D15', 'D20', 'D25',
  'T5', 'T10', 'T15', 'T20',
]);

function niceSectorLabel(k) {
  if (k === '0') return tr('sv.miss');
  if (k === '25') return tr('sec.bull');
  if (k === 'D25') return tr('sec.bullseye');
  if (k[0] === 'D') return tr('sec.double', { n: k.slice(1) });
  if (k[0] === 'T') return tr('sec.triple', { n: k.slice(1) });
  return tr('sec.single', { n: k });
}

const sumSectors = (s) => SECTOR_KEYS.reduce((a, k) => a + (s[k] || 0), 0);

export function nameColor(r) {
  return r.type === 'bot' ? ACCENT.bot : 'text.primary';
}

function StatBlock({ title, columns, rows, showRank, onNameClick }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" align="center" sx={{ fontWeight: 800, mb: 1 }}>
        {title}
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{tr('common.player')}</TableCell>
              {columns.map((c) => (
                <TableCell key={c.key} align="right">
                  {c.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={r.playerId}>
                <TableCell sx={{ fontWeight: 700, color: nameColor(r), whiteSpace: 'nowrap' }}>
                  {showRank ? `${i + 1}. ` : ''}
                  {onNameClick ? (
                    <Link
                      component="button"
                      type="button"
                      underline="hover"
                      onClick={() => onNameClick(r)}
                      sx={{ color: 'inherit', fontWeight: 700, verticalAlign: 'baseline' }}
                    >
                      {r.name}
                    </Link>
                  ) : (
                    r.name
                  )}
                </TableCell>
                {columns.map((c) => (
                  <TableCell key={c.key} align="right" sx={{ fontFamily: MONO }}>
                    {c.render(r)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

function niceCeil(pct) {
  if (!pct || pct <= 0) return 5;
  return Math.min(100, Math.ceil(pct / 5) * 5);
}

/**
 * Balken je Sektor. `series` = [{ key, name, color, sectors }]. Balkenhöhe =
 * Anteil des Sektors an allen Würfen (%); bei mehreren Serien wird der Balken
 * farbig nach Pfeil gestapelt (Anteil je Pfeil am Sektor).
 */
function SectorBars({ series }) {
  const overallTotal = series.reduce((s, ser) => s + sumSectors(ser.sectors), 0);
  const sectorTotal = (k) => series.reduce((s, ser) => s + (ser.sectors[k] || 0), 0);
  const shares = SECTOR_KEYS.map((k) => (overallTotal ? (sectorTotal(k) / overallTotal) * 100 : 0));
  const axisMax = niceCeil(Math.max(0, ...shares));

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box sx={{ minWidth: 520 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'right', mb: 0.25 }}>
          {tr('sv.share', { max: axisMax })}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '1px', height: 150 }}>
          {SECTOR_KEYS.map((k, idx) => {
            const tot = sectorTotal(k);
            const barH = axisMax ? (shares[idx] / axisMax) * 100 : 0;
            const title = (
              <Box>
                <div>
                  <b>{niceSectorLabel(k)}</b>: {shares[idx].toFixed(1)} % ({tot}×)
                </div>
                {series.length > 1 &&
                  series
                    .filter((ser) => (ser.sectors[k] || 0) > 0)
                    .map((ser) => (
                      <div key={ser.key}>
                        {ser.name}: {ser.sectors[k]}×
                      </div>
                    ))}
              </Box>
            );
            return (
              <Tooltip key={k} arrow placement="top" title={title}>
                <Box
                  sx={{
                    flex: '1 0 6px',
                    height: `${barH}%`,
                    minHeight: tot > 0 ? 3 : 0,
                    display: 'flex',
                    flexDirection: 'column-reverse',
                    borderRadius: '2px 2px 0 0',
                    overflow: 'hidden',
                    cursor: 'default',
                  }}
                >
                  {series.map((ser) => {
                    const seg = ser.sectors[k] || 0;
                    if (!seg || !tot) return null;
                    return <Box key={ser.key} sx={{ height: `${(seg / tot) * 100}%`, bgcolor: ser.color }} />;
                  })}
                </Box>
              </Tooltip>
            );
          })}
        </Box>
        <Box sx={{ display: 'flex', gap: '1px', mt: 0.5, borderTop: '1px solid', borderColor: 'divider', pt: 0.5 }}>
          {SECTOR_KEYS.map((k) => (
            <Box
              key={k}
              sx={{
                flex: '1 0 6px',
                textAlign: 'center',
                fontSize: 9,
                color: 'text.secondary',
                fontFamily: MONO,
                whiteSpace: 'nowrap',
              }}
            >
              {AXIS_LABELS.has(k) ? k : ''}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

/**
 * Aufklappbares Sektor-Diagramm eines Spielers.
 * - Auswahl „Alle Pfeile": Balken farbig nach Pfeil gestapelt (Anteil je Pfeil).
 * - Auswahl eines Pfeils: einfarbige Balken nur für diesen Pfeil.
 * `enableDartFilter` zeigt ein eigenes Dropdown (Übersicht); `externalDart`
 * steuert die Auswahl von außen (Spieler-Statistikseite).
 */
export function SectorChart({ row, rank, defaultOpen, area = 'game', range = 'all', enableDartFilter = false, externalDart }) {
  const t = useT();
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const [darts, setDarts] = useState([]);
  const [dartFilter, setDartFilter] = useState('all');
  const [breakdown, setBreakdown] = useState(null); // je Pfeil bei „Alle Pfeile"
  const [override, setOverride] = useState(null); // Sektoren eines Pfeils (Übersicht-Dropdown)

  const effective = enableDartFilter ? dartFilter : externalDart != null ? externalDart : 'all';

  useEffect(() => {
    if (!enableDartFilter) return;
    api.playerDarts(row.playerId, area).then(setDarts).catch(() => setDarts([]));
  }, [enableDartFilter, row.playerId, area]);

  useEffect(() => {
    setDartFilter('all');
    setOverride(null);
  }, [area, range, row.playerId]);

  // „Alle Pfeile": Aufschlüsselung je Pfeil laden.
  useEffect(() => {
    let cancelled = false;
    if (effective === 'all') {
      api
        .playerSectors(row.playerId, area, range)
        .then((b) => !cancelled && setBreakdown(b))
        .catch(() => !cancelled && setBreakdown(null));
    }
    return () => {
      cancelled = true;
    };
  }, [effective, row.playerId, area, range]);

  const chooseDart = async (val) => {
    setDartFilter(val);
    if (val === 'all') {
      setOverride(null);
      return;
    }
    try {
      const r = await api.getPlayerStats(row.playerId, range, area, val);
      setOverride(r.sectors || {});
    } catch {
      setOverride({});
    }
  };

  // Serien für die Balken bauen.
  let series;
  if (effective === 'all') {
    if (breakdown && breakdown.length) {
      series = breakdown.map((d, i) => ({
        key: d.dartId == null ? 'none' : String(d.dartId),
        name: d.dartId == null ? 'Ohne Pfeil' : `${d.name}${d.weightGrams != null ? ` · ${d.weightGrams} g` : ''}`,
        color: d.dartId == null ? NO_DART_COLOR : DART_COLORS[i % DART_COLORS.length],
        sectors: d.sectors || {},
        average: d.average != null ? d.average : 0,
      }));
    } else {
      series = [{ key: 'all', name: 'Alle', color: ACCENT.green, sectors: row.sectors || {} }];
    }
  } else {
    const sectors = enableDartFilter ? override || {} : row.sectors || {};
    series = [{ key: 'dart', name: 'Pfeil', color: ACCENT.green, sectors }];
  }

  const total = series.reduce((s, ser) => s + sumSectors(ser.sectors), 0);
  const dartChips = darts.filter((d) => d.dartId != null);
  const showLegend = effective === 'all' && series.length > 1;
  // Pfeil mit dem besten Ø (nur echte Pfeile) – als Empfehlung fett markieren.
  const realDarts = series.filter((ser) => ser.key !== 'all' && ser.key !== 'none' && ser.average > 0);
  const bestAvgKey = realDarts.length > 1 ? realDarts.reduce((a, b) => (b.average > a.average ? b : a)).key : null;

  return (
    <Paper variant="outlined" sx={{ mb: 1.5 }}>
      <Box
        onClick={() => setOpen((o) => !o)}
        sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, cursor: 'pointer', userSelect: 'none' }}
      >
        <ExpandMoreIcon sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
        <Typography sx={{ fontWeight: 700, color: nameColor(row), flex: 1 }}>
          {rank ? `${rank}. ` : ''}
          {row.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {total} {t('sv.hits')}
        </Typography>
      </Box>
      <Collapse in={open} unmountOnExit>
        <Box sx={{ px: 1.5, pb: 1.5 }}>
          {enableDartFilter && dartChips.length > 0 && (
            <TextField
              select
              size="small"
              label={t('sv.dart')}
              value={dartFilter}
              onChange={(e) => chooseDart(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              sx={{ minWidth: 180, mb: 1.5 }}
            >
              <MenuItem value="all">{t('sv.allDarts')}</MenuItem>
              {dartChips.map((d) => (
                <MenuItem key={d.dartId} value={d.dartId}>
                  {d.name} · {d.weightGrams} g ({d.games})
                </MenuItem>
              ))}
            </TextField>
          )}

          {showLegend && (
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
              {series.map((ser) => (
                <Stack key={ser.key} direction="row" spacing={0.5} alignItems="center">
                  <Box sx={{ width: 12, height: 12, borderRadius: '2px', bgcolor: ser.color }} />
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontWeight: ser.key === bestAvgKey ? 800 : 400 }}
                  >
                    {ser.name} · Ø {ser.average} ({sumSectors(ser.sectors)})
                  </Typography>
                </Stack>
              ))}
            </Stack>
          )}
          {bestAvgKey && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              {t('sv.bestDartHint')}
            </Typography>
          )}

          <SectorBars series={series} />
        </Box>
      </Collapse>
    </Paper>
  );
}

/**
 * Rendert alle Statistik-Blöcke für die übergebenen Zeilen.
 */
export function StatSections({
  rows,
  onNameClick,
  showRank = true,
  area = 'game',
  range = 'all',
  enableSectorDartFilter = false,
  externalDart,
}) {
  const t = useT();
  const withDarts = rows.filter((r) => Object.keys(r.sectors || {}).length > 0);
  const common = { rows, showRank, onNameClick };
  return (
    <>
      <StatBlock
        {...common}
        title={t('sv.games')}
        columns={[
          { key: 'games', label: t('sv.games'), render: (r) => r.games },
          { key: 'wins', label: t('sv.wins'), render: (r) => r.wins },
          { key: 'winPct', label: t('sv.winPct'), render: (r) => pctFmt(r.winPct) },
        ]}
      />
      <StatBlock
        {...common}
        title={t('sv.legsBlock')}
        columns={[
          { key: 'legs', label: t('sv.legsBlock'), render: (r) => r.legs },
          { key: 'legsWon', label: t('sv.legsWon'), render: (r) => r.legsWon },
          { key: 'legsWinPct', label: t('sv.legsWinPct'), render: (r) => pctFmt(r.legsWinPct) },
        ]}
      />
      <StatBlock
        {...common}
        title={t('sv.dartsBlock')}
        columns={[
          { key: 'dartsAvg', label: t('sv.dartsAvg'), render: (r) => r.dartsAvg.toFixed(1) },
          { key: 'doublePct', label: t('sv.doublePct'), render: (r) => pctFmt(r.doublePct) },
          { key: 'triplePct', label: t('sv.triplePct'), render: (r) => pctFmt(r.triplePct) },
        ]}
      />
      <StatBlock
        {...common}
        title={t('sv.avgBlock')}
        columns={[
          { key: 'avg', label: t('sv.average'), render: (r) => r.average.toFixed(2) },
          { key: 'f9', label: t('sv.first9'), render: (r) => r.first9Avg.toFixed(2) },
          { key: 'maxTurn', label: t('sv.bestVisit'), render: (r) => r.maxTurn },
        ]}
      />
      <StatBlock
        {...common}
        title={t('sv.pointsBlock')}
        columns={[
          { key: 's60', label: '60+', render: (r) => r.s60 },
          { key: 's100', label: '100+', render: (r) => r.s100 },
          { key: 's140', label: '140+', render: (r) => r.s140 },
          { key: 's180', label: '180', render: (r) => r.s180 },
        ]}
      />
      <StatBlock
        {...common}
        title={t('sv.checkoutBlock')}
        columns={[
          { key: 'maxco', label: t('sv.maxCheckout'), render: (r) => r.maxCheckout },
          {
            key: 'mindarts',
            label: t('sv.minDarts'),
            render: (r) => {
              const m = r.minDartsByMode || {};
              const keys = Object.keys(m).sort((a, b) => Number(b) - Number(a));
              return keys.length ? keys.map((k) => `${k}: ${m[k]}`).join(' · ') : '–';
            },
          },
          { key: 'copct', label: t('sv.checkoutPct'), render: (r) => pctFmt(r.checkoutPct) },
          {
            key: 'dblrate',
            label: t('sv.doubleRate'),
            render: (r) => (r.doubleTries ? `${pctFmt(r.doubleRatePct)} (${r.doubleHits}/${r.doubleTries})` : '–'),
          },
        ]}
      />

      <StatBlock
        {...common}
        title={t('sv.precisionBlock')}
        columns={[
          { key: 'tons', label: t('sv.tons'), render: (r) => r.tons ?? (r.s100 + r.s140 + r.s180) },
          { key: 'misses', label: t('sv.misses'), render: (r) => r.misses ?? 0 },
          { key: 'missrate', label: t('sv.missRate'), render: (r) => pctFmt(r.missPct ?? 0) },
        ]}
      />

      <Typography variant="h6" align="center" sx={{ fontWeight: 800, mb: 0.5 }}>
        {t('sv.sectorTitle')}
      </Typography>
      <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 2 }}>
        {t('sv.sectorHint')}
      </Typography>
      {withDarts.length === 0 ? (
        <Typography color="text.secondary" align="center">
          {t('sv.noThrows')}
        </Typography>
      ) : (
        withDarts.map((r, i) => (
          <SectorChart
            key={r.playerId}
            row={r}
            rank={showRank ? i + 1 : null}
            defaultOpen={i === 0}
            area={area}
            range={range}
            enableDartFilter={enableSectorDartFilter}
            externalDart={externalDart}
          />
        ))
      )}
    </>
  );
}
