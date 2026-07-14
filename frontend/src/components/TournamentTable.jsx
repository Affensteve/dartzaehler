import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
} from '@mui/material';
import { ACCENT, MONO } from '../theme';
import { t as tr } from '../i18n';

/** Turnier-Tabelle: Rang, Spieler, Ø, Legs, Punkte (Sieg = 2). */
export default function TournamentTable({ standings, advance = 0 }) {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>#</TableCell>
            <TableCell>{tr('common.player')}</TableCell>
            <TableCell align="center">Ø</TableCell>
            <TableCell align="center">Legs</TableCell>
            <TableCell align="center">{tr('tt.pts')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {standings.map((r) => (
            <TableRow
              key={r.playerId}
              sx={{ borderLeft: `4px solid ${advance > 0 && r.rank <= advance ? ACCENT.green : 'transparent'}` }}
            >
              <TableCell>{r.rank}</TableCell>
              <TableCell sx={{ color: r.type === 'bot' ? ACCENT.bot : 'text.primary', fontWeight: 700 }}>
                {r.name}
                {r.type === 'bot' && r.botLevel ? ` (${r.botLevel})` : ''}
              </TableCell>
              <TableCell align="center" sx={{ fontFamily: MONO }}>
                {r.avg.toFixed(1)}
              </TableCell>
              <TableCell align="center" sx={{ fontFamily: MONO }}>
                {r.legs}:{r.legsAgainst ?? 0}
              </TableCell>
              <TableCell align="center" sx={{ fontFamily: MONO, fontWeight: 700 }}>
                {r.points}
              </TableCell>
            </TableRow>
          ))}
          {standings.length === 0 && (
            <TableRow>
              <TableCell colSpan={5}>
                <Typography color="text.secondary" sx={{ py: 1 }}>
                  {tr('tt.none')}
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
