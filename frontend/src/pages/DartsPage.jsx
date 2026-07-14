import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  List,
  ListItem,
  IconButton,
  TextField,
  Typography,
  Stack,
  Alert,
  Button,
  Chip,
} from '@mui/material';
import EditIcon from '@mui/icons-material/EditOutlined';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import Header from '../components/Header';
import { api } from '../api/client';
import { ACCENT } from '../theme';
import { useT } from '../i18n';

export default function DartsPage({ embedded = false }) {
  const navigate = useNavigate();
  const t = useT();
  const [darts, setDarts] = useState([]);
  const [error, setError] = useState(null);

  const [newName, setNewName] = useState('');
  const [newWeight, setNewWeight] = useState(20);

  const [editId, setEditId] = useState(null);
  const [draftName, setDraftName] = useState('');
  const [draftWeight, setDraftWeight] = useState(20);

  const reload = useCallback(() => {
    api.listDarts().then(setDarts).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const add = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await api.createDart({ name, weightGrams: Number(newWeight) || 20 });
      setNewName('');
      setNewWeight(20);
      reload();
    } catch (e) {
      setError(e.message);
    }
  };

  const startEdit = (d) => {
    setEditId(d.id);
    setDraftName(d.name);
    setDraftWeight(d.weightGrams);
  };

  const save = async (id) => {
    const name = draftName.trim();
    if (!name) return;
    try {
      await api.updateDart(id, { name, weightGrams: Number(draftWeight) || 20 });
      setEditId(null);
      reload();
    } catch (e) {
      setError(e.message);
    }
  };

  const remove = async (id) => {
    try {
      await api.deleteDart(id);
      reload();
    } catch (e) {
      setError(e.message);
    }
  };

  const inner = (
    <>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography sx={{ fontWeight: 700, mb: 1 }}>{t('darts.new')}</Typography>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <GpsFixedIcon sx={{ color: ACCENT.green }} />
            <TextField
              variant="standard"
              label={t('darts.name')}
              placeholder={t('darts.namePh')}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              sx={{ flex: 1, minWidth: 160 }}
            />
            <TextField
              variant="standard"
              type="number"
              label={t('darts.weight')}
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
              sx={{ width: 110 }}
            />
            <Button variant="contained" startIcon={<AddIcon />} onClick={add} disabled={!newName.trim()}>
              {t('common.add')}
            </Button>
          </Stack>
        </Paper>

        <Paper variant="outlined">
          {darts.length === 0 ? (
            <Typography color="text.secondary" sx={{ p: 2 }}>
              {t('darts.none')}
            </Typography>
          ) : (
            <List>
              {darts.map((d) => {
                const editing = editId === d.id;
                return (
                  <ListItem
                    key={d.id}
                    secondaryAction={
                      editing ? (
                        <Stack direction="row">
                          <IconButton color="success" aria-label={t('common.save')} onClick={() => save(d.id)}>
                            <CheckIcon />
                          </IconButton>
                          <IconButton aria-label={t('common.cancel')} onClick={() => setEditId(null)}>
                            <CloseIcon />
                          </IconButton>
                        </Stack>
                      ) : (
                        <Stack direction="row">
                          <IconButton aria-label={t('common.edit')} onClick={() => startEdit(d)}>
                            <EditIcon />
                          </IconButton>
                          <IconButton color="error" aria-label={t('common.delete')} onClick={() => remove(d.id)}>
                            <DeleteIcon />
                          </IconButton>
                        </Stack>
                      )
                    }
                  >
                    <GpsFixedIcon sx={{ color: ACCENT.green, mr: 1.5 }} />
                    <Box sx={{ flex: 1, mr: 8 }}>
                      {editing ? (
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                          <TextField
                            variant="standard"
                            label={t('darts.name')}
                            autoFocus
                            value={draftName}
                            onChange={(e) => setDraftName(e.target.value)}
                            sx={{ flex: 1, minWidth: 140 }}
                          />
                          <TextField
                            variant="standard"
                            type="number"
                            label={t('darts.weight')}
                            value={draftWeight}
                            onChange={(e) => setDraftWeight(e.target.value)}
                            sx={{ width: 110 }}
                          />
                        </Stack>
                      ) : (
                        <>
                          <Typography sx={{ fontWeight: 700, fontSize: 18 }}>{d.name}</Typography>
                          <Chip size="small" variant="outlined" label={`${d.weightGrams} g`} sx={{ mt: 0.25, height: 20, fontSize: 11 }} />
                        </>
                      )}
                    </Box>
                  </ListItem>
                );
              })}
            </List>
          )}
        </Paper>
    </>
  );
  if (embedded) {
    return (
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>
          {t('darts.title')}
        </Typography>
        {inner}
      </Box>
    );
  }
  return (
    <Box>
      <Header title={t('darts.title')} onBack={() => navigate('/')} />
      <Container maxWidth="sm" sx={{ py: 3 }}>
        {inner}
      </Container>
    </Box>
  );
}
