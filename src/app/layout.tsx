import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Aurora — Investigation Boards for Narrative Universes",
  description:
    "An investigation-board framework for narrative universes. First instance: EVE Online lore.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-zinc-800 px-4 sm:px-6 py-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Link href="/" className="font-mono text-sm tracking-wide w-fit">
              aurora-arcology
            </Link>
            <nav className="flex flex-wrap gap-x-4 gap-y-2 text-xs sm:text-sm font-mono text-zinc-400">
              <Link href="/" className="hover:text-zinc-100">boards</Link>
              <Link href="/sources" className="hover:text-zinc-100">search</Link>
              <Link href="/sourcebook" className="hover:text-zinc-100">sourcebook</Link>
              <Link href="/curators" className="hover:text-zinc-100">curators</Link>
              <Link href="/suggestions" className="hover:text-zinc-100">suggestions</Link>
              <Link href="/analytics" className="hover:text-zinc-100">analytics</Link>
              <Link href="/market" className="hover:text-zinc-100">market</Link>
              <Link href="/audit" className="hover:text-zinc-100">audit</Link>
            </nav>
          </div>
        </header>
        <main className="px-4 sm:px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
