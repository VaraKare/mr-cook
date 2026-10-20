import Link from "next/link";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-20 border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm text-muted sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-2">
          <p className="font-display text-lg font-semibold text-ink">Mr. Cook</p>
          <p className="max-w-sm">
            Recipe data and imagery:{" "}
            <a className="underline underline-offset-2 hover:text-ink" href="https://www.themealdb.com/" rel="noopener" target="_blank">
              TheMealDB
            </a>
            . Videos belong to their creators on YouTube. Ingredient matching is a guide, not allergy or dietary advice.
          </p>
        </div>
        <nav aria-label="Footer">
          <ul className="space-y-2">
            <li><Link className="hover:text-ink" href="/">Spin the wheel</Link></li>
            <li><Link className="hover:text-ink" href="/cook/">Cook with what I have</Link></li>
            <li><Link className="hover:text-ink" href="/saved/">Saved recipes</Link></li>
          </ul>
        </nav>
        <ul className="space-y-2">
          <li><Link className="hover:text-ink" href="/about/">About the data</Link></li>
          <li><Link className="hover:text-ink" href="/about/#privacy">Privacy</Link></li>
          <li>© {year} Mr. Cook</li>
        </ul>
      </div>
    </footer>
  );
}
