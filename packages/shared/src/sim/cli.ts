/** `npm run sim -- [gamesPerCount] [seed]` — outcome statistics for random play. */
import { seededRng } from '../engine/rng';
import { simulateGame } from './simulate';

const games = Number(process.argv[2] ?? 20_000);
const seed = Number(process.argv[3] ?? Date.now() % 2 ** 31);
const rng = seededRng(seed);

console.log(`Simulating ${games} random games per player count (seed ${seed})\n`);
console.log('players | draws | 1 draw per | avg rounds | 3+-way draws');
for (let n = 3; n <= 7; n++) {
  const seats = Array.from({ length: n }, (_, i) => `P${i + 1}`);
  let draws = 0;
  let bigDraws = 0;
  let rounds = 0;
  for (let g = 0; g < games; g++) {
    const { final } = simulateGame(seats, rng);
    rounds += final.roundNo;
    if (final.result?.outcome === 'draw') {
      draws++;
      if ((final.placings.at(-1)?.length ?? 0) >= 3) bigDraws++;
    }
  }
  const per = draws ? Math.round(games / draws).toLocaleString() : '—';
  console.log(
    `${String(n).padStart(7)} | ${String(draws).padStart(5)} | ${per.padStart(10)} | ${(rounds / games).toFixed(1).padStart(10)} | ${bigDraws}`,
  );
}
