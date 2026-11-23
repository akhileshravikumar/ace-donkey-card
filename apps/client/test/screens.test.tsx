import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { CardId } from '@ace/shared';
import { Lobby } from '../src/screens/Lobby';
import { GameScreen } from '../src/screens/game/GameScreen';
import { ChatRoom } from '../src/screens/game/ChatRoom';
import { HandBar, type HandBarProps } from '../src/screens/game/HandBar';
import { Results } from '../src/screens/game/Results';
import { Scoreboard } from '../src/screens/game/Scoreboard';
import { RulesModal } from '../src/screens/RulesModal';
import { Avatar } from '../src/ui/Avatar';
import { gameView, player, record, roomView, setup } from './helpers';

describe('Lobby', () => {
  it('gives the host the host buttons and remove / move controls for other players', async () => {
    const user = userEvent.setup();
    const { transport, renderUi } = setup(roomView());
    renderUi(<Lobby />);

    const rows = within(screen.getByRole('list', { name: 'Seating order' })).getAllByRole(
      'listitem',
    );
    expect(rows.map((r) => r.dataset.player)).toEqual(['Me', 'Bob', 'Cleo']);
    expect(rows[0]!.textContent).toMatch(/host/);
    // The host row can't be removed or moved; everyone else can.
    expect(screen.queryByRole('button', { name: 'Remove Me' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Move Bob' })).toBeTruthy();

    const buttons = within(screen.getByRole('region', { name: 'Room' })).getAllByRole('button');
    expect(buttons.map((b) => b.textContent).filter((t) => t)).toEqual([
      'Start Game',
      'Rules',
      'Change Host',
      'Change Avatar',
      'Leave Room',
    ]);
    for (const name of ['Start Game', 'Rules', 'Change Host', 'Change Avatar', 'Leave Room'])
      expect(screen.getByRole('button', { name })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Remove Cleo' }));
    const dialog = screen.getByRole('dialog', { name: 'Remove Player' });
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));
    expect(transport.sentEvents('room:kick')).toEqual([{ playerId: 'cleo' }]);

    await user.click(screen.getByRole('button', { name: 'Start Game' }));
    expect(transport.sentEvents('game:start')).toHaveLength(1);
  });

  it('shows players only their own buttons, without host controls', () => {
    const { renderUi } = setup(roomView({ you: 'bob', canStart: false }));
    renderUi(<Lobby />);
    expect(screen.queryByRole('button', { name: 'Start Game' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Discard Room' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Remove|Move/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Change Avatar' })).toBeTruthy();
    expect(screen.getByText('Waiting for Me to start')).toBeTruthy();
  });

  it('puts the dotted crown on the last loser’s avatar and the spiky one on no one else', () => {
    const players = [
      player('me', { isHost: true, name: 'Me' }),
      player('bob', { isJoker: true, streak: 2 }),
      player('cleo'),
    ];
    const { container } = setup(roomView({ players })).renderUi(<Lobby />);
    const crowns = [...container.querySelectorAll('[data-crown]')].map((c) =>
      c.getAttribute('data-crown'),
    );
    expect(crowns).toEqual(['loser']);
    expect(screen.getByText(/lost last game/)).toBeTruthy();
  });

  it('changes the host from the Change Host dialog', async () => {
    const user = userEvent.setup();
    const { transport, renderUi } = setup(roomView());
    renderUi(<Lobby />);
    await user.click(screen.getByRole('button', { name: 'Change Host' }));
    await user.click(screen.getByRole('button', { name: 'Make Bob host' }));
    expect(transport.sentEvents('room:setHost')).toEqual([{ playerId: 'bob' }]);
  });

  it('customizes the face colour, glasses and mouth with the arrows, then saves on Done', async () => {
    const user = userEvent.setup();
    const { transport, store, renderUi } = setup(roomView());
    store.setState({
      session: { roomCode: 'ABCDEF', playerId: 'me', token: 't' },
      avatar: { face: 0, glasses: 3, mouth: 0 },
    });
    renderUi(<Lobby />);
    await user.click(screen.getByRole('button', { name: 'Change Avatar' }));
    const dialog = screen.getByRole('dialog', { name: 'Customize' });
    expect(within(dialog).getAllByRole('radio')).toHaveLength(6);
    await user.click(within(dialog).getByRole('radio', { name: 'Face colour 5' }));
    // Arrows wrap around: next from "no glasses" is the first option.
    await user.click(within(dialog).getByRole('button', { name: 'Next glasses' }));
    expect(within(dialog).getByText('Glasses: Small square glasses')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Previous mouth' }));
    expect(within(dialog).getByText('Mouth: Straight mouth')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));

    expect(store.getState().avatar).toEqual({ face: 4, glasses: 0, mouth: 2 });
    expect(transport.sentEvents('player:avatar')).toEqual([
      { avatar: { face: 4, glasses: 0, mouth: 2 } },
    ]);
  });

  it('Exit closes Customize without saving', async () => {
    const user = userEvent.setup();
    const { transport, store, renderUi } = setup(roomView());
    const before = store.getState().avatar;
    renderUi(<Lobby />);
    await user.click(screen.getByRole('button', { name: 'Change Avatar' }));
    await user.click(screen.getByRole('button', { name: 'Next mouth' }));
    await user.click(screen.getByRole('button', { name: 'Exit' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(store.getState().avatar).toEqual(before);
    expect(transport.sentEvents('player:avatar')).toEqual([]);
  });
});

describe('Modal', () => {
  it('closes the rules on Escape and on ✕', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<RulesModal onClose={onClose} />);
    expect(screen.getByRole('dialog', { name: 'Rules' })).toBeTruthy();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('Avatar', () => {
  it('draws the chosen parts and the right crown', () => {
    const { container, rerender } = render(
      <Avatar avatar={{ face: 5, glasses: 1, mouth: 0 }} size={68} crown="host" />,
    );
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('data-avatar')).toBe('510');
    expect(svg.querySelector('circle')!.getAttribute('fill')).toBe('var(--color-face-5)');
    expect(container.querySelector('[data-crown]')?.getAttribute('data-crown')).toBe('host');
    rerender(<Avatar avatar={{ face: 0, glasses: 2, mouth: 1 }} size={68} crown="loser" />);
    expect(container.querySelector('[data-crown]')?.getAttribute('data-crown')).toBe('loser');
    rerender(<Avatar avatar={{ face: 0, glasses: 2, mouth: 1 }} size={68} />);
    expect(container.querySelector('[data-crown]')).toBeNull();
  });
});

describe('HandBar', () => {
  const cards: CardId[] = ['AS', '7H', '2C'];
  function renderHand(extra: Partial<HandBarProps> = {}) {
    const props: HandBarProps = {
      name: 'Me',
      avatar: { face: 0, glasses: 0, mouth: 0 },
      crown: null,
      cards,
      playable: ['7H'],
      selected: null,
      isMyTurn: true,
      onSelect: vi.fn(),
      onPlay: vi.fn(),
      onPlaySelected: vi.fn(),
      onMoveSelection: vi.fn(),
      onMoveCard: vi.fn(),
      onSort: vi.fn(),
      ...extra,
    };
    render(<HandWithDnd {...props} />);
    return props;
  }
  // Same sensors as GameScreen: drags start after the pointer moves, so clicks stay clicks.
  function HandWithDnd(props: HandBarProps) {
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
    return (
      <DndContext sensors={sensors}>
        <HandBar {...props} />
      </DndContext>
    );
  }

  it('selects on click and plays on double-click', async () => {
    const user = userEvent.setup();
    const props = renderHand();
    const seven = screen.getByRole('button', { name: /7 of Hearts/ });
    await user.click(seven);
    expect(props.onSelect).toHaveBeenCalledWith('7H');
    await user.click(seven);
    expect(props.onPlay).toHaveBeenCalledWith('7H');
  });

  it('marks cards that can’t be played on your turn, and the selected card', () => {
    renderHand({ selected: '7H' });
    expect(
      screen.getByRole('button', { name: /Ace of Spades, cannot be played now/ }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /7 of Hearts/ }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('supports the keyboard: arrows select, Shift+arrows move, Enter plays, S sorts', async () => {
    const user = userEvent.setup();
    const props = renderHand({ selected: '7H' });
    screen.getByRole('button', { name: /7 of Hearts/ }).focus();
    await user.keyboard('{ArrowRight}');
    expect(props.onMoveSelection).toHaveBeenCalledWith(1);
    await user.keyboard('{Shift>}{ArrowLeft}{/Shift}');
    expect(props.onMoveCard).toHaveBeenCalledWith('7H', 0);
    await user.keyboard('{Enter}');
    expect(props.onPlaySelected).toHaveBeenCalled();
    await user.keyboard('s');
    expect(props.onSort).toHaveBeenCalled();
  });

  it('shows a message instead of cards when you are not in the game', () => {
    renderHand({ message: 'Waiting for the next game' });
    expect(screen.getByText('Waiting for the next game')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Your hand' })).toBeNull();
  });
});

describe('ChatRoom', () => {
  it('shows history and new messages, and sends what you type', async () => {
    const user = userEvent.setup();
    const { transport, renderUi } = setup(roomView({ phase: 'playing' }));
    act(() =>
      transport.listeners.onChatHistory([
        { id: 1, playerId: 'bob', name: 'Bob', text: 'hi all', at: 1 },
      ]),
    );
    renderUi(<ChatRoom />);
    act(() =>
      transport.listeners.onChatMessage({
        id: 2,
        playerId: 'me',
        name: 'Me',
        text: 'hey',
        at: 2,
      }),
    );
    const list = screen.getByRole('list', { name: 'Messages' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Bobhi all', 'hey']);

    expect(screen.getByRole('button', { name: 'Send' })).toHaveProperty('disabled', true);
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'good luck{Enter}');
    expect(transport.sentEvents('chat:send')).toEqual([{ text: 'good luck' }]);
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveProperty('value', '');
  });
});

describe('Results and scoreboard', () => {
  const finished = () => {
    const players = [
      player('me', { isHost: true, name: 'Me', inGame: true }),
      player('bob', { inGame: true }),
      player('cleo', { inGame: true, isJoker: true, streak: 2 }),
    ];
    const seats = ['me', 'bob', 'cleo'];
    const history = [
      record({ gameNo: 1, seats, loser: 'cleo', points: { me: 2, bob: 1, cleo: 0 } }),
      record({ gameNo: 2, seats, loser: 'cleo', points: { me: 1, bob: 2, cleo: 0 } }),
    ];
    const game = gameView({
      placings: [['bob'], ['me'], ['cleo']],
      loser: 'cleo',
      jokerId: 'cleo',
    });
    return roomView({ players, history, phase: 'gameOver', game });
  };

  it('shows the podium and goes back to the lobby', async () => {
    const user = userEvent.setup();
    const room = finished();
    const { store, renderUi } = setup(room);
    renderUi(<Results room={room} game={room.game!} />);
    const podium = screen.getByRole('list', { name: 'Podium' });
    expect(within(podium).getByRole('listitem', { name: 'Place 1' }).textContent).toMatch('Bob');
    expect(within(podium).getByRole('listitem', { name: 'Place 3' }).textContent).toMatch('Cleo');
    expect(screen.queryByRole('button', { name: 'Discard Room' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Back to Lobby' }));
    expect(store.getState().resultsClosedFor).toBe(2);
  });

  it('counts points, wins, losses and Aces per player', () => {
    const room = finished();
    const { container } = render(<Scoreboard room={room} />);
    const row = (name: string) => container.querySelector(`[data-player="${name}"]`)!;
    expect(row('Me').textContent).toMatch('Points 3Wins 2Losses 0');
    expect(row('Cleo').textContent).toMatch('Points 0Wins 0Losses 2');
    expect(row('Cleo').textContent).toMatch('2 Aces');
    expect(row('Cleo').textContent).toMatch('lost last game');
  });
});

describe('Take Cards (R5a)', () => {
  const cutRoom = (you: string) => {
    const players = [
      player('me', { isHost: true, name: 'Me', inGame: true }),
      player('bob', { inGame: true }),
      player('cleo', { inGame: true }),
    ];
    const game = gameView({
      you,
      hand: ['2C', '3D'],
      players: ['me', 'bob', 'cleo'].map((id) => ({ id, cardCount: 2, status: 'active' as const })),
      table: [
        { playerId: 'cleo', card: '5H' },
        { playerId: 'me', card: 'KH' },
        { playerId: 'bob', card: '4S' },
      ],
      ledSuit: 'H',
      turn: 'me',
      pendingCut: { cutBy: 'bob', pickerId: 'me' },
      mustTake: you === 'me',
    });
    return roomView({ you, players, phase: 'playing', game });
  };

  it('shows the picker a Take Cards button while the cut cards stay on the table', async () => {
    const user = userEvent.setup();
    const { transport, renderUi } = setup(cutRoom('me'));
    renderUi(<GameScreen showResults={false} />);
    const table = screen.getByRole('list', { name: 'Cards on the table' });
    expect(within(table).getAllByRole('listitem')).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Take Cards' }));
    expect(transport.sentEvents('game:take')).toHaveLength(1);
  });

  it('shows everyone else no button, only who has to take', () => {
    const { renderUi } = setup(cutRoom('bob'));
    renderUi(<GameScreen showResults={false} />);
    expect(screen.queryByRole('button', { name: 'Take Cards' })).toBeNull();
    expect(screen.getByText('Waiting for Me to take the cards.')).toBeTruthy();
  });
});
