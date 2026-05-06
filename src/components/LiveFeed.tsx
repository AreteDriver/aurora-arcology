"use client";

import { useEffect, useState } from "react";

interface LiveEvent {
  type: string;
  data: Record<string, unknown>;
  ts: string;
}

export default function LiveFeed() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource("/api/events");

    es.addEventListener("hello", () => setConnected(true));

    const types = ["source.added", "node.added", "connection.added", "scrape.progress", "ping"];
    for (const t of types) {
      es.addEventListener(t, (e: MessageEvent) => {
        try {
          const ev = JSON.parse(e.data) as LiveEvent;
          setEvents((prev) => [ev, ...prev].slice(0, 50));
        } catch {
          /* ignore malformed */
        }
      });
    }

    es.onerror = () => setConnected(false);

    return () => es.close();
  }, []);

  return (
    <div className="border border-zinc-800 p-3 font-mono text-xs">
      <div className="flex items-center justify-between mb-2">
        <span className="text-zinc-400 uppercase tracking-wide">Live feed</span>
        <span className={`flex items-center gap-1 ${connected ? "text-green-400" : "text-zinc-500"}`}>
          <span
            className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-green-400" : "bg-zinc-600"}`}
          />
          {connected ? "connected" : "disconnected"}
        </span>
      </div>
      {events.length === 0 ? (
        <div className="text-zinc-500 italic">
          waiting for events… (try: <code className="text-zinc-300">pnpm news:scrape --notify</code>)
        </div>
      ) : (
        <ul className="space-y-0.5 max-h-48 overflow-y-auto">
          {events.map((e, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-zinc-600">{e.ts.slice(11, 19)}</span>
              <span className="text-zinc-300 w-32 shrink-0">{e.type}</span>
              <span className="text-zinc-500 truncate">
                {JSON.stringify(e.data)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
