import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';

// Route-Level Code-Splitting: jede Seite wird als eigener Chunk geladen,
// sodass der initiale Download klein bleibt (wichtig für schwächere Geräte).
const HomePage = lazy(() => import('./pages/HomePage'));
const SetupPage = lazy(() => import('./pages/SetupPage'));
const TrainingSetupPage = lazy(() => import('./pages/TrainingSetupPage'));
const TrainingPage = lazy(() => import('./pages/TrainingPage'));
const TrainingPlayPage = lazy(() => import('./pages/TrainingPlayPage'));
const TrainingBuilderPage = lazy(() => import('./pages/TrainingBuilderPage'));
const DartsPage = lazy(() => import('./pages/DartsPage'));
const VerwaltungPage = lazy(() => import('./pages/VerwaltungPage'));
const CoachPage = lazy(() => import('./pages/CoachPage'));
const GamePage = lazy(() => import('./pages/GamePage'));
const TournamentSetupPage = lazy(() => import('./pages/TournamentSetupPage'));
const TournamentPage = lazy(() => import('./pages/TournamentPage'));
const PlayersPage = lazy(() => import('./pages/PlayersPage'));
const PlayerStatsPage = lazy(() => import('./pages/PlayerStatsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const StatsPage = lazy(() => import('./pages/StatsPage'));
const AnalysisPage = lazy(() => import('./pages/AnalysisPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const MatchDetailPage = lazy(() => import('./pages/MatchDetailPage'));
const AchievementsPage = lazy(() => import('./pages/AchievementsPage'));
const CastListPage = lazy(() => import('./pages/CastListPage'));
const CastPage = lazy(() => import('./pages/CastPage'));

function Loading() {
  return (
    <Box sx={{ display: 'grid', placeItems: 'center', height: '100dvh' }}>
      <CircularProgress />
    </Box>
  );
}

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/training" element={<TrainingPage />} />
        <Route path="/training/x01" element={<TrainingSetupPage />} />
        <Route path="/training/play/:mode" element={<TrainingPlayPage />} />
        <Route path="/training/builder" element={<TrainingBuilderPage />} />
        <Route path="/darts" element={<DartsPage />} />
        <Route path="/verwaltung" element={<VerwaltungPage />} />
        <Route path="/coach" element={<CoachPage />} />
        <Route path="/game/:id" element={<GamePage />} />
        <Route path="/tournament/new" element={<TournamentSetupPage />} />
        <Route path="/tournament/:id" element={<TournamentPage />} />
        <Route path="/players" element={<PlayersPage />} />
        <Route path="/players/:id" element={<PlayerStatsPage />} />
        <Route path="/players/:id/profile" element={<ProfilePage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/history/:id" element={<MatchDetailPage />} />
        <Route path="/achievements" element={<AchievementsPage />} />
        <Route path="/cast" element={<CastListPage />} />
        <Route path="/cast/:id" element={<CastPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
