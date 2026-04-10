import { useState } from "react";
import {
  processLoad, processTopUp, processCompensation, processSwap,
  processRedeem, processExpiry, processCancelRefund, processCancelReplacement,
  PSPS, CODE_PROVIDERS, CARD_TYPE, CARD_STATUS,
} from "../engine/ledger.js";
import { labelStyle, inputStyle, selectStyle, btnStyle } from "../App.jsx";

const STATUS_COLOR = {
  active: "#22c55e", redeemed: "#3b82f6", expired: "#f59e0b", cancelled: "#ef4444",
};

const EVENT_COLOR = {
  load: "#a78bfa", topup: "#06b6d4", compensation: "#f59e0b",
  swap: "#f59e0b", redeem: "#22c55e", expiry: "#f59e0b",
  cancel_refund: "#ef4444", cancel_replacement: "#ec4899",
};

export default function JourneyView({ journey, onUpdate, showToast }) {
  const [activeCardId, setActiveCardId] = useState(journey.rootCardId);
  const [pendingAction, setPendingAction] = useState(null); // which action form is open
  const [cancelType, setCancelType] = useState(null); // "refund" | "replacement"
  const [form, setForm] = useState({});

  const { currency } = journey;
  const cards = journey.cards;
  const rootCard = cards[journey.rootCardId];
  const isGroup = journey.cardType === CARD_TYPE.GROUP;

  const card = cards[activeCardId];
  if (!card) return null;

  const isTerminal = [CARD_STATUS.REDEEMED, CARD_STATUS.EXPIRED, CARD_STATUS.CANCELLED].includes(card.status);
  const isLoaded = card.events.some(e => e.eventLabel === "Card Load" || e.eventLabel === "Swap In");

  const f = (k) => form[k] ?? "";
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const num = (k) => parseFloat(form[k]) || 0;

  const reset = () => { setPendingAction(null); setCancelType(null); setForm({}); };

  const submit = () => {
    try {
      if (pendingAction === "load") {
        if (!f("psp") || !f("cardValue") || !f("discountPct")) { showToast("Fill all fields", "error"); return; }
        processLoad({ journeyId: journey.id, cardId: activeCardId, psp: f("psp"), cardValue: num("cardValue"), discountPct: num("discountPct"), currency });
        showToast("Card loaded ✓");
      }
      else if (pendingAction === "topup") {
        if (!f("psp") || !f("topUpAmount")) { showToast("Fill all fields", "error"); return; }
        processTopUp({ journeyId: journey.id, cardId: activeCardId, psp: f("psp"), topUpAmount: num("topUpAmount"), currency });
        showToast("Top-up recorded ✓");
      }
      else if (pendingAction === "compensation") {
        if (!f("amount")) { showToast("Enter amount", "error"); return; }
        processCompensation({ journeyId: journey.id, cardId: activeCardId, amount: num("amount"), currency });
        showToast("Compensation recorded ✓");
      }
      else if (pendingAction === "swap") {
        if (!f("swapAmount")) { showToast("Enter swap amount", "error"); return; }
        if (num("swapAmount") > card.balance) { showToast("Swap amount exceeds card balance", "error"); return; }
        const newId = processSwap({ journeyId: journey.id, groupCardId: activeCardId, swapAmount: num("swapAmount"), currency });
        setActiveCardId(newId);
        showToast(`Merchant card created: ${newId}`);
      }
      else if (pendingAction === "redeem") {
        if (!f("codeProvider") || !f("commissionPct")) { showToast("Fill all fields", "error"); return; }
        processRedeem({ journeyId: journey.id, cardId: activeCardId, codeProvider: f("codeProvider"), commissionPct: num("commissionPct"), currency });
        showToast("Redemption recorded ✓");
      }
      else if (pendingAction === "expiry") {
        processExpiry({ journeyId: journey.id, cardId: activeCardId, currency });
        showToast("Expiry recorded ✓");
      }
      else if (pendingAction === "cancel") {
        if (cancelType === "refund") {
          if (!f("psp")) { showToast("Select PSP", "error"); return; }
          processCancelRefund({ journeyId: journey.id, cardId: activeCardId, psp: f("psp"), currency });
          showToast("Cancellation (Refund) recorded ✓");
        } else if (cancelType === "replacement") {
          if (!f("refundPsp")) { showToast("Select PSP", "error"); return; }
          processCancelReplacement({ journeyId: journey.id, cardId: activeCardId, refundPsp: f("refundPsp"), currency });
          showToast("Cancellation (Replacement) recorded ✓");
        } else { showToast("Select cancellation type", "error"); return; }
      }
      reset();
      onUpdate();
    } catch (e) {
      showToast("Error: " + e.message, "error");
    }
  };

  // Available next actions for current card
  const nextActions = () => {
    if (isTerminal) return [];
    if (!isLoaded) return ["load"];
    const actions = [];
    if (isGroup && card.status === CARD_STATUS.ACTIVE && card.balance > 0) actions.push("swap");
    if (!isGroup || (isGroup && card.type === CARD_TYPE.SINGLE)) {
      if (card.type !== CARD_TYPE.GROUP) actions.push("redeem");
    }
    actions.push("topup", "compensation", "expiry", "cancel");
    return actions;
  };

  const actionLabel = { load: "Load Card", topup: "Top-Up", compensation: "Compensation", swap: "Swap", redeem: "Redeem", expiry: "Expire Card", cancel: "Cancel Card" };
  const actionColor = { load: "#a78bfa", topup: "#06b6d4", compensation: "#f59e0b", swap: "#f59e0b", redeem: "#22c55e", expiry: "#f59e0b", cancel: "#ef4444" };

  const childCards = Object.values(cards).filter(c => c.parentCardId === activeCardId);

  return (
    <div>
      {/* Journey header */}
      <div style={{ background: "#0d0f18", border: "1px solid #1e2030", borderRadius: "8px", padding: "16px 20px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "16px" }}>
        <div>
          <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: "#a78bfa", fontSize: "15px" }}>{journey.id}</span>
          <span style={{ marginLeft: "10px", fontSize: "11px", color: "#444" }}>{journey.cardType} · {currency}</span>
        </div>
        <div style={{ marginLeft: "auto", fontSize: "11px", color: "#444" }}>
          {Object.keys(cards).length} card{Object.keys(cards).length > 1 ? "s" : ""} · {journey.entries?.length || 0} entries
        </div>
      </div>

      {/* Card tabs */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "16px", flexWrap: "wrap" }}>
        {Object.values(cards).map(c => (
          <button key={c.cardId} onClick={() => { setActiveCardId(c.cardId); reset(); }}
            style={{ background: activeCardId === c.cardId ? "#0d0f18" : "transparent", border: `1px solid ${activeCardId === c.cardId ? STATUS_COLOR[c.status] : "#1e2030"}`, borderRadius: "5px", color: activeCardId === c.cardId ? "#ddd8cc" : "#444", padding: "7px 12px", cursor: "pointer", fontSize: "10px", fontFamily: "inherit", letterSpacing: "0.5px", transition: "all 0.15s" }}>
            <div style={{ color: STATUS_COLOR[c.status], fontWeight: 500 }}>
              {c.parentCardId ? "↳ " : ""}{c.cardId}
            </div>
            <div style={{ fontSize: "9px", color: "#444", marginTop: "2px" }}>{c.type === CARD_TYPE.GROUP ? "GROUP" : "MERCHANT"} · {c.status.toUpperCase()}</div>
          </button>
        ))}
      </div>

      {/* Card detail */}
      <div style={{ background: "#0d0f18", border: `1px solid ${STATUS_COLOR[card.status]}33`, borderTop: `2px solid ${STATUS_COLOR[card.status]}`, borderRadius: "8px", padding: "20px" }}>

        {/* Card header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px" }}>
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: "14px", marginBottom: "4px" }}>
              {card.type === CARD_TYPE.GROUP ? "⬢" : "⬡"} Card {card.cardId}
            </div>
            <div style={{ fontSize: "10px", color: "#444" }}>
              {card.type} {card.parentCardId ? `· from swap of ${card.parentCardId}` : ""}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "22px", fontFamily: "'Syne',sans-serif", fontWeight: 800, color: card.balance > 0 ? "#ddd8cc" : "#333" }}>
              {new Intl.NumberFormat("sv-SE", { style: "currency", currency, maximumFractionDigits: 2 }).format(card.balance)}
            </div>
            <div style={{ fontSize: "10px", color: STATUS_COLOR[card.status], letterSpacing: "1px" }}>{card.status.toUpperCase()}</div>
          </div>
        </div>

        {/* Event history */}
        {card.events.length > 0 && (
          <div style={{ marginBottom: "18px" }}>
            <div style={labelStyle}>Event History</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {card.events.map((ev, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "7px 10px", background: "#07080c", borderRadius: "4px", fontSize: "11px" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: EVENT_COLOR[ev.eventLabel.toLowerCase().replace(/[^a-z]/g, "_").replace("cancellation__refund_", "cancel_refund").replace("cancellation__replacement_", "cancel_replacement")] || "#666", flexShrink: 0 }} />
                  <span style={{ color: "#888", flex: 1 }}>{ev.eventLabel}</span>
                  {ev.details?.cardValue && <span style={{ color: "#555" }}>{ev.details.cardValue} {currency}</span>}
                  {ev.details?.topUpAmount && <span style={{ color: "#555" }}>+{ev.details.topUpAmount} {currency}</span>}
                  {ev.details?.swapAmount && <span style={{ color: "#555" }}>{ev.details.swapAmount} {currency}</span>}
                  {ev.details?.newCardId && <span style={{ color: "#f59e0b", fontSize: "10px" }}>→ {ev.details.newCardId}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Next action buttons */}
        {!isTerminal && nextActions().length > 0 && (
          <div style={{ marginBottom: "16px" }}>
            <div style={labelStyle}>Next Action</div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {nextActions().map(a => (
                <button key={a} onClick={() => { setPendingAction(a); setCancelType(null); setForm({}); }}
                  style={{ background: pendingAction === a ? `${actionColor[a]}22` : "transparent", border: `1px solid ${pendingAction === a ? actionColor[a] : "#1e2030"}`, color: pendingAction === a ? actionColor[a] : "#555", padding: "8px 14px", borderRadius: "5px", cursor: "pointer", fontSize: "11px", fontFamily: "inherit", transition: "all 0.15s" }}>
                  {actionLabel[a]}
                </button>
              ))}
            </div>
          </div>
        )}

        {isTerminal && (
          <div style={{ padding: "14px", background: "#07080c", borderRadius: "6px", fontSize: "11px", color: "#444", textAlign: "center", letterSpacing: "1px" }}>
            JOURNEY ENDED · {card.status.toUpperCase()}
          </div>
        )}

        {/* Action form */}
        {pendingAction && (
          <div style={{ borderTop: "1px solid #1e2030", paddingTop: "18px", marginTop: "4px" }}>
            <div style={{ fontSize: "12px", color: actionColor[pendingAction], marginBottom: "16px", fontWeight: 500 }}>
              {actionLabel[pendingAction]}
            </div>

            {/* LOAD */}
            {pendingAction === "load" && (
              <div style={formGrid}>
                <Field label="Payment Provider">
                  <select value={f("psp")} onChange={e => setF("psp", e.target.value)} style={selectStyle}>
                    <option value="">Select PSP…</option>
                    {PSPS.map(p => <option key={p}>{p}</option>)}
                  </select>
                </Field>
                <Field label={`Card Value (${currency})`}>
                  <input type="number" placeholder="e.g. 500" value={f("cardValue")} onChange={e => setF("cardValue", e.target.value)} style={inputStyle} />
                </Field>
                <Field label="Discount %" hint="e.g. 5 means we receive 95% of face value">
                  <input type="number" placeholder="e.g. 5" min="0" max="100" value={f("discountPct")} onChange={e => setF("discountPct", e.target.value)} style={inputStyle} />
                </Field>
                {f("cardValue") && f("discountPct") && (
                  <Field label="Preview">
                    <div style={{ padding: "9px 12px", background: "#07080c", borderRadius: "5px", fontSize: "11px", color: "#666", lineHeight: 1.8 }}>
                      PSP receivable: <span style={{ color: "#ddd" }}>{(num("cardValue") * (1 - num("discountPct") / 100)).toFixed(2)} {currency}</span><br />
                      Expense: <span style={{ color: "#ef4444" }}>{(num("cardValue") * num("discountPct") / 100).toFixed(2)} {currency}</span>
                    </div>
                  </Field>
                )}
              </div>
            )}

            {/* TOP-UP */}
            {pendingAction === "topup" && (
              <div style={formGrid}>
                <Field label="Payment Provider">
                  <select value={f("psp")} onChange={e => setF("psp", e.target.value)} style={selectStyle}>
                    <option value="">Select PSP…</option>
                    {PSPS.map(p => <option key={p}>{p}</option>)}
                  </select>
                </Field>
                <Field label={`Top-Up Amount (${currency})`}>
                  <input type="number" placeholder="e.g. 50" value={f("topUpAmount")} onChange={e => setF("topUpAmount", e.target.value)} style={inputStyle} />
                </Field>
              </div>
            )}

            {/* COMPENSATION */}
            {pendingAction === "compensation" && (
              <div style={formGrid}>
                <Field label={`Compensation Amount (${currency})`} hint="Internal — no PSP. Full amount goes to expense.">
                  <input type="number" placeholder="e.g. 50" value={f("amount")} onChange={e => setF("amount", e.target.value)} style={inputStyle} />
                </Field>
              </div>
            )}

            {/* SWAP */}
            {pendingAction === "swap" && (
              <div style={formGrid}>
                <Field label={`Swap Amount (${currency})`} hint={`Available balance: ${card.balance} ${currency}`}>
                  <input type="number" placeholder={`max ${card.balance}`} max={card.balance} value={f("swapAmount")} onChange={e => setF("swapAmount", e.target.value)} style={inputStyle} />
                </Field>
                <Field label="What happens">
                  <div style={{ padding: "9px 12px", background: "#07080c", borderRadius: "5px", fontSize: "11px", color: "#666", lineHeight: 1.8 }}>
                    Group card debited {f("swapAmount") || "?"} {currency}<br />
                    New merchant card created with {f("swapAmount") || "?"} {currency}<br />
                    <span style={{ color: "#f59e0b" }}>New card ID will be auto-generated</span>
                  </div>
                </Field>
              </div>
            )}

            {/* REDEEM */}
            {pendingAction === "redeem" && (
              <div style={formGrid}>
                <Field label="Code Provider">
                  <select value={f("codeProvider")} onChange={e => setF("codeProvider", e.target.value)} style={selectStyle}>
                    <option value="">Select provider…</option>
                    {CODE_PROVIDERS.map(p => <option key={p}>{p}</option>)}
                  </select>
                </Field>
                <Field label="Commission %" hint="e.g. 5 means we keep 5%, pay provider 95%">
                  <input type="number" placeholder="e.g. 5" min="0" max="100" value={f("commissionPct")} onChange={e => setF("commissionPct", e.target.value)} style={inputStyle} />
                </Field>
                {f("commissionPct") && (
                  <Field label="Preview">
                    <div style={{ padding: "9px 12px", background: "#07080c", borderRadius: "5px", fontSize: "11px", color: "#666", lineHeight: 1.8 }}>
                      Card value: <span style={{ color: "#ddd" }}>{card.balance} {currency}</span><br />
                      Code cost to provider: <span style={{ color: "#ef4444" }}>{(card.balance * (1 - num("commissionPct") / 100)).toFixed(2)} {currency}</span><br />
                      Our margin (income): <span style={{ color: "#22c55e" }}>{(card.balance * num("commissionPct") / 100).toFixed(2)} {currency}</span>
                    </div>
                  </Field>
                )}
              </div>
            )}

            {/* EXPIRY */}
            {pendingAction === "expiry" && (
              <div style={{ padding: "14px", background: "#07080c", borderRadius: "6px", fontSize: "11px", color: "#666", lineHeight: 1.8, marginBottom: "12px" }}>
                Remaining balance <span style={{ color: "#ddd" }}>{card.balance} {currency}</span> will be written off to Loss &amp; Void.<br />
                Original load discount will be reversed from expense.<br />
                <span style={{ color: "#f59e0b" }}>This action cannot be undone.</span>
              </div>
            )}

            {/* CANCEL */}
            {pendingAction === "cancel" && (
              <div>
                <div style={{ marginBottom: "14px" }}>
                  <div style={labelStyle}>Cancellation Type</div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    {["refund", "replacement"].map(ct => (
                      <button key={ct} onClick={() => { setCancelType(ct); setForm({}); }}
                        style={{ flex: 1, padding: "10px", background: cancelType === ct ? "#1a0808" : "transparent", border: `1px solid ${cancelType === ct ? "#ef4444" : "#1e2030"}`, color: cancelType === ct ? "#ef4444" : "#555", borderRadius: "5px", cursor: "pointer", fontSize: "11px", fontFamily: "inherit" }}>
                        {ct === "refund" ? "Refund to Customer" : "Replace with New Card"}
                      </button>
                    ))}
                  </div>
                </div>
                {cancelType === "refund" && (
                  <div style={formGrid}>
                    <Field label="Refund via PSP" hint="Which PSP processes the refund?">
                      <select value={f("psp")} onChange={e => setF("psp", e.target.value)} style={selectStyle}>
                        <option value="">Select PSP…</option>
                        {PSPS.map(p => <option key={p}>{p}</option>)}
                      </select>
                    </Field>
                    <Field label="Preview">
                      <div style={{ padding: "9px 12px", background: "#07080c", borderRadius: "5px", fontSize: "11px", color: "#666", lineHeight: 1.8 }}>
                        Card balance cleared: <span style={{ color: "#ddd" }}>{card.balance} {currency}</span><br />
                        All load entries reversed.<br />
                        Refund issued via selected PSP.
                      </div>
                    </Field>
                  </div>
                )}
                {cancelType === "replacement" && (
                  <div style={formGrid}>
                    <Field label="Refund via PSP" hint="The PSP used for the replacement card">
                      <select value={f("refundPsp")} onChange={e => setF("refundPsp", e.target.value)} style={selectStyle}>
                        <option value="">Select PSP…</option>
                        {PSPS.map(p => <option key={p}>{p}</option>)}
                      </select>
                    </Field>
                    <Field label="Note">
                      <div style={{ padding: "9px 12px", background: "#07080c", borderRadius: "5px", fontSize: "11px", color: "#666", lineHeight: 1.8 }}>
                        This card will be cancelled.<br />
                        Refund routed via the replacement card's PSP.<br />
                        <span style={{ color: "#888" }}>The replacement card should be started as a new journey.</span>
                      </div>
                    </Field>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button onClick={submit}
                style={{ background: `${actionColor[pendingAction]}22`, border: `1px solid ${actionColor[pendingAction]}`, color: actionColor[pendingAction], padding: "9px 22px", borderRadius: "5px", cursor: "pointer", fontSize: "11px", fontFamily: "inherit", letterSpacing: "1px" }}>
                POST ENTRY →
              </button>
              <button onClick={reset} style={{ ...btnStyle("#111", "#333"), padding: "9px 16px", fontSize: "11px" }}>CANCEL</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <label style={labelStyle}>{label}</label>
      {hint && <div style={{ fontSize: "10px", color: "#444", marginBottom: "3px" }}>{hint}</div>}
      {children}
    </div>
  );
}

const formGrid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "4px" };
