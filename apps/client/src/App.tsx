import { useGame } from './state/context';
import { Home } from './components/Home';
import { RoomScreen } from './components/RoomScreen';
import { Button, cn } from './components/ui';

export function App() {
  const connection = useGame((s) => s.connection);
  const session = useGame((s) => s.session);
  const hasUpdate = useGame((s) => s.update !== null);
  const error = useGame((s) => s.error);
  const notice = useGame((s) => s.notice);
  const clearError = useGame((s) => s.clearError);

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface/60 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 lg:px-6">
          <h1 className="text-xl font-bold tracking-tight">
            Ace <span className="text-accent">Donkey</span>
          </h1>
          <span
            className={cn(
              'ml-auto inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs',
              connection === 'connected' ? 'text-muted' : 'text-accent',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'size-2 rounded-full',
                connection === 'connected' ? 'bg-ok' : 'animate-pulse bg-accent',
              )}
            />
            {connection === 'connected'
              ? 'Online'
              : connection === 'connecting'
                ? 'Connecting…'
                : 'Reconnecting…'}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 lg:px-6">
        {connection !== 'connected' && (
          <p
            role="status"
            className="mb-4 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2 text-sm text-accent"
          >
            {connection === 'connecting'
              ? 'Connecting to the server… (a sleeping free-tier server can take up to a minute to wake up)'
              : 'Connection lost — reconnecting. Your seat is held for 60 seconds.'}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="mb-4 rounded-lg border border-line bg-surface px-4 py-2 text-sm text-muted"
          >
            {notice}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mb-4 flex items-center gap-3 rounded-lg border border-danger/40 bg-danger/10 px-4 py-2 text-sm text-danger"
          >
            {error}
            <Button variant="ghost" className="ml-auto px-2 py-1" onClick={clearError}>
              Dismiss
            </Button>
          </p>
        )}
        {!session ? (
          <Home />
        ) : hasUpdate ? (
          <RoomScreen />
        ) : (
          <p className="text-muted">Joining room…</p>
        )}
      </main>
    </div>
  );
}
