"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import type { SynthesisDoc } from "@/lib/synthesis";

interface Props {
  doc: SynthesisDoc;
  markdown: string;
  polishedMarkdown?: string | null;
}

type Mode = "polished" | "reading" | "markdown";

export default function SynthesisView({ doc, markdown, polishedMarkdown }: Props) {
  const hasPolished = !!polishedMarkdown;
  const [mode, setMode] = useState<Mode>(hasPolished ? "polished" : "reading");
  const [copied, setCopied] = useState(false);

  const activeText = mode === "polished" ? polishedMarkdown ?? markdown : markdown;

  const handleCopy = () => {
    navigator.clipboard.writeText(activeText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="max-w-4xl">
      <header className="mb-4 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold">{doc.lensTitle}</h1>
          <p className="text-xs text-zinc-500 font-mono mt-1">
            synthesis · spec §6 Tier 3 ·{" "}
            {mode === "polished" ? (
              <span className="text-purple-400">llm-rendered-prose · curator-reviewed</span>
            ) : (
              <span>curator-authored · source-grounded</span>
            )}
          </p>
        </div>
        <nav className="flex gap-3 font-mono text-sm">
          {hasPolished && (
            <button
              onClick={() => setMode("polished")}
              className={mode === "polished" ? "text-zinc-100" : "text-zinc-400 hover:text-zinc-100"}
              title="LLM-polished prose, curator-reviewed before publish"
            >
              polished
            </button>
          )}
          <button
            onClick={() => setMode("reading")}
            className={mode === "reading" ? "text-zinc-100" : "text-zinc-400 hover:text-zinc-100"}
            title="Curator's deterministic source-grounded outline"
          >
            curator
          </button>
          <button
            onClick={() => setMode("markdown")}
            className={mode === "markdown" ? "text-zinc-100" : "text-zinc-400 hover:text-zinc-100"}
            title="Raw markdown for copy-paste"
          >
            markdown
          </button>
          <button
            onClick={handleCopy}
            className="text-zinc-400 hover:text-zinc-100"
            title="Copy current view's markdown to clipboard"
          >
            {copied ? "copied ✓" : "copy"}
          </button>
        </nav>
      </header>

      <p className="text-sm text-zinc-400 mb-4 border-l-2 border-zinc-700 pl-3">
        {doc.lensDescription}
      </p>

      <p className="text-xs font-mono text-zinc-500 mb-6">
        {doc.sections.reduce((s, sec) => s + sec.entries.length, 0)} entities ·{" "}
        {doc.citations.length} unique sources cited ·{" "}
        {doc.citations.reduce((s, c) => s + c.refCount, 0)} citations total
        {hasPolished && mode === "polished" && (
          <span className="text-purple-400 ml-3">
            · LLM-paraphrased from curator notes; reviewed before publish
          </span>
        )}
      </p>

      {mode === "markdown" ? (
        <pre className="bg-zinc-950 border border-zinc-800 p-4 text-xs text-zinc-300 overflow-x-auto whitespace-pre-wrap font-mono">
          {activeText}
        </pre>
      ) : mode === "polished" ? (
        <article className="prose prose-invert prose-sm max-w-none prose-headings:font-bold prose-h2:border-b prose-h2:border-zinc-800 prose-h2:pb-1 prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline">
          <ReactMarkdown>{polishedMarkdown ?? markdown}</ReactMarkdown>
        </article>
      ) : (
        <article className="space-y-8">
          {doc.sections.map((sec) => (
            <section key={sec.type}>
              <h2 className="text-base font-bold mb-3 border-b border-zinc-800 pb-1">
                {sec.heading} <span className="text-xs font-mono text-zinc-500 ml-2">({sec.entries.length})</span>
              </h2>
              <div className="space-y-5">
                {sec.entries.map((e) => (
                  <div key={e.nodeId} className="border-l-2 border-zinc-800 pl-3">
                    <div className="flex items-baseline gap-2 mb-1">
                      <h3 className="font-bold text-sm">{e.name}</h3>
                      {e.date && (
                        <span className="text-xs font-mono text-zinc-500">({e.date})</span>
                      )}
                    </div>
                    {e.brief && <p className="text-xs text-zinc-300 leading-relaxed">{e.brief}</p>}
                    {e.masterSummary && (
                      <p className="text-xs text-zinc-400 leading-relaxed mt-2">{e.masterSummary}</p>
                    )}
                    {e.sources.length > 0 && (
                      <p className="text-xs font-mono text-zinc-600 mt-2">
                        cited in:{" "}
                        {e.sources.map((s, i) => (
                          <span key={s.id}>
                            {i > 0 && " · "}
                            <a
                              href={s.url ?? `/sources/${encodeURIComponent(s.id)}`}
                              target={s.url ? "_blank" : undefined}
                              rel={s.url ? "noopener noreferrer" : undefined}
                              className="text-zinc-400 hover:text-blue-400"
                            >
                              {s.title.length > 50 ? s.title.slice(0, 48) + "…" : s.title}
                            </a>
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}

          <section className="mt-12 border-t border-zinc-800 pt-6">
            <h2 className="text-base font-bold mb-3">Sources cited</h2>
            <ul className="space-y-1 text-xs">
              {doc.citations.map((c) => (
                <li key={c.id} className="font-mono">
                  <span className="text-zinc-500 inline-block w-10 text-right">{c.refCount}×</span>{" "}
                  <span className="text-zinc-500">{c.date ?? "—"}</span>{" "}
                  <a
                    href={c.url ?? `/sources/${encodeURIComponent(c.id)}`}
                    target={c.url ? "_blank" : undefined}
                    rel={c.url ? "noopener noreferrer" : undefined}
                    className="text-zinc-300 hover:text-blue-400"
                  >
                    {c.title}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </article>
      )}
    </div>
  );
}
