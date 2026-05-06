import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aurora — Investigation Boards for Narrative Universes",
  description:
    "An investigation-board framework for narrative universes. First instance: EVE Online lore.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-zinc-800 px-6 py-3 flex items-center justify-between">
          <a href="/" className="font-mono text-sm tracking-wide">aurora-arcology</a>
          <nav className="flex gap-4 text-sm font-mono text-zinc-400">
            <a href="/">boards</a>
            <a href="/sources">sources</a>
            <a href="/suggestions">suggestions</a>
            <a href="/audit">audit</a>
          </nav>
        </header>
        <main className="px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
