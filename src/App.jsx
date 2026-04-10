import { useState, useCallback } from "react";
import JourneyView from "./components/JourneyView.jsx";
import LedgerTab from "./components/LedgerTab.jsx";
import BalancesTab from "./components/BalancesTab.jsx";
import PayoutPanel from "./components/PayoutPanel.jsx";
import {
  resetAll, getState, CURRENCIES,
  createJourney, CARD_TYPE,
} from "./engine/ledger.js";

const TABS = [
  { id: "journey", label: "01 · Card Journeys" },
  { id: "ledger",  label: "02 · Ledger Entries" },
  { id: "balances",label: "03 · Account Balances" },
];

export default function App() {
  const [tab, setTab] = useState("journey");
  const [tick, setTick] = useState(0); // force re-render after mutations
  const [activeJourneyId, setActiveJourneyId] = useState(null);
  const [showNewJourney, setShowNewJourney] = useState(false);
  const [newCardType, setNewCardType] = useState(CARD_TYPE.SINGLE);
  const [newCurrency, setNewCurrency] = useState("SEK");
  const [toast, setToast] = useState(null);

  const refresh = useCallback(() => setTick(t => t + 1), []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const state = getState();
  const journeys = Object.values(state.journeys);

  const handleStartJourney = () => {
    const { journeyId } = createJourney(newCardType, newCurrency);
    setActiveJourneyId(journeyId);
    setShowNewJourney(false);
    refresh();
    showToast(`Journey ${journeyId} started — ${newCardType}`);
  };

  const handleReset = () => {
    resetAll();
    setActiveJourneyId(null);
    setShowNewJourney(false);
    refresh();
    showToast("All data reset", "info");
  };

  const activeJourney = activeJourneyId ? state.journeys[activeJourneyId] : null;

  return (
    <div style={{ minHeight: "100vh", background: "#07080c", color: "#ddd8cc", fontFamily: "'DM Mono', monospace" }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=Syne:wght@700;800&display=swap" />

      {/* Header */}
      <header style={{ background: "#0d0f18", borderBottom: "1px solid #1e2030", padding: "0 28px", display: "flex", alignItems: "center", height: "56px", gap: "16px" }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: "17px", color: "#a78bfa", letterSpacing: "-0.3px" }}>LEDGER</div>
        <div style={{ width: "1px", height: "20px", background: "#1e2030" }} />
        <div style={{ fontSize: "10px", color: "#444", letterSpacing: "2px" }}>GIFT CARD SYSTEM · MODEL</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: "10px", alignItems: "center" }}>
          <span style={{ fontSize: "10px", color: "#444" }}>{journeys.length} journey{journeys.length !== 1 ? "s" : ""} · {state.entries.length} entries</span>
          <button onClick={handleReset} style={btnStyle("#3a1010", "#ef4444")}>RESET ALL</button>
        </div>
      </header>

      {/* Tabs */}
      <nav style={{ background: "#0d0f18", borderBottom: "1px solid #1e2030", padding: "0 28px", display: "flex", gap: "2px" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: "transparent", border: "none",
            borderBottom: tab === t.id ? "2px solid #a78bfa" : "2px solid transparent",
            color: tab === t.id ? "#a78bfa" : "#444", padding: "13px 16px",
            cursor: "pointer", fontSize: "11px", fontFamily: "inherit",
            letterSpacing: "1px", transition: "color 0.15s",
          }}>{t.label}</button>
        ))}
      </nav>

      <div style={{ padding: "24px 28px", maxWidth: "1280px", margin: "0 auto" }}>

        {/* ── JOURNEY TAB ── */}
        {tab === "journey" && (
          <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "20px" }}>

            {/* Sidebar — journey list */}
            <div>
              <button onClick={() => setShowNewJourney(true)}
                style={{ width: "100%", background: "#13102a", border: "1px solid #a78bfa44", color: "#a78bfa", padding: "11px", borderRadius: "7px", cursor: "pointer", fontSize: "11px", fontFamily: "inherit", letterSpacing: "1px", marginBottom: "14px" }}>
                + START NEW JOURNEY
              </button>

              {/* Payout standalone */}
              <PayoutPanel onDone={refresh} showToast={showToast} state={state} />

              <div style={{ marginTop: "14px" }}>
                {journeys.length === 0 && (
                  <div style={{ fontSize: "11px", color: "#333", textAlign: "center", padding: "32px 0" }}>No journeys yet</div>
                )}
                {journeys.map(j => (
                  <button key={j.id} onClick={() => setActiveJourneyId(j.id)}
                    style={{ width: "100%", background: activeJourneyId === j.id ? "#13102a" : "transparent", border: `1px solid ${activeJourneyId === j.id ? "#a78bfa55" : "#1e2030"}`, borderLeft: `3px solid ${j.cardType === CARD_TYPE.GROUP ? "#f59e0b" : "#3b82f6"}`, color: activeJourneyId === j.id ? "#ddd8cc" : "#666", padding: "10px 12px", cursor: "pointer", fontSize: "11px", fontFamily: "inherit", textAlign: "left", borderRadius: "5px", marginBottom: "5px", transition: "all 0.15s" }}>
                    <div style={{ fontWeight: 500, marginBottom: "3px" }}>{j.id}</div>
                    <div style={{ fontSize: "10px", color: "#555" }}>{j.cardType} · {j.currency}</div>
                    <div style={{ fontSize: "10px", color: "#444", marginTop: "2px" }}>{Object.keys(j.cards).length} card{Object.keys(j.cards).length > 1 ? "s" : ""}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Main content */}
            <div>
              {showNewJourney && (
                <NewJourneyPanel
                  cardType={newCardType} setCardType={setNewCardType}
                  currency={newCurrency} setCurrency={setNewCurrency}
                  onStart={handleStartJourney} onCancel={() => setShowNewJourney(false)}
                />
              )}
              {!showNewJourney && activeJourney && (
                <JourneyView journey={activeJourney} onUpdate={refresh} showToast={showToast} />
              )}
              {!showNewJourney && !activeJourney && (
                <div style={{ textAlign: "center", padding: "80px 0", color: "#333" }}>
                  <div style={{ fontSize: "28px", marginBottom: "10px", color: "#222" }}>◈</div>
                  <div style={{ fontSize: "11px", letterSpacing: "2px" }}>START A JOURNEY OR SELECT ONE FROM THE LEFT</div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "ledger" && <LedgerTab state={state} tick={tick} />}
        {tab === "balances" && <BalancesTab state={state} tick={tick} />}
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: "20px", right: "20px", background: toast.type === "error" ? "#1a0808" : toast.type === "info" ? "#0d0f18" : "#081a0d", border: `1px solid ${toast.type === "error" ? "#ef4444" : toast.type === "info" ? "#a78bfa" : "#22c55e"}`, color: toast.type === "error" ? "#ef4444" : toast.type === "info" ? "#a78bfa" : "#22c55e", padding: "11px 18px", borderRadius: "7px", fontSize: "11px", fontFamily: "inherit", zIndex: 999, maxWidth: "320px" }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function NewJourneyPanel({ cardType, setCardType, currency, setCurrency, onStart, onCancel }) {
  return (
    <div style={{ background: "#0d0f18", border: "1px solid #1e2030", borderTop: "2px solid #a78bfa", borderRadius: "8px", padding: "24px" }}>
      <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: "15px", marginBottom: "20px" }}>New Card Journey</div>

      <div style={{ marginBottom: "18px" }}>
        <div style={labelStyle}>Card Type</div>
        <div style={{ display: "flex", gap: "10px" }}>
          {Object.values(CARD_TYPE).map(ct => (
            <button key={ct} onClick={() => setCardType(ct)}
              style={{ flex: 1, padding: "12px", background: cardType === ct ? "#13102a" : "transparent", border: `1px solid ${cardType === ct ? "#a78bfa" : "#1e2030"}`, color: cardType === ct ? "#a78bfa" : "#555", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontFamily: "inherit", transition: "all 0.15s" }}>
              {ct === CARD_TYPE.SINGLE ? "⬡ Single Merchant" : "⬢ Group Card"}
            </button>
          ))}
        </div>
        <div style={{ marginTop: "8px", fontSize: "11px", color: "#444", lineHeight: 1.6 }}>
          {cardType === CARD_TYPE.GROUP ? "Group card can be swapped to multiple merchant cards. Swap event only available here." : "Single merchant card. Supports Redeem, Top-Up, Compensation, Expiry, Cancellation."}
        </div>
      </div>

      <div style={{ marginBottom: "22px" }}>
        <div style={labelStyle}>Currency</div>
        <select value={currency} onChange={e => setCurrency(e.target.value)} style={selectStyle}>
          {CURRENCIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div style={{ display: "flex", gap: "10px" }}>
        <button onClick={onStart} style={{ ...btnStyle("#13102a", "#a78bfa"), padding: "10px 24px", fontSize: "12px" }}>Start Journey →</button>
        <button onClick={onCancel} style={{ ...btnStyle("#111", "#555"), padding: "10px 18px", fontSize: "12px" }}>Cancel</button>
      </div>
    </div>
  );
}

export const labelStyle = { fontSize: "10px", color: "#555", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "7px" };
export const inputStyle = { background: "#07080c", border: "1px solid #1e2030", borderRadius: "5px", color: "#ddd8cc", padding: "9px 12px", fontSize: "12px", fontFamily: "'DM Mono', monospace", width: "100%", boxSizing: "border-box", outline: "none" };
export const selectStyle = { ...inputStyle, cursor: "pointer" };
export const btnStyle = (bg, border) => ({ background: bg, border: `1px solid ${border}`, color: border, padding: "8px 16px", borderRadius: "5px", cursor: "pointer", fontSize: "11px", fontFamily: "'DM Mono', monospace", letterSpacing: "1px", transition: "opacity 0.15s" });
