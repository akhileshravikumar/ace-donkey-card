/**
 * Auditability: every accepted action, game event and game result is recorded.
 * Today this writes structured log lines; a Supabase implementation can replace it later
 * without touching game code.
 */
import type { GameEvent, GameRecord, PlayerId } from '@ace/shared';
import type { Logger } from './logger';

export interface AuditSink {
  action(entry: {
    room: string;
    gameNo: number;
    actor: PlayerId;
    action: string;
    detail?: unknown;
  }): void;
  events(entry: { room: string; gameNo: number; events: GameEvent[] }): void;
  gameResult(entry: { room: string; record: GameRecord }): void;
}

export function createLogAuditSink(logger: Logger): AuditSink {
  const log = logger.child({ channel: 'audit' });
  return {
    action: (entry) => log.info(entry, 'action'),
    events: (entry) => log.info(entry, 'game-events'),
    gameResult: (entry) => log.info(entry, 'game-result'),
  };
}

export const nullAuditSink: AuditSink = { action() {}, events() {}, gameResult() {} };
