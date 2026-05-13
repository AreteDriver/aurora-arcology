import type { ReactNode } from "react";
import Link from "next/link";

type BoardViewId = "board" | "timeline" | "matrix" | "arcs";

interface BoardShellProps {
  boardId: string;
  boardTitle: string;
  curator: string;
  activeView: BoardViewId;
  subtitle?: string;
  metrics?: string;
  children: ReactNode;
}

const BOARD_VIEWS: Array<{
  id: BoardViewId;
  label: string;
  href: (boardId: string) => string;
}> = [
  { id: "board", label: "board", href: (boardId) => `/boards/${boardId}` },
  { id: "timeline", label: "timeline", href: (boardId) => `/boards/${boardId}/timeline` },
  { id: "matrix", label: "matrix", href: (boardId) => `/boards/${boardId}/matrix` },
  { id: "arcs", label: "arcs", href: (boardId) => `/boards/${boardId}/arcs` },
];

export default function BoardShell({
  boardId,
  boardTitle,
  curator,
  activeView,
  subtitle,
  metrics,
  children,
}: BoardShellProps) {
  return (
    <section className="space-y-4">
      <header className="rounded-md border border-zinc-800 bg-zinc-950/40 p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <nav
              className="mb-1 flex flex-wrap items-center gap-1 text-[10px] font-mono uppercase tracking-wide text-zinc-500"
              aria-label="Board breadcrumb"
            >
              <Link href="/" className="hover:text-zinc-200">
                boards
              </Link>
              <span>/</span>
              <Link href={`/boards/${boardId}`} className="hover:text-zinc-200">
                {boardId}
              </Link>
              <span>/</span>
              <span className="text-zinc-200">{activeView}</span>
            </nav>
            <h1 className="truncate text-2xl font-bold">{boardTitle}</h1>
            <p className="mt-1 text-xs font-mono text-zinc-500">
              curator: {curator}
              {subtitle ? ` · ${subtitle}` : ""}
              {metrics ? ` · ${metrics}` : ""}
            </p>
          </div>

          <nav className="flex flex-wrap gap-2 text-xs font-mono sm:text-sm" aria-label="Board views">
            {BOARD_VIEWS.map((view) => {
              const active = view.id === activeView;
              return active ? (
                <span
                  key={view.id}
                  className="rounded border border-zinc-100 bg-zinc-100 px-2 py-1 text-black"
                >
                  {view.label}
                </span>
              ) : (
                <Link
                  key={view.id}
                  href={view.href(boardId)}
                  className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                >
                  {view.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {children}
    </section>
  );
}
