import { useState } from "react";
import { processPayout, PSPS, CURRENCIES } from "../engine/ledger.js";
import { labelStyle, inputStyle, selectStyle, btnStyle } from "../App.jsx";

export default function PayoutPanel({ onDone, showToast, state }) {
  const [open, setOpen] = useState(false);
  const [psp, setPsp] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("SEK");

  const submit = () => {
    if (!psp || !amount) { showToast("Fill all fields", "error"); return; }
    processPayout({ psp, amount: parseFloat(amount), currency });
    setPsp(""); setAmount(""); setOpen(false);
    onDone();
    showToast("Payout recorded ✓");
  };

  return (
    <div style={{ border: "1px solid #1e2030", borderLeft: "3px solid #8b5cf6", borderRadius: "5px", padding: "10px 12px" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ background: "transparent", border: "none", color: "#8b5cf6", fontSize: "11px", fontFamily: "inherit", cursor: "pointer", letterSpacing: "1px", padding: 0, width: "100%", textAlign: "left" }}>
        {open ? "▾" : "▸"} PAYOUT (PSP → BANK)
      </button>
      {open && (
        <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div>
            <div style={labelStyle}>PSP</div>
            <select value={psp} onChange={e => setPsp(e.target.value)} style={selectStyle}>
              <option value="">Select…</option>
              {PSPS.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <div style={labelStyle}>Amount</div>
            <input type="number" placeholder="e.g. 950" value={amount} onChange={e => setAmount(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>Currency</div>
            <select value={currency} onChange={e => setCurrency(e.target.value)} style={selectStyle}>
              {CURRENCIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <button onClick={submit} style={{ ...btnStyle("#120f2a", "#8b5cf6"), padding: "9px", fontSize: "11px", textAlign: "center" }}>
            POST PAYOUT →
          </button>
        </div>
      )}
    </div>
  );
}
