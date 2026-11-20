import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import { SERVER_URL } from './config';
import { defaultStore } from './lib/storage';
import { createSocketTransport } from './net/transport';
import { StoreProvider } from './state/context';
import { createGameStore } from './state/store';

const store = createGameStore(createSocketTransport(SERVER_URL), defaultStore());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider store={store}>
      <App />
    </StoreProvider>
  </StrictMode>,
);
