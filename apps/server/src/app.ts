import { createServer, type Server as HttpServer } from 'node:http';
import express from 'express';
import helmet from 'helmet';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, Rng } from '@ace/shared';
import { type AuditSink, createLogAuditSink } from './audit';
import type { ServerConfig } from './config';
import type { Logger } from './logger';
import { RoomManager } from './rooms/RoomManager';
import { secureRng } from './security';
import { type AceServer, broadcastRoom, registerHandlers } from './transport';

export interface AppOptions {
  config: ServerConfig;
  logger: Logger;
  audit?: AuditSink;
  rng?: Rng;
}

export interface App {
  httpServer: HttpServer;
  io: AceServer;
  manager: RoomManager;
  listen(port?: number): Promise<number>;
  close(): Promise<void>;
}

export function createApp({ config, logger, audit, rng }: AppOptions): App {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.get('/health', (_req, res) => {
    res.json({ ok: true, rooms: manager.roomCount, uptime: Math.round(process.uptime()) });
  });

  const httpServer = createServer(app);
  const io: AceServer = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: config.clientOrigins },
    // Small payloads; compress anything larger for slow connections.
    perMessageDeflate: { threshold: 1024 },
    pingInterval: 10_000,
    pingTimeout: 10_000,
    maxHttpBufferSize: 10_000,
  });

  const manager = new RoomManager({
    rng: rng ?? secureRng,
    audit: audit ?? createLogAuditSink(logger),
    graceMs: config.disconnectGraceMs,
    roomIdleMs: config.roomIdleMs,
    onRoomChange: (room, events) => broadcastRoom(io, room, events),
    onRoomClosed: (room) => logger.info({ room: room.code }, 'room closed'),
  });
  registerHandlers(io, manager, logger, config.rateLimit);

  const sweeper = setInterval(() => manager.sweep(), 60_000);
  sweeper.unref();

  return {
    httpServer,
    io,
    manager,
    listen: (port = config.port) =>
      new Promise((resolve) => {
        httpServer.listen(port, () => {
          const address = httpServer.address();
          resolve(typeof address === 'object' && address ? address.port : port);
        });
      }),
    close: async () => {
      clearInterval(sweeper);
      manager.closeAll();
      await new Promise<void>((resolve) => io.close(() => resolve()));
    },
  };
}
