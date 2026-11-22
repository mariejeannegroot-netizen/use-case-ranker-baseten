"use client";

import { useState } from "react";

export default function Home() {
  const [context, setContext] = useState("");
  const [useCasesText, setUseCasesText] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function rank() {
    setLoading(true);
    setError("");
    setResults([]);

    const useCases = useCasesText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (!context.trim() || useCases.length === 0) {
      setError("Please fill in both fields");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/rank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerContext: context, useCases }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      setResults(data.ranked);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1 style={{ marginBottom: 8 }}>Most Interesting Use Case Ranker</h1>
      <p style={{ color: "#666", marginBottom: 32 }}>
        Paste customer context + possible use cases. Get them ranked by how interesting they are for this specific account.
      </p>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
          Customer Context
        </label>
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          rows={6}
          placeholder="e.g. Global bank. New Head of Digital started 4 months ago with cost reduction mandate..."
          style={{ width: "100%", padding: 12, fontSize: 15, borderRadius: 8, border: "1px solid #ccc" }}
        />
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
          Use Cases (one per line)
        </label>
        <textarea
          value={useCasesText}
          onChange={(e) => setUseCasesText(e.target.value)}
          rows={6}
          placeholder={`Real-time fraud detection
Automated invoice matching
Customer 360 view
AI credit decisioning`}
          style={{ width: "100%", padding: 12, fontSize: 15, borderRadius: 8, border: "1px solid #ccc" }}
        />
      </div>

      <button
        onClick={rank}
        disabled={loading}
        style={{
          padding: "12px 28px",
          fontSize: 16,
          fontWeight: 600,
          background: loading ? "#999" : "#000",
          color: "white",
          border: "none",
          borderRadius: 8,
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Ranking..." : "Rank Use Cases"}
      </button>

      {error && <p style={{ color: "crimson", marginTop: 20 }}>{error}</p>}

      {results.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <h2 style={{ marginBottom: 16 }}>Ranked Results</h2>
          {results.map((r, i) => (
            <div
              key={i}
              style={{
                border: "1px solid #e5e5e5",
                borderRadius: 10,
                padding: 16,
                marginBottom: 12,
                background: i === 0 ? "#f0fdf4" : "white",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: 17 }}>
                  #{i + 1} — {r.useCase}
                </strong>
                <span style={{ fontSize: 20, fontWeight: 700, color: i === 0 ? "#15803d" : "#333" }}>
                  {r.percent}%
                </span>
              </div>
              <p style={{ margin: "8px 0 0", color: "#555", fontSize: 14 }}>
                {r.why}
              </p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
