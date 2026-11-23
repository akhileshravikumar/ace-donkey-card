import { HOME_URL } from '../config';

const LINKS = [
  { label: 'All Games', href: `${HOME_URL}/` },
  { label: 'About us', href: `${HOME_URL}/about/` },
  { label: 'Bugs & Fixes', href: `${HOME_URL}/bugs/` },
];

/** The Turn Tables bar, the same as on the home page (apps/home). */
export function Header() {
  return (
    <header className="mx-30 mt-28 flex min-h-160 flex-wrap items-center gap-y-12 rounded-bar bg-bar pl-48 max-md:p-16">
      <a href={`${HOME_URL}/`} className="shrink-0">
        {/* Grey for now, like the wireframes; colours come later. */}
        <img
          src="/turn-tables-logo.svg"
          alt="Turn Tables"
          className="h-102 w-auto brightness-50 grayscale"
        />
      </a>
      <nav
        aria-label="Main"
        className="mr-281 ml-auto flex gap-148 text-w48 font-semibold max-md:mx-0 max-md:w-full max-md:justify-between max-md:gap-12 max-md:text-w30"
      >
        {LINKS.map((link) => (
          <a key={link.label} href={link.href} className="whitespace-nowrap">
            {link.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
