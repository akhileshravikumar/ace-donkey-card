import { useGame } from './state/context';
import { Header } from './ui/Header';
import { Home } from './screens/Home';
import { RoomScreen } from './screens/RoomScreen';
import { CloseIcon } from './ui/icons';

export function App() {
  const connection = useGame((s) => s.connection);
  const session = useGame((s) => s.session);
  const hasUpdate = useGame((s) => s.update !== null);
  const error = useGame((s) => s.error);
  const notice = useGame((s) => s.notice);
  const clearError = useGame((s) => s.clearError);

  return (
    <>
      <Header />
      {/* Messages float over the page so they never push the game around. */}
      <div className="pointer-events-none fixed inset-x-0 top-200 z-[60] flex flex-col items-center gap-10 px-16 [&>*]:pointer-events-auto">
        {connection !== 'connected' && (
          <p
            role="status"
            className="rounded-pill bg-button px-28 py-12 text-w24 text-white shadow-lg"
          >
            {connection === 'connecting'
              ? 'Connecting to the server… (a sleeping server can take up to a minute to wake up)'
              : 'Connection lost — reconnecting. Your seat is held for 60 seconds.'}
          </p>
        )}
        {notice && (
          <p role="status" className="rounded-pill bg-bar px-28 py-12 text-w24 shadow-lg">
            {notice}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="flex items-center gap-16 rounded-pill bg-button py-12 pr-16 pl-28 text-w24 text-white shadow-lg"
          >
            {error}
            <button type="button" onClick={clearError} aria-label="Dismiss" className="p-4">
              <CloseIcon className="size-16" />
            </button>
          </p>
        )}
      </div>
      {!session ? (
        <Home />
      ) : hasUpdate ? (
        <RoomScreen />
      ) : (
        <p className="py-60 text-center text-w30 text-shade">Joining room…</p>
      )}
    </>
  );
}
