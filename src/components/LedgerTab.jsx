import { useState } from "react";
import { ACCOUNT_TYPES, ACCOUNT_COLORS } from "../engine/ledger.js";

const EVENT_COLORS = {
  "Card Load": "#a78bfa", "Top-Up": "#06b6d4", "Compensation": "#f59e0b",
  "Swap": "#f59e0b", "Redeem": "#22c55e", "Expiry": "#f59e0b",
  "Cancellation (Refund)": "#ef4444", "Cancellation (Replacement)": "#ec4899",
  "Payout": "#8b5cf6",
};

export default function LedgerTab({ state }) {
  const [filterEvent, setFilterEvent] = useState("ALL");
  const [filterJourney, setFilterJourney] = useState("ALL");

  const entries = state.entries;
  const uniqueEvents = [...new Set(entries.map(e => e.eventLabel))];
  const uniqueJourneys = [...new Set(entries.map(e => e.journeyId).filter(Boolean))];

  const filtered = entries.filter(e => {
    const me = filterEvent === "ALL" || e.eventLabel === filterEvent;
    const mj = filterJourney === "ALL" || e.journeyId === filterJourney;
    return me && mj;
  });

  const fmt = (n, cur) => new Intl.NumberFormat("sv-SE", { style: "currency", currency: cur, maximumFractionDigits: 2 }).format(n);

  return (
    <div>
      {/* Filters */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "18px", alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: "10px", color: "#444", letterSpacing: "1.5px" }}>FILTER:</span>
        <select value={filterJourney} onChange={e => setFilterJourney(e.target.value)}
          style={{ background: "#0d0f18", border: "1px solid #1e2030", color: "#ddd8cc", padding: "7px 12px", borderRadius: "5px", fontSize: "11px", fontFamily: "inherit" }}>
          <option value="ALL">All Journeys</option>
          {uniqueJourneys.map(j => <option key={j}>{j}</option>)}
          <option value="">Standalone (Payout)</option>
        </select>
        <select value={filterEvent} onChange={e => setFilterEvent(e.target.value)}
          style={{ background: "#0d0f18", border: "1px solid #1e2030", color: "#ddd8cc", padding: "7px 12px", borderRadius: "5px", fontSize: "11px", fontFamily: "inherit" }}>
          <option value="ALL">All Events</option>
          {uniqueEvents.map(e => <option key={e}>{e}</option>)}
        </select>
        <span style={{ marginLeft: "auto", fontSize: "10px", color: "#333" }}>{filtered.length} / {entries.length} entries</span>
      </div>

      {entries.length === 0 ? (
        <Empty />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1e2030" }}>
                {["#", "Journey", "Ref", "Event", "Account", "Account Type", "DR", "CR", "Balance After"].map(h => (
                  <th key={h} style={{ padding: "9px 10px", textAlign: "left", fontSize: "9px", color: "#444", letterSpacing: "1.5px", fontWeight: 400, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, i) => (
                <tr key={e.id} style={{ borderBottom: "1px solid #0d0f18", background: i % 2 === 0 ? "transparent" : "#0a0b10" }}>
                  <td style={{ padding: "9px 10px", color: "#333" }}>{e.id}</td>
                  <td style={{ padding: "9px 10px", color: "#555" }}>{e.journeyId || "—"}</td>
                  <td style={{ padding: "9px 10px", color: "#444", fontFamily: "monospace" }}>{e.ref}</td>
                  <td style={{ padding: "9px 10px" }}>
                    <span style={{ background: `${EVENT_COLORS[e.eventLabel] || "#666"}18`, color: EVENT_COLORS[e.eventLabel] || "#666", padding: "2px 7px", borderRadius: "3px", fontSize: "10px" }}>
                      {e.eventLabel}
                    </span>
                  </td>
                  <td style={{ padding: "9px 10px", color: "#aaa", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.accountName}</td>
                  <td style={{ padding: "9px 10px" }}>
                    <span style={{ color: ACCOUNT_COLORS[e.accountType] || "#666", fontSize: "10px" }}>{ACCOUNT_TYPES[e.accountType]}</span>
                  </td>
                  <td style={{ padding: "9px 10px", color: "#4ade80", fontWeight: 500 }}>
                    {e.side === "DR" ? fmt(e.amount, e.currency) : ""}
                  </td>
                  <td style={{ padding: "9px 10px", color: "#f87171", fontWeight: 500 }}>
                    {e.side === "CR" ? fmt(e.amount, e.currency) : ""}
                  </td>
                  <td style={{ padding: "9px 10px", color: e.balanceAfter < 0 ? "#f87171" : "#555" }}>
                    {fmt(e.balanceAfter, e.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Empty() {
  return (
    <div style={{ textAlign: "center", padding: "80px 0", color: "#222" }}>
      <div style={{ fontSize: "24px", marginBottom: "10px" }}>—</div>
      <div style={{ fontSize: "10px", letterSpacing: "2px" }}>NO ENTRIES YET · START A JOURNEY FIRST</div>
    </div>
  );
}
