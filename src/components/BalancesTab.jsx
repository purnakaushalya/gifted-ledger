import { getBalanceSummary, getLedgerBalance, ACCOUNT_TYPES, ACCOUNT_COLORS } from "../engine/ledger.js";

export default function BalancesTab({ state, tick }) {
  const summary = getBalanceSummary();
  const totalBalance = getLedgerBalance();
  const isBalanced = Math.abs(totalBalance) < 0.01;

  const fmt = (n, cur) => new Intl.NumberFormat("sv-SE", { style: "currency", currency: cur, maximumFractionDigits: 2 }).format(n);

  if (Object.keys(summary).length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "80px 0", color: "#222" }}>
        <div style={{ fontSize: "24px", marginBottom: "10px" }}>—</div>
        <div style={{ fontSize: "10px", letterSpacing: "2px" }}>NO ACCOUNTS YET · POST A TRANSACTION FIRST</div>
      </div>
    );
  }

  return (
    <div>
      {/* Balance check banner */}
      <div style={{ background: isBalanced ? "#081a0d" : "#1a0808", border: `1px solid ${isBalanced ? "#22c55e44" : "#ef444444"}`, borderRadius: "7px", padding: "14px 18px", marginBottom: "22px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "10px", color: "#444", letterSpacing: "2px" }}>LEDGER BALANCE CHECK</span>
        <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: "14px", color: isBalanced ? "#22c55e" : "#ef4444" }}>
          {isBalanced ? "✓ BALANCED" : `⚠ OUT OF BALANCE: ${totalBalance.toFixed(4)}`}
        </span>
      </div>

      {/* Account groups */}
      {Object.entries(summary).map(([type, accs]) => {
        const groupTotal = accs.reduce((s, a) => s + a.balance, 0);
        const color = ACCOUNT_COLORS[type] || "#666";
        return (
          <div key={type} style={{ marginBottom: "28px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: color }} />
              <span style={{ fontSize: "10px", color, letterSpacing: "2px" }}>{ACCOUNT_TYPES[type]}</span>
              <span style={{ fontSize: "10px", color: "#333" }}>· {accs.length} account{accs.length !== 1 ? "s" : ""}</span>
              <span style={{ marginLeft: "auto", fontSize: "11px", color: "#444" }}>
                Total: <span style={{ color: groupTotal !== 0 ? "#888" : "#333" }}>{fmt(groupTotal, accs[0].currency)}</span>
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "8px" }}>
              {accs.map(acc => (
                <div key={acc.key} style={{ background: "#0d0f18", border: `1px solid ${color}22`, borderLeft: `3px solid ${color}`, borderRadius: "6px", padding: "14px 16px" }}>
                  <div style={{ fontSize: "10px", color: "#444", marginBottom: "8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={acc.name}>{acc.name}</div>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: "17px", color: acc.balance === 0 ? "#333" : acc.balance > 0 ? "#ddd8cc" : "#f87171" }}>
                    {fmt(acc.balance, acc.currency)}
                  </div>
                  <div style={{ marginTop: "5px", fontSize: "9px", letterSpacing: "1px", color: acc.balance === 0 ? "#333" : acc.balance > 0 ? "#4ade80" : "#f87171" }}>
                    {acc.balance === 0 ? "ZERO" : acc.balance > 0 ? "▲ DEBIT BAL" : "▼ CREDIT BAL"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
