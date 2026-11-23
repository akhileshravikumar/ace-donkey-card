import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { Header, type PageId } from './Header';
import { AllGames } from './pages/AllGames';
import { Placeholder } from './pages/Placeholder';

const PAGES: Record<PageId, () => React.JSX.Element> = {
  games: () => <AllGames />,
  about: () => <Placeholder title="About us" />,
  bugs: () => <Placeholder title="Bugs & Fixes" />,
};

// Each HTML file names its page on <body data-page="…">.
const page = (document.body.dataset.page ?? 'games') as PageId;
const Page = PAGES[page];

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Header current={page} />
    <Page />
  </StrictMode>,
);
