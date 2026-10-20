import Link from "next/link";
import { Icon } from "@/components/Icon";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-start px-4 py-20 sm:px-6">
      <p className="eyebrow">404</p>
      <h1 className="mt-2 text-5xl font-semibold">This plate is empty.</h1>
      <p className="mt-4 text-lg text-muted">We couldn’t find that page. The recipe may have been renamed when the catalogue was refreshed.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/" className="btn btn-primary">
          <Icon name="spin" size={18} />
          Spin for something else
        </Link>
        <Link href="/cook/" className="btn btn-secondary">Search by ingredient</Link>
      </div>
    </div>
  );
}
