import { useGame } from '../state/context';
import { GameScreen } from './game/GameScreen';
import { Lobby } from './Lobby';

/**
 * Playing → the game. Game over → the game with the Results overlay, until this player clicks
 * "Back to Lobby". Otherwise → the lobby.
 */
export function RoomScreen() {
  const phase = useGame((s) => s.update!.room.phase);
  const gamesPlayed = useGame((s) => s.update!.room.history.length);
  const resultsClosedFor = useGame((s) => s.resultsClosedFor);

  if (phase === 'playing') return <GameScreen showResults={false} />;
  if (phase === 'gameOver' && resultsClosedFor !== gamesPlayed) return <GameScreen showResults />;
  return <Lobby />;
}
