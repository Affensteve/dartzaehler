import { Box, Paper, Typography, Stack } from '@mui/material';
import { MODE_BY_ID, TRAINING_MODES, localizeMode } from './modes';
import { ACCENT, MONO } from '../../theme';
import DartboardHeatmap from '../DartboardHeatmap';
import { useT, useLang, t as tr } from '../../i18n';

const FIELDS = [...Array(20)].map((_, i) => String(i + 1)).concat(['Bull']);
const CRICKET = ['20', '19', '18', '17', '16', '15', 'Bull'];
const HALVE = ['15', '16', 'Beliebiges Double', '17', '18', 'Beliebiges Triple', '19', '20', 'Bull'];

const avg = (total, sessions) => (sessions ? Math.round((total / sessions) * 10) / 10 : 0);
const entriesFrom = (map, order) => order.map((k) => [k, (map && map[k]) || 0]);

function viewFor(mode, m) {
  const d = m.detail || {};
  switch (mode) {
    case 'clock':
      return {
        metrics: [[tr('ts.sessions'), m.sessions], [tr('ts.recordDarts'), m.best], [tr('ts.avgDarts'), avg(d.darts || 0, m.sessions)]],
        maps: [{ title: tr('ts.mapMissField'), entries: entriesFrom(d.missesByField, FIELDS) }],
        heat: { values: d.missesByField || {}, bull: (d.missesByField || {}).Bull || 0, base: '#C62828', title: tr('ts.heatWeak') },
      };
    case 'bob27':
      return {
        metrics: [[tr('ts.sessions'), m.sessions], [tr('ts.recordPoints'), m.best], [tr('ts.avgPoints'), m.avgScore]],
        maps: [{ title: tr('ts.mapZeroDouble'), entries: entriesFrom(d.zeroByDouble, FIELDS) }],
      };
    case 'countup':
      return {
        metrics: [[tr('ts.sessions'), m.sessions], [tr('ts.recordPoints'), m.best], [tr('ts.avgPoints'), m.avgScore], [tr('ts.s180'), d.s180 || 0]],
        maps: [],
      };
    case 'cricket': {
      const totalMarks = Object.values(d.marksByTarget || {}).reduce((a, b) => a + b, 0);
      const mpr = d.darts ? Math.round((totalMarks / (d.darts / 3)) * 100) / 100 : 0;
      return {
        metrics: [[tr('ts.sessions'), m.sessions], [tr('ts.recordDarts'), m.best], [tr('ts.avgDarts'), avg(d.darts || 0, m.sessions)], [tr('ts.mpr'), mpr], [tr('ts.misses'), d.misses || 0]],
        maps: [{ title: tr('ts.mapMarks'), entries: entriesFrom(d.marksByTarget, CRICKET) }],
      };
    }
    case 'shanghai':
      return {
        metrics: [[tr('ts.sessions'), m.sessions], [tr('ts.recordPoints'), m.best], [tr('ts.avgPoints'), m.avgScore], [tr('ts.shanghais'), d.shanghais || 0]],
        maps: [{ title: tr('ts.mapByType'), entries: [[tr('ts.tSingle'), d.singles || 0], [tr('ts.tDouble'), d.doubles || 0], [tr('ts.tTriple'), d.triples || 0], [tr('ts.tMiss'), d.misses || 0]] }],
      };
    case 'halveit':
      return {
        metrics: [[tr('ts.sessions'), m.sessions], [tr('ts.recordPoints'), m.best], [tr('ts.avgPoints'), m.avgScore]],
        maps: [{ title: tr('ts.mapHalved'), entries: entriesFrom(d.halvedByTarget, HALVE) }],
      };
    case 'checkout': {
      const rate = d.attempts ? Math.round((d.successes / d.attempts) * 1000) / 10 : 0;
      return {
        metrics: [[tr('ts.sessions'), m.sessions], [tr('ts.recordCheckouts'), m.best], [tr('ts.successRate'), `${rate}%`], [tr('ts.attempts'), d.attempts || 0]],
        maps: [],
      };
    }
    default:
      return { metrics: [[tr('ts.sessions'), m.sessions]], maps: [] };
  }
}

function BarList({ entries }) {
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <Stack spacing={0.5} sx={{ mt: 1 }}>
      {entries.map(([label, v]) => (
        <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" sx={{ width: 70, textAlign: 'right', fontFamily: MONO, flex: '0 0 auto' }}>{label}</Typography>
          <Box sx={{ flex: 1, height: 12, bgcolor: 'action.hover', borderRadius: 1, overflow: 'hidden' }}>
            <Box sx={{ width: `${(v / max) * 100}%`, height: '100%', bgcolor: v > 0 ? ACCENT.green : 'transparent' }} />
          </Box>
          <Typography variant="caption" sx={{ width: 28, fontFamily: MONO }}>{v}</Typography>
        </Box>
      ))}
    </Stack>
  );
}

/** Trainings-Statistik je Modus für einen Spieler. `stats` = { [mode]: {...} }. */
export default function TrainingStatsView({ stats }) {
  const t = useT();
  const lang = useLang();
  const modes = TRAINING_MODES.filter((m) => stats && stats[m.id] && stats[m.id].sessions > 0);
  if (modes.length === 0) {
    return (
      <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
        {t('ts.none')}
      </Typography>
    );
  }
  return (
    <Stack spacing={2}>
      {modes.map((meta) => {
        const m = stats[meta.id];
        const v = viewFor(meta.id, m);
        return (
          <Paper key={meta.id} variant="outlined" sx={{ p: 2 }}>
            <Typography sx={{ fontWeight: 800, mb: 1 }}>{localizeMode(meta, lang).name}</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 1 }}>
              {v.metrics.map(([label, val]) => (
                <Box key={label} sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1, textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{label}</Typography>
                  <Typography sx={{ fontFamily: MONO, fontWeight: 700 }}>{val}</Typography>
                </Box>
              ))}
            </Box>
            {v.maps.map((mp) => (
              <Box key={mp.title} sx={{ mt: 1.5 }}>
                <Typography variant="body2" color="text.secondary">{mp.title}</Typography>
                <BarList entries={mp.entries} />
              </Box>
            ))}
            {v.heat && Object.keys(v.heat.values).length > 0 && (
              <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'center' }}>
                <DartboardHeatmap values={v.heat.values} bull={v.heat.bull} base={v.heat.base} title={v.heat.title} size={220} />
              </Box>
            )}
          </Paper>
        );
      })}
    </Stack>
  );
}
