import { createApp } from './app';
import { loadConfig } from './config';
import { createLogger } from './logger';

const config = loadConfig();
const logger = createLogger(config.logLevel);
const app = createApp({ config, logger });

const port = await app.listen();
logger.info({ port, origins: config.clientOrigins }, 'ace-donkey server listening');

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    logger.info({ signal }, 'shutting down');
    void app.close().then(() => process.exit(0));
  });
}
