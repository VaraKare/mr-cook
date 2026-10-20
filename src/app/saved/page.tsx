import type { Metadata } from "next";
import { SavedList } from "@/components/SavedList";

export const metadata: Metadata = {
  title: "Saved recipes",
  description: "Recipes you saved on this device.",
  robots: { index: false },
};

export default function SavedPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-12">
      <p className="eyebrow">Saved on this device</p>
      <h1 className="mt-2 text-[clamp(2.2rem,6vw,3.6rem)] font-semibold">Your recipe box</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Saved recipes live in this browser only. There are no accounts, so clearing your browser data removes them.
      </p>
      <div className="mt-8">
        <SavedList />
      </div>
    </div>
  );
}
