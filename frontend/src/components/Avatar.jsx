import { Box } from '@mui/material';

export function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

function Half({ photo, color, name, fontSize, divider }) {
  return (
    <Box
      sx={{
        width: '50%',
        height: '100%',
        position: 'relative',
        display: 'grid',
        placeItems: 'center',
        bgcolor: color || '#607D8B',
        color: '#fff',
        fontWeight: 800,
        fontSize,
        borderRight: divider ? '2px solid rgba(255,255,255,0.7)' : 'none',
      }}
    >
      {photo ? (
        <Box component="img" src={photo} alt={name || ''} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        initials(name)
      )}
    </Box>
  );
}

// Runder Avatar. Einzelbild (Foto, sonst farbiger Kreis mit Initialen) oder -
// fuer Doppel/Team - ein geteilter Kreis mit zwei Bildern (avatars: Array aus
// bis zu zwei { photo, color, name }).
export default function Avatar({ photo, color, name, size = 56, avatars = null }) {
  const list = Array.isArray(avatars) && avatars.length ? avatars.slice(0, 2) : null;

  if (list && list.length === 2) {
    return (
      <Box sx={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flex: '0 0 auto', display: 'flex' }}>
        <Half {...list[0]} fontSize={size * 0.3} divider />
        <Half {...list[1]} fontSize={size * 0.3} />
      </Box>
    );
  }

  const a = list ? list[0] : { photo, color, name };
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        flex: '0 0 auto',
        overflow: 'hidden',
        display: 'grid',
        placeItems: 'center',
        bgcolor: a.color || '#607D8B',
        color: '#fff',
        fontWeight: 800,
        fontSize: size * 0.4,
        lineHeight: 1,
      }}
    >
      {a.photo ? (
        <Box component="img" src={a.photo} alt={a.name || ''} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        initials(a.name || name)
      )}
    </Box>
  );
}
