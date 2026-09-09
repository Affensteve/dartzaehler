import { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  FormControlLabel,
  Switch,
  Button,
  Stack,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Checkbox,
  ListItemText,
  Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import Header from '../components/Header';
import { api } from '../api/client';
import { CARD_CUT } from '../theme';
import { useT } from '../i18n';

function RankingTab() {
  const t = useT();
  const [range, setRange] = useState('all');
  const [bots, setBots] = useState(true);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    api
      .listRatings(range, bots)
      .then((r) => setRows((r && r.players) || []))
      .catch(() => setRows([]));
  }, [range, bots]);

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap' }} useFlexGap>
        <ToggleButtonGroup exclusive size="small" value={range} onChange={(e, v) => v && setRange(v)}>
          <ToggleButton value="all">{t('league.rangeAll')}</ToggleButton>
          <ToggleButton value="30d">{t('league.range30d')}</ToggleButton>
          <ToggleButton value="7d">{t('league.range7d')}</ToggleButton>
        </ToggleButtonGroup>
        <FormControlLabel
          control={<Switch size="small" checked={bots} onChange={(e) => setBots(e.target.checked)} />}
          label={t('league.withBots')}
        />
      </Stack>
      {rows.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          {t('league.rankingEmpty')}
        </Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>{t('league.player')}</TableCell>
              <TableCell align="right">{t('league.elo')}</TableCell>
              <TableCell align="right">{t('league.record')}</TableCell>
              <TableCell align="right">{t('league.games')}</TableCell>
              <TableCell align="right">{t('league.peak')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.dbId}>
                <TableCell>{r.rank}</TableCell>
                <TableCell>
                  {r.name}
                  {r.type === 'bot' && <Chip size="small" label="Bot" sx={{ ml: 0.5, height: 18 }} />}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 800 }}>{r.elo}</TableCell>
                <TableCell align="right">{r.wins}–{r.losses}</TableCell>
                <TableCell align="right">{r.games}</TableCell>
                <TableCell align="right" sx={{ color: 'text.secondary' }}>{r.peak}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  );
}

function LeagueDetail({ league, players, onChange, onClose }) {
  const t = useT();
  const [addId, setAddId] = useState('');
  const memberIds = new Set((league.members || []).map((m) => m.dbId));
  const candidates = players.filter((p) => p.type !== 'bot' && !memberIds.has(p.id));

  const add = async () => {
    if (!addId) return;
    const l = await api.addLeagueMember(league.id, Number(addId));
    setAddId('');
    onChange(l);
  };
  const remove = async (pid) => onChange(await api.removeLeagueMember(league.id, pid));
  const toggleStatus = async () =>
    onChange(await api.setLeagueStatus(league.id, league.status === 'active' ? 'finished' : 'active'));
  const del = async () => {
    await api.deleteLeague(league.id);
    onClose(true);
  };

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={() => onClose(false)}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <EmojiEventsIcon color="primary" />
        {league.name}
        <Chip
          size="small"
          color={league.status === 'active' ? 'success' : 'default'}
          label={league.status === 'active' ? t('league.statusActive') : t('league.statusFinished')}
          sx={{ ml: 'auto' }}
        />
      </DialogTitle>
      <DialogContent dividers>
        {league.standings && league.standings.length > 0 ? (
          <Table size="small" sx={{ mb: 2 }}>
            <TableHead>
              <TableRow>
                <TableCell>{t('league.pos')}</TableCell>
                <TableCell>{t('league.player')}</TableCell>
                <TableCell align="right">{t('league.played')}</TableCell>
                <TableCell align="right">{t('league.won')}</TableCell>
                <TableCell align="right">{t('league.lost')}</TableCell>
                <TableCell align="right">{t('league.legs')}</TableCell>
                <TableCell align="right">{t('league.elo')}</TableCell>
                <TableCell align="right">{t('league.points')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {league.standings.map((r) => (
                <TableRow key={r.dbId}>
                  <TableCell>{r.pos}</TableCell>
                  <TableCell>
                    {r.name}
                    <IconButton size="small" onClick={() => remove(r.dbId)} aria-label="remove" sx={{ ml: 0.5 }}>
                      <DeleteIcon fontSize="inherit" />
                    </IconButton>
                  </TableCell>
                  <TableCell align="right">{r.played}</TableCell>
                  <TableCell align="right">{r.won}</TableCell>
                  <TableCell align="right">{r.lost}</TableCell>
                  <TableCell align="right">{r.legsFor}:{r.legsAgainst}</TableCell>
                  <TableCell align="right">{r.elo}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>{r.points}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Typography color="text.secondary" sx={{ py: 2 }}>{t('league.noMembers')}</Typography>
        )}

        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            select
            size="small"
            label={t('league.addMember')}
            value={addId}
            onChange={(e) => setAddId(e.target.value)}
            sx={{ flex: 1 }}
          >
            {candidates.length === 0 && <MenuItem value="" disabled>—</MenuItem>}
            {candidates.map((p) => (
              <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
            ))}
          </TextField>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={add} disabled={!addId}>
            {t('league.add')}
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Button color="error" startIcon={<DeleteIcon />} onClick={del}>{t('league.delete')}</Button>
        <Box>
          <Button onClick={toggleStatus}>
            {league.status === 'active' ? t('league.finish') : t('league.reopen')}
          </Button>
          <Button variant="contained" onClick={() => onClose(false)}>{t('league.close')}</Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}

function LeaguesTab({ players }) {
  const t = useT();
  const [leagues, setLeagues] = useState([]);
  const [detail, setDetail] = useState(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [selMembers, setSelMembers] = useState([]);
  const [winPoints, setWinPoints] = useState(3);

  const reload = useCallback(() => {
    api.listLeagues().then(setLeagues).catch(() => setLeagues([]));
  }, []);
  useEffect(() => reload(), [reload]);

  const openDetail = async (id) => {
    try {
      setDetail(await api.getLeague(id));
    } catch {
      /* ignore */
    }
  };
  const create = async () => {
    const league = await api.createLeague({ name, memberIds: selMembers.map(Number), winPoints: Number(winPoints) });
    setCreating(false);
    setName('');
    setSelMembers([]);
    reload();
    setDetail(league);
  };

  const humans = players.filter((p) => p.type !== 'bot');

  return (
    <Box>
      <Button variant="contained" startIcon={<AddIcon />} sx={{ mb: 2 }} onClick={() => setCreating(true)}>
        {t('league.newLeague')}
      </Button>
      {leagues.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>{t('league.empty')}</Typography>
      ) : (
        <Stack spacing={1}>
          {leagues.map((l) => (
            <Paper
              key={l.id}
              variant="outlined"
              sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', clipPath: CARD_CUT }}
              onClick={() => openDetail(l.id)}
            >
              <EmojiEventsIcon color={l.status === 'active' ? 'primary' : 'disabled'} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700 }} noWrap>{l.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {l.memberCount} {t('league.members')}
                </Typography>
              </Box>
              <Chip
                size="small"
                color={l.status === 'active' ? 'success' : 'default'}
                label={l.status === 'active' ? t('league.statusActive') : t('league.statusFinished')}
              />
            </Paper>
          ))}
        </Stack>
      )}

      <Dialog open={creating} fullWidth maxWidth="xs" onClose={() => setCreating(false)}>
        <DialogTitle>{t('league.newLeague')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label={t('league.name')} value={name} onChange={(e) => setName(e.target.value)} fullWidth />
            <TextField
              select
              label={t('league.members')}
              value={selMembers}
              onChange={(e) => setSelMembers(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
              SelectProps={{ multiple: true, renderValue: (sel) => `${sel.length} ${t('league.members')}` }}
              fullWidth
            >
              {humans.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  <Checkbox checked={selMembers.indexOf(String(p.id)) > -1 || selMembers.indexOf(p.id) > -1} />
                  <ListItemText primary={p.name} />
                </MenuItem>
              ))}
            </TextField>
            <TextField
              type="number"
              label={t('league.winPoints')}
              value={winPoints}
              onChange={(e) => setWinPoints(e.target.value)}
              inputProps={{ min: 1, max: 10 }}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreating(false)}>{t('league.cancel')}</Button>
          <Button variant="contained" onClick={create} disabled={!name.trim()}>{t('league.create')}</Button>
        </DialogActions>
      </Dialog>

      {detail && (
        <LeagueDetail
          league={detail}
          players={players}
          onChange={(l) => {
            setDetail(l);
            reload();
          }}
          onClose={(deleted) => {
            setDetail(null);
            if (deleted) reload();
          }}
        />
      )}
    </Box>
  );
}

export default function LeaguesPage() {
  const t = useT();
  const [tab, setTab] = useState(0);
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    api.listPlayers().then(setPlayers).catch(() => setPlayers([]));
  }, []);

  return (
    <Box>
      <Header title={t('league.title')} />
      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Paper variant="outlined" sx={{ clipPath: CARD_CUT }}>
          <Tabs value={tab} onChange={(e, v) => setTab(v)} variant="fullWidth">
            <Tab label={t('league.tabRanking')} />
            <Tab label={t('league.tabLeagues')} />
          </Tabs>
          <Divider />
          <Box sx={{ p: 2 }}>{tab === 0 ? <RankingTab /> : <LeaguesTab players={players} />}</Box>
        </Paper>
      </Container>
    </Box>
  );
}
