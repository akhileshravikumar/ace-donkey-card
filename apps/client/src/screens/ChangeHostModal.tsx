import { useGame } from '../state/context';
import { Avatar } from '../ui/Avatar';
import { Modal } from '../ui/Modal';

/** Host picks who becomes host (R23); the new host moves to the top of the seating order. */
export function ChangeHostModal({ onClose }: { onClose(): void }) {
  const room = useGame((s) => s.update!.room);
  const setHost = useGame((s) => s.setHost);
  const candidates = room.players.filter((p) => p.id !== room.hostId && p.connected);

  return (
    <Modal title="Change Host" onClose={onClose} className="w-640">
      {candidates.length === 0 ? (
        <p className="text-w30">There’s no one else connected to hand the host role to.</p>
      ) : (
        <ul className="space-y-24 py-8">
          {candidates.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  void setHost(p.id);
                  onClose();
                }}
                className="flex h-48 w-full items-center gap-16 rounded-pill bg-bar pr-24 pl-24 text-left text-w30 font-semibold hover:brightness-95"
              >
                <span className="flex-1 truncate">Make {p.name} host</span>
                <Avatar avatar={p.avatar} size={58} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
