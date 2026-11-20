import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import type { GameStore } from './store';

const StoreContext = createContext<StoreApi<GameStore> | null>(null);

export function StoreProvider({
  store,
  children,
}: {
  store: StoreApi<GameStore>;
  children: ReactNode;
}) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useGame<T>(selector: (state: GameStore) => T): T {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useGame must be used inside <StoreProvider>');
  return useStore(store, selector);
}
