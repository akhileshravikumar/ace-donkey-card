export type PageId = 'games' | 'about' | 'bugs';

const LINKS: { page: PageId; label: string; href: string }[] = [
  { page: 'games', label: 'All Games', href: '/' },
  { page: 'about', label: 'About us', href: '/about/' },
  { page: 'bugs', label: 'Bugs & Fixes', href: '/bugs/' },
];

export function Header({ current }: { current: PageId }) {
  return (
    <header className="mx-30 mt-28 flex min-h-160 flex-wrap items-center gap-y-[12px] rounded-bar bg-bar pl-48 max-md:p-[16px]">
      <a href="/" className="shrink-0">
        <img src="/turn-tables-logo.svg" alt="Turn Tables" className="h-102 w-auto" />
      </a>
      <nav
        aria-label="Main"
        className="ml-auto mr-281 flex gap-148 text-nav font-semibold max-md:mx-0 max-md:w-full max-md:justify-between max-md:gap-[12px] max-md:text-[16px]"
      >
        {LINKS.map((link) => (
          <a
            key={link.page}
            href={link.href}
            aria-current={link.page === current ? 'page' : undefined}
            className="whitespace-nowrap"
          >
            {link.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
