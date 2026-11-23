/** A page that only has its title for now (About us, Bugs & Fixes). */
export function Placeholder({ title }: { title: string }) {
  return (
    <main className="px-120 pt-54 pb-54 max-md:px-[24px]">
      <h1 className="flex min-h-68 items-center text-title leading-none font-medium">{title}</h1>
    </main>
  );
}
