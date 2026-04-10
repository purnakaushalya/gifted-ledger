import { useState, useCallback } from "react";
import {
  processLoad, processTopUp, processCompensation,
  processRedeem, processSwapStep1, processSwapStep2,
  processExpiry, processCancelRefund, processCancelReplacement,
  processPayout, getEntries, getBalanceSummary, getAccounts,
  ACCOUNT_TYPES, ACCOUNT_TYPE_COLORS, EVENT_TYPES, resetLedger
} from "./engine/ledger.js";

const CURRENCIES = ["SEK", "EUR", "USD", "GBP", "NOK", "DKK"];

const EVENT_FIELDS = {
  LOAD: [
    { key: "cardId", label: "Card ID", placeholder: "e.g. GC-001" },
    { key: "pspName", label: "Payment Provider", placeholder: "e.g. Stripe" },
    { key: "cardValue", label: "Card Value", type: "number", placeholder: "100" },
    { key: "discount", label: "Discount (expense)", type: "number", placeholder: "5" },
  ],
  LOAD_TOPUP: [
    { key: "cardId", label: "Card ID", placeholder: "e.g. GC-001" },
    { key: "pspName", label: "Payment Provider", placeholder: "e.g. Stripe" },
    { key: "topUpAmount", label: "Top-Up Amount", type: "number", placeholder: "50" },
  ],
  LOAD_COMPENSATION: [
    { key: "cardId", label: "Card ID", placeholder: "e.g. GC-001" },
    { key: "compensationAmount", label: "Compensation Amount", type: "number", placeholder: "50" },
  ],
  REDEEM: [
    { key: "cardId", label: "Card ID", placeholder: "e.g. GC-001" },
    { key: "cardValue", label: "Card Value (face value)", type: "number", placeholder: "100" },
    { key: "codeProviderName", label: "Code Provider", placeholder: "e.g. Blackhawk" },
    { key: "codeCost", label: "Code Cost (what we pay)", type: "number", placeholder: "90" },
  ],
  SWAP_STEP1: [
    { key: "groupCardId", label: "Group Card ID", placeholder: "e.g. GC-GROUP-001" },
    { key: "swapAmount", label: "Swap Amount", type: "number", placeholder: "60" },
  ],
  SWAP_STEP2: [
    { key: "merchantCardId", label: "New Merchant Card ID", placeholder: "e.g. GC-MERCH-001" },
    { key: "swapAmount", label: "Swap Amount", type: "number", placeholder: "60" },
  ],
  EXPIRY: [
    { key: "cardId", label: "Card ID", placeholder: "e.g. GC-001" },
    { key: "cardValue", label: "Remaining Card Balance", type: "number", placeholder: "100" },
    { key: "discount", label: "Original Discount", type: "number", placeholder: "5" },
  ],
  CANCEL_REFUND: [
    { key: "cardId", label: "Card ID", placeholder: "e.g. GC-001" },
    { key: "pspName", label: "Payment Provider", placeholder: "e.g. Stripe" },
    { key: "cardValue", label: "Card Value", type: "number", placeholder: "100" },
    { key: "discount", label: "Original Discount", type: "number", placeholder: "5" },
  ],
  CANCEL_REPLACEMENT: [
    { key: "cancelCardId", label: "Card to Cancel ID", placeholder: "e.g. GC-001" },
    { key: "refundPspName", label: "Refund via PSP", placeholder: "e.g. Adyen" },
    { key: "cardValue", label: "Card Value", type: "number", placeholder: "100" },
    { key: "discount", label: "Original Discount", type: "number", placeholder: "5" },
  ],
  PAYOUT: [
    { key: "pspName", label: "Payment Provider", placeholder: "e.g. Stripe" },
    { key: "payoutAmount", label: "Payout Amount", type: "number", placeholder: "95" },
  ],
};

const EVENT_LABELS = {
  LOAD: "Card Load",
  LOAD_TOPUP: "Card Top-Up",
  LOAD_COMPENSATION: "Compensation Load",
  REDEEM: "Redeem",
  SWAP_STEP1: "Swap — Step 1",
  SWAP_STEP2: "Swap — Step 2",
  EXPIRY: "Card Expiry",
  CANCEL_REFUND: "Cancellation (Refund)",
  CANCEL_REPLACEMENT: "Cancellation (Replacement)",
  PAYOUT: "Payout",
};

const EVENT_COLORS = {
  LOAD: "#2563eb", LOAD_TOPUP: "#0284c7", LOAD_COMPENSATION: "#0891b2",
  REDEEM: "#16a34a", SWAP_STEP1: "#d97706", SWAP_STEP2: "#b45309",
  EXPIRY: "#be185d", CANCEL_REFUND: "#dc2626", CANCEL_REPLACEMENT: "#9f1239",
  PAYOUT: "#7c3aed",
};

const EVENT_DESCRIPTIONS = {
  LOAD: "Customer purchases a gift card. Creates a card account, records PSP receivable and discount expense.",
  LOAD_TOPUP: "Existing card receives additional funds via PSP. No discount applied.",
  LOAD_COMPENSATION: "Internal compensation added to card. Cost borne by the company — no PSP involved.",
  REDEEM: "Customer uses the card. Balance cleared, code provider payable recorded, margin recognized as income.",
  SWAP_STEP1: "Group card swap initiated. Chosen amount moved to intermediary Swap account.",
  SWAP_STEP2: "Merchant card selected. Swap account releases amount to new merchant card account.",
  EXPIRY: "Card expires with remaining balance. Balance written off to Loss & Void.",
  CANCEL_REFUND: "Card cancelled and full refund issued via PSP. All load entries reversed.",
  CANCEL_REPLACEMENT: "Card cancelled and replaced. Refund routed through replacement card's PSP.",
  PAYOUT: "PSP settles collected funds to our bank account.",
};

const processorsMap = {
  LOAD: processLoad, LOAD_TOPUP: processTopUp,
  LOAD_COMPENSATION: processCompensation, REDEEM: processRedeem,
  SWAP_STEP1: processSwapStep1, SWAP_STEP2: processSwapStep2,
  EXPIRY: processExpiry, CANCEL_REFUND: processCancelRefund,
  CANCEL_REPLACEMENT: processCancelReplacement, PAYOUT: processPayout,
};

let refCounter = 1;

export default function App() {
  const [tab, setTab] = useState("entry");
  const [selectedEvent, setSelectedEvent] = useState("LOAD");
  const [currency, setCurrency] = useState("SEK");
  const [formData, setFormData] = useState({});
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [balanceSummary, setBalanceSummary] = useState({});
  const [toast, setToast] = useState(null);
  const [filterEvent, setFilterEvent] = useState("ALL");
  const [filterAccount, setFilterAccount] = useState("ALL");

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSubmit = useCallback(() => {
    const fields = EVENT_FIELDS[selectedEvent];
    for (const f of fields) {
      if (!formData[f.key] && formData[f.key] !== 0) {
        showToast(`Please fill in: ${f.label}`, "error");
        return;
      }
    }
    const numFields = fields.filter(f => f.type === "number").map(f => f.key);
    const parsed = { ...formData, currency, ref: `REF-${String(refCounter++).padStart(4, "0")}` };
    numFields.forEach(k => { parsed[k] = parseFloat(parsed[k]); });

    try {
      processorsMap[selectedEvent](parsed);
      setLedgerEntries(getEntries());
      setBalanceSummary(getBalanceSummary());
      setFormData({});
      showToast(`✓ ${EVENT_LABELS[selectedEvent]} recorded successfully`);
    } catch (e) {
      showToast("Error processing transaction: " + e.message, "error");
    }
  }, [selectedEvent, formData, currency]);

  const handleReset = () => {
    resetLedger();
    setLedgerEntries([]);
    setBalanceSummary({});
    setFormData({});
    refCounter = 1;
    showToast("Ledger reset", "info");
  };

  const allAccountKeys = [...new Set(ledgerEntries.map(e => e.accountKey))];
  const filteredEntries = ledgerEntries.filter(e => {
    const matchEvent = filterEvent === "ALL" || e.eventType === EVENT_TYPES[filterEvent];
    const matchAccount = filterAccount === "ALL" || e.accountKey === filterAccount;
    return matchEvent && matchAccount;
  });

  const formatAmount = (n, currency) =>
    new Intl.NumberFormat("sv-SE", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f13", color: "#e8e6df", fontFamily: "'DM Mono', 'Courier New', monospace" }}>
      {/* Google Font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@400;600;700;800&display=swap" />

      {/* Header */}
      <header style={{ borderBottom: "1px solid #2a2a35", padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
          <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "20px", color: "#c8ff00", letterSpacing: "-0.5px" }}>LEDGER</span>
          <span style={{ fontSize: "11px", color: "#666", letterSpacing: "2px", textTransform: "uppercase" }}>Gift Card System · Model</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <select value={currency} onChange={e => setCurrency(e.target.value)}
            style={{ background: "#1a1a22", border: "1px solid #2a2a35", color: "#e8e6df", padding: "6px 12px", borderRadius: "6px", fontSize: "13px", fontFamily: "inherit" }}>
            {CURRENCIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <button onClick={handleReset}
            style={{ background: "transparent", border: "1px solid #3a1a1a", color: "#ef4444", padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontFamily: "inherit", letterSpacing: "1px" }}>
            RESET
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav style={{ borderBottom: "1px solid #2a2a35", padding: "0 32px", display: "flex", gap: "0" }}>
        {[["entry", "01 · Enter Transaction"], ["ledger", "02 · Ledger Entries"], ["balances", "03 · Account Balances"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ background: "transparent", border: "none", borderBottom: tab === id ? "2px solid #c8ff00" : "2px solid transparent", color: tab === id ? "#c8ff00" : "#666", padding: "14px 20px", cursor: "pointer", fontSize: "12px", fontFamily: "inherit", letterSpacing: "1px", fontWeight: tab === id ? 500 : 400, transition: "all 0.15s" }}>
            {label}
          </button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px", padding: "0 0 0 20px" }}>
          <span style={{ fontSize: "11px", color: "#444" }}>{ledgerEntries.length} entries</span>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: ledgerEntries.length > 0 ? "#c8ff00" : "#333" }} />
        </div>
      </nav>

      <main style={{ padding: "32px", maxWidth: "1200px", margin: "0 auto" }}>

        {/* ── TAB 1: ENTRY FORM ── */}
        {tab === "entry" && (
          <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "24px" }}>
            {/* Event selector */}
            <div>
              <div style={{ fontSize: "10px", color: "#555", letterSpacing: "2px", marginBottom: "12px" }}>SELECT EVENT TYPE</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {Object.entries(EVENT_LABELS).map(([key, label]) => (
                  <button key={key} onClick={() => { setSelectedEvent(key); setFormData({}); }}
                    style={{ background: selectedEvent === key ? "#1a1a22" : "transparent", border: `1px solid ${selectedEvent === key ? EVENT_COLORS[key] : "#2a2a35"}`, borderLeft: `3px solid ${selectedEvent === key ? EVENT_COLORS[key] : "transparent"}`, color: selectedEvent === key ? "#e8e6df" : "#666", padding: "10px 14px", cursor: "pointer", fontSize: "12px", fontFamily: "inherit", textAlign: "left", borderRadius: "4px", transition: "all 0.15s", lineHeight: 1.4 }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Form */}
            <div>
              <div style={{ background: "#1a1a22", border: `1px solid ${EVENT_COLORS[selectedEvent]}22`, borderTop: `2px solid ${EVENT_COLORS[selectedEvent]}`, borderRadius: "8px", padding: "28px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: EVENT_COLORS[selectedEvent] }} />
                  <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "16px" }}>{EVENT_LABELS[selectedEvent]}</span>
                </div>
                <p style={{ fontSize: "12px", color: "#666", marginBottom: "28px", lineHeight: 1.6 }}>{EVENT_DESCRIPTIONS[selectedEvent]}</p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  {EVENT_FIELDS[selectedEvent].map(field => (
                    <div key={field.key} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <label style={{ fontSize: "10px", color: "#888", letterSpacing: "1.5px", textTransform: "uppercase" }}>{field.label}</label>
                      <input
                        type={field.type || "text"}
                        placeholder={field.placeholder}
                        value={formData[field.key] ?? ""}
                        onChange={e => setFormData(d => ({ ...d, [field.key]: e.target.value }))}
                        style={{ background: "#0f0f13", border: "1px solid #2a2a35", borderRadius: "6px", color: "#e8e6df", padding: "10px 14px", fontSize: "13px", fontFamily: "inherit", outline: "none", transition: "border-color 0.15s" }}
                        onFocus={e => e.target.style.borderColor = EVENT_COLORS[selectedEvent]}
                        onBlur={e => e.target.style.borderColor = "#2a2a35"}
                      />
                    </div>
                  ))}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "10px", color: "#888", letterSpacing: "1.5px", textTransform: "uppercase" }}>Currency</label>
                    <div style={{ background: "#0f0f13", border: "1px solid #2a2a35", borderRadius: "6px", color: "#c8ff00", padding: "10px 14px", fontSize: "13px" }}>{currency}</div>
                  </div>
                </div>

                <button onClick={handleSubmit}
                  style={{ marginTop: "24px", background: EVENT_COLORS[selectedEvent], border: "none", color: "#fff", padding: "12px 28px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontFamily: "inherit", fontWeight: 500, letterSpacing: "1.5px", textTransform: "uppercase", transition: "opacity 0.15s" }}
                  onMouseOver={e => e.target.style.opacity = "0.85"}
                  onMouseOut={e => e.target.style.opacity = "1"}>
                  Post Journal Entry →
                </button>
              </div>

              {/* Quick guide */}
              <div style={{ marginTop: "20px", background: "#1a1a22", border: "1px solid #2a2a35", borderRadius: "8px", padding: "20px" }}>
                <div style={{ fontSize: "10px", color: "#555", letterSpacing: "2px", marginBottom: "12px" }}>DOUBLE-ENTRY PREVIEW</div>
                <div style={{ fontSize: "11px", color: "#666", lineHeight: 2 }}>
                  {selectedEvent === "LOAD" && <><span style={{ color: "#2563eb" }}>DR</span> Card Account (value) &nbsp;|&nbsp; <span style={{ color: "#dc2626" }}>CR</span> PSP Account (value − discount) &nbsp;|&nbsp; <span style={{ color: "#dc2626" }}>CR</span> Expense (discount)</>}
                  {selectedEvent === "LOAD_TOPUP" && <><span style={{ color: "#2563eb" }}>DR</span> Card Account (amount) &nbsp;|&nbsp; <span style={{ color: "#dc2626" }}>CR</span> PSP Account (amount)</>}
                  {selectedEvent === "LOAD_COMPENSATION" && <><span style={{ color: "#2563eb" }}>DR</span> Card Account (amount) &nbsp;|&nbsp; <span style={{ color: "#dc2626" }}>CR</span> Expense Account (amount)</>}
                  {selectedEvent === "REDEEM" && <><span style={{ color: "#dc2626" }}>CR</span> Card Account (face value) &nbsp;|&nbsp; <span style={{ color: "#2563eb" }}>DR</span> Code Provider (cost) &nbsp;|&nbsp; <span style={{ color: "#dc2626" }}>CR</span> Income (margin)</>}
                  {selectedEvent === "SWAP_STEP1" && <><span style={{ color: "#dc2626" }}>CR</span> Group Card (amount) &nbsp;|&nbsp; <span style={{ color: "#2563eb" }}>DR</span> Swap Account (amount)</>}
                  {selectedEvent === "SWAP_STEP2" && <><span style={{ color: "#dc2626" }}>CR</span> Swap Account (amount) &nbsp;|&nbsp; <span style={{ color: "#2563eb" }}>DR</span> Merchant Card (amount)</>}
                  {selectedEvent === "EXPIRY" && <><span style={{ color: "#dc2626" }}>CR</span> Card Account (value) &nbsp;|&nbsp; <span style={{ color: "#2563eb" }}>DR</span> Expense (reversal) &nbsp;|&nbsp; <span style={{ color: "#2563eb" }}>DR</span> L&V (remaining)</>}
                  {selectedEvent === "CANCEL_REFUND" && <><span style={{ color: "#dc2626" }}>CR</span> Card Account (value) &nbsp;|&nbsp; <span style={{ color: "#2563eb" }}>DR</span> PSP (refund) &nbsp;|&nbsp; <span style={{ color: "#2563eb" }}>DR</span> Expense (reversal)</>}
                  {selectedEvent === "CANCEL_REPLACEMENT" && <><span style={{ color: "#dc2626" }}>CR</span> Cancelled Card &nbsp;|&nbsp; <span style={{ color: "#2563eb" }}>DR</span> PSP (refund) &nbsp;|&nbsp; <span style={{ color: "#2563eb" }}>DR</span> Expense (reversal)</>}
                  {selectedEvent === "PAYOUT" && <><span style={{ color: "#2563eb" }}>DR</span> PSP Account (amount) &nbsp;|&nbsp; <span style={{ color: "#dc2626" }}>CR</span> Bank Account (amount)</>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: LEDGER ENTRIES ── */}
        {tab === "ledger" && (
          <div>
            <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontSize: "10px", color: "#555", letterSpacing: "2px", marginRight: "4px" }}>FILTER:</div>
              <select value={filterEvent} onChange={e => setFilterEvent(e.target.value)}
                style={{ background: "#1a1a22", border: "1px solid #2a2a35", color: "#e8e6df", padding: "7px 12px", borderRadius: "6px", fontSize: "12px", fontFamily: "inherit" }}>
                <option value="ALL">All Events</option>
                {Object.entries(EVENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select value={filterAccount} onChange={e => setFilterAccount(e.target.value)}
                style={{ background: "#1a1a22", border: "1px solid #2a2a35", color: "#e8e6df", padding: "7px 12px", borderRadius: "6px", fontSize: "12px", fontFamily: "inherit" }}>
                <option value="ALL">All Accounts</option>
                {allAccountKeys.map(k => <option key={k} value={k}>{k.split("::")[1]}</option>)}
              </select>
              <span style={{ marginLeft: "auto", fontSize: "11px", color: "#555" }}>{filteredEntries.length} of {ledgerEntries.length} entries</span>
            </div>

            {filteredEntries.length === 0 ? (
              <div style={{ textAlign: "center", padding: "80px 0", color: "#333" }}>
                <div style={{ fontSize: "32px", marginBottom: "12px" }}>—</div>
                <div style={{ fontSize: "12px", letterSpacing: "2px" }}>NO ENTRIES YET · POST A TRANSACTION FIRST</div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #2a2a35" }}>
                      {["#", "Ref", "Event", "Account", "Type", "DR", "CR", "Balance"].map(h => (
                        <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: "10px", color: "#555", letterSpacing: "1.5px", fontWeight: 400 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.map((entry, i) => (
                      <tr key={entry.id} style={{ borderBottom: "1px solid #1a1a22", background: i % 2 === 0 ? "transparent" : "#0d0d10" }}>
                        <td style={{ padding: "10px 12px", color: "#444" }}>{entry.id}</td>
                        <td style={{ padding: "10px 12px", color: "#666" }}>{entry.eventRef}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ background: `${EVENT_COLORS[Object.keys(EVENT_LABELS).find(k => EVENT_TYPES[k] === entry.eventType)] || "#666"}22`, color: EVENT_COLORS[Object.keys(EVENT_LABELS).find(k => EVENT_TYPES[k] === entry.eventType)] || "#666", padding: "2px 8px", borderRadius: "4px", fontSize: "10px", letterSpacing: "0.5px" }}>
                            {entry.eventType}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px", color: "#ccc" }}>{entry.accountName}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ color: ACCOUNT_TYPE_COLORS[entry.accountType] || "#888", fontSize: "10px" }}>{ACCOUNT_TYPES[entry.accountType]}</span>
                        </td>
                        <td style={{ padding: "10px 12px", color: "#4ade80", fontWeight: 500 }}>
                          {entry.side === "DR" ? formatAmount(entry.amount, entry.currency) : ""}
                        </td>
                        <td style={{ padding: "10px 12px", color: "#f87171", fontWeight: 500 }}>
                          {entry.side === "CR" ? formatAmount(entry.amount, entry.currency) : ""}
                        </td>
                        <td style={{ padding: "10px 12px", color: entry.balanceAfter >= 0 ? "#94a3b8" : "#f87171" }}>
                          {formatAmount(entry.balanceAfter, entry.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: ACCOUNT BALANCES ── */}
        {tab === "balances" && (
          <div>
            {Object.keys(balanceSummary).length === 0 ? (
              <div style={{ textAlign: "center", padding: "80px 0", color: "#333" }}>
                <div style={{ fontSize: "32px", marginBottom: "12px" }}>—</div>
                <div style={{ fontSize: "12px", letterSpacing: "2px" }}>NO ACCOUNTS YET · POST A TRANSACTION FIRST</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
                {Object.entries(balanceSummary).map(([type, accs]) => (
                  <div key={type}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                      <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: ACCOUNT_TYPE_COLORS[type] || "#888" }} />
                      <span style={{ fontSize: "10px", color: ACCOUNT_TYPE_COLORS[type] || "#888", letterSpacing: "2px", textTransform: "uppercase", fontWeight: 500 }}>{ACCOUNT_TYPES[type]}</span>
                      <span style={{ fontSize: "10px", color: "#444" }}>· {accs.length} account{accs.length > 1 ? "s" : ""}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "10px" }}>
                      {accs.map(acc => (
                        <div key={acc.key} style={{ background: "#1a1a22", border: `1px solid ${ACCOUNT_TYPE_COLORS[type]}33`, borderLeft: `3px solid ${ACCOUNT_TYPE_COLORS[type]}`, borderRadius: "6px", padding: "16px 18px" }}>
                          <div style={{ fontSize: "11px", color: "#666", marginBottom: "8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{acc.name}</div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                            <span style={{ fontSize: "18px", fontFamily: "'Syne', sans-serif", fontWeight: 700, color: acc.balance === 0 ? "#444" : acc.balance > 0 ? "#e8e6df" : "#f87171" }}>
                              {formatAmount(acc.balance, acc.currency)}
                            </span>
                            <span style={{ fontSize: "10px", color: "#444" }}>{acc.currency}</span>
                          </div>
                          <div style={{ marginTop: "6px", fontSize: "10px", color: acc.balance === 0 ? "#444" : acc.balance > 0 ? "#4ade80" : "#f87171" }}>
                            {acc.balance === 0 ? "ZERO" : acc.balance > 0 ? "▲ DEBIT BALANCE" : "▼ CREDIT BALANCE"}
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Group total */}
                    <div style={{ marginTop: "8px", textAlign: "right", fontSize: "11px", color: "#555" }}>
                      Group total: <span style={{ color: "#888" }}>{formatAmount(accs.reduce((s, a) => s + a.balance, 0), accs[0]?.currency)}</span>
                    </div>
                  </div>
                ))}

                {/* Grand total check */}
                <div style={{ borderTop: "1px solid #2a2a35", paddingTop: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "10px", color: "#555", letterSpacing: "2px" }}>LEDGER BALANCE CHECK</span>
                  <span style={{
                    fontSize: "14px", fontFamily: "'Syne', sans-serif", fontWeight: 700,
                    color: Math.abs(Object.values(getAccounts()).reduce((s, a) => s + a.balance, 0)) < 0.01 ? "#c8ff00" : "#ef4444"
                  }}>
                    {Math.abs(Object.values(getAccounts()).reduce((s, a) => s + a.balance, 0)) < 0.01
                      ? "✓ BALANCED"
                      : `⚠ OUT OF BALANCE: ${Object.values(getAccounts()).reduce((s, a) => s + a.balance, 0).toFixed(2)}`}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: "24px", right: "24px", background: toast.type === "error" ? "#3a1a1a" : toast.type === "info" ? "#1a1a2e" : "#1a2e1a", border: `1px solid ${toast.type === "error" ? "#ef4444" : toast.type === "info" ? "#3b82f6" : "#4ade80"}`, color: toast.type === "error" ? "#ef4444" : toast.type === "info" ? "#93c5fd" : "#4ade80", padding: "12px 20px", borderRadius: "8px", fontSize: "12px", fontFamily: "inherit", letterSpacing: "0.5px", zIndex: 100 }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
