// ─── CONSTANTS ───────────────────────────────────────────────────────────────
export const PSPS = ["Nets Easy", "Mollie", "Gifted Invoice"];
export const CODE_PROVIDERS = ["Tillo", "Nets", "RUNA", "Weavr"];
export const CURRENCIES = ["SEK", "EUR", "USD", "GBP", "NOK", "DKK"];

export const CARD_TYPE = { SINGLE: "Single Merchant", GROUP: "Group Card" };
export const CARD_STATUS = { ACTIVE: "active", REDEEMED: "redeemed", EXPIRED: "expired", CANCELLED: "cancelled" };

export const ACCOUNT_TYPES = {
  CARD: "Card Account",
  PSP: "Payment Provider Account",
  CODE_PROVIDER: "Code Provider Account",
  BANK: "Bank Account",
  SYS_EXPENSE: "System Expense Account",
  SYS_INCOME: "System Income Account",
  SYS_SWAP: "System Swap Account",
  SYS_LV: "Loss & Void Account",
};

export const ACCOUNT_COLORS = {
  CARD: "#3b82f6", PSP: "#06b6d4", CODE_PROVIDER: "#14b8a6",
  BANK: "#8b5cf6", SYS_EXPENSE: "#ef4444", SYS_INCOME: "#22c55e",
  SYS_SWAP: "#f59e0b", SYS_LV: "#ec4899",
};

// ─── ID GENERATOR ────────────────────────────────────────────────────────────
export function generateCardId() {
  return String(Math.floor(1000000000 + Math.random() * 9000000000));
}

// ─── STATE ───────────────────────────────────────────────────────────────────
let accounts = {};
let entries = [];
let journeys = {};   // journeyId -> journey object
let entryCounter = 1;
let journeyCounter = 1;

export function getState() {
  return {
    accounts: { ...accounts },
    entries: [...entries],
    journeys: { ...journeys },
  };
}

export function resetAll() {
  accounts = {}; entries = []; journeys = {};
  entryCounter = 1; journeyCounter = 1;
}

// ─── ACCOUNT HELPERS ─────────────────────────────────────────────────────────
function acct(type, name, currency) {
  const key = `${type}||${name}||${currency}`;
  if (!accounts[key]) accounts[key] = { key, type, name, currency, balance: 0 };
  return accounts[key];
}

function post(journeyId, eventLabel, ref, accountKey, side, amount, note) {
  const a = accounts[accountKey];
  const delta = side === "DR" ? amount : -amount;
  a.balance = parseFloat((a.balance + delta).toFixed(4));
  const entry = {
    id: entryCounter++,
    journeyId, eventLabel, ref,
    accountKey, accountName: a.name, accountType: a.type,
    currency: a.currency, side, amount,
    balanceAfter: a.balance, note,
    timestamp: new Date().toISOString(),
  };
  entries.push(entry);
}

function ref(label) {
  return `${label}-${String(entryCounter).padStart(4, "0")}`;
}

// ─── JOURNEY MANAGEMENT ──────────────────────────────────────────────────────
export function createJourney(cardType, currency) {
  const id = `J${String(journeyCounter++).padStart(3, "0")}`;
  const cardId = generateCardId();
  journeys[id] = {
    id, cardType, currency,
    rootCardId: cardId,
    cards: {
      [cardId]: {
        cardId, type: cardType, status: CARD_STATUS.ACTIVE,
        balance: 0, originalValue: 0, psp: null,
        codeProvider: null, commissionRate: null,
        swappedAmount: 0, events: [],
      }
    },
    entries: [],
  };
  return { journeyId: id, cardId };
}

export function getJourney(id) { return journeys[id]; }
export function getAllJourneys() { return Object.values(journeys); }

function addCardEvent(journeyId, cardId, eventLabel, details) {
  const j = journeys[journeyId];
  j.cards[cardId].events.push({ eventLabel, details, timestamp: new Date().toISOString() });
  j.entries = entries.filter(e => e.journeyId === journeyId).map(e => e.id);
}

// ─── EVENT PROCESSORS ────────────────────────────────────────────────────────

export function processLoad({ journeyId, cardId, psp, cardValue, discountPct, currency }) {
  const j = journeys[journeyId];
  const discount = parseFloat((cardValue * discountPct / 100).toFixed(4));
  const pspAmount = parseFloat((cardValue - discount).toFixed(4));
  const r = ref("LOAD");

  const cardAcc = acct("CARD", `Card ${cardId}`, currency);
  const pspAcc = acct("PSP", `PSP: ${psp}`, currency);
  const expAcc = acct("SYS_EXPENSE", "System Expense", currency);

  post(journeyId, "Card Load", r, cardAcc.key, "DR", cardValue, `Card ${cardId} loaded`);
  post(journeyId, "Card Load", r, pspAcc.key, "CR", pspAmount, `Receivable from ${psp}`);
  post(journeyId, "Card Load", r, expAcc.key, "CR", discount, `Discount ${discountPct}% on load`);

  j.cards[cardId].balance = cardValue;
  j.cards[cardId].originalValue = cardValue;
  j.cards[cardId].psp = psp;
  addCardEvent(journeyId, cardId, "Card Load", { psp, cardValue, discountPct, pspAmount, discount });
}

export function processTopUp({ journeyId, cardId, psp, topUpAmount, currency }) {
  const j = journeys[journeyId];
  const r = ref("TOPUP");

  const cardAcc = acct("CARD", `Card ${cardId}`, currency);
  const pspAcc = acct("PSP", `PSP: ${psp}`, currency);

  post(journeyId, "Top-Up", r, cardAcc.key, "DR", topUpAmount, `Top-up for Card ${cardId}`);
  post(journeyId, "Top-Up", r, pspAcc.key, "CR", topUpAmount, `PSP receivable top-up ${psp}`);

  j.cards[cardId].balance = parseFloat((j.cards[cardId].balance + topUpAmount).toFixed(4));
  addCardEvent(journeyId, cardId, "Top-Up", { psp, topUpAmount });
}

export function processCompensation({ journeyId, cardId, amount, currency }) {
  const j = journeys[journeyId];
  const r = ref("COMP");

  const cardAcc = acct("CARD", `Card ${cardId}`, currency);
  const expAcc = acct("SYS_EXPENSE", "System Expense", currency);

  post(journeyId, "Compensation", r, cardAcc.key, "DR", amount, `Compensation for Card ${cardId}`);
  post(journeyId, "Compensation", r, expAcc.key, "CR", amount, `Internal compensation cost`);

  j.cards[cardId].balance = parseFloat((j.cards[cardId].balance + amount).toFixed(4));
  addCardEvent(journeyId, cardId, "Compensation", { amount });
}

export function processSwap({ journeyId, groupCardId, swapAmount, currency }) {
  const j = journeys[journeyId];
  const newCardId = generateCardId();
  const r = ref("SWAP");

  const groupCardAcc = acct("CARD", `Card ${groupCardId}`, currency);
  const swapAcc = acct("SYS_SWAP", "System Swap", currency);
  const newCardAcc = acct("CARD", `Card ${newCardId}`, currency);

  // Step 1: Group card → Swap intermediary
  post(journeyId, "Swap", r, groupCardAcc.key, "CR", swapAmount, `Swap out from group card ${groupCardId}`);
  post(journeyId, "Swap", r, swapAcc.key, "DR", swapAmount, `Swap intermediary holding`);
  // Step 2: Swap intermediary → New merchant card
  post(journeyId, "Swap", r, swapAcc.key, "CR", swapAmount, `Swap released to merchant card ${newCardId}`);
  post(journeyId, "Swap", r, newCardAcc.key, "DR", swapAmount, `Merchant card ${newCardId} funded`);

  j.cards[groupCardId].balance = parseFloat((j.cards[groupCardId].balance - swapAmount).toFixed(4));
  j.cards[groupCardId].swappedAmount = parseFloat(((j.cards[groupCardId].swappedAmount || 0) + swapAmount).toFixed(4));

  j.cards[newCardId] = {
    cardId: newCardId, type: CARD_TYPE.SINGLE, status: CARD_STATUS.ACTIVE,
    balance: swapAmount, originalValue: swapAmount,
    psp: null, codeProvider: null, commissionRate: null,
    swappedAmount: 0, parentCardId: groupCardId, events: [],
  };

  addCardEvent(journeyId, groupCardId, "Swap Out", { swapAmount, newCardId });
  addCardEvent(journeyId, newCardId, "Swap In", { swapAmount, fromCardId: groupCardId });

  return newCardId;
}

export function processRedeem({ journeyId, cardId, codeProvider, commissionPct, currency }) {
  const j = journeys[journeyId];
  const card = j.cards[cardId];
  const cardValue = card.balance;
  const codeCost = parseFloat((cardValue * (1 - commissionPct / 100)).toFixed(4));
  const margin = parseFloat((cardValue - codeCost).toFixed(4));
  const r = ref("REDEEM");

  const cardAcc = acct("CARD", `Card ${cardId}`, currency);
  const codeAcc = acct("CODE_PROVIDER", `Code Provider: ${codeProvider}`, currency);
  const incAcc = acct("SYS_INCOME", "System Income", currency);

  post(journeyId, "Redeem", r, cardAcc.key, "CR", cardValue, `Card ${cardId} redeemed`);
  post(journeyId, "Redeem", r, codeAcc.key, "DR", codeCost, `Code cost to ${codeProvider}`);
  post(journeyId, "Redeem", r, incAcc.key, "CR", margin, `Margin on redemption (${commissionPct}%)`);

  card.balance = 0;
  card.status = CARD_STATUS.REDEEMED;
  card.codeProvider = codeProvider;
  card.commissionRate = commissionPct;
  addCardEvent(journeyId, cardId, "Redeem", { codeProvider, commissionPct, cardValue, codeCost, margin });
}

export function processExpiry({ journeyId, cardId, currency }) {
  const j = journeys[journeyId];
  const card = j.cards[cardId];

  // Find original discount from load event
  const loadEvent = card.events.find(e => e.eventLabel === "Card Load");
  const discountPct = loadEvent?.details?.discountPct || 0;
  const cardValue = card.balance;
  const discount = parseFloat((card.originalValue * discountPct / 100).toFixed(4));
  const lvAmount = parseFloat((cardValue - discount).toFixed(4));
  const r = ref("EXPIRY");

  const cardAcc = acct("CARD", `Card ${cardId}`, currency);
  const expAcc = acct("SYS_EXPENSE", "System Expense", currency);
  const lvAcc = acct("SYS_LV", "Loss & Void", currency);

  post(journeyId, "Expiry", r, cardAcc.key, "CR", cardValue, `Card ${cardId} expired`);
  if (discount > 0) post(journeyId, "Expiry", r, expAcc.key, "DR", discount, `Expense reversal on expiry`);
  post(journeyId, "Expiry", r, lvAcc.key, "DR", lvAmount > 0 ? lvAmount : cardValue, `Loss & Void — expired balance`);

  card.balance = 0;
  card.status = CARD_STATUS.EXPIRED;
  addCardEvent(journeyId, cardId, "Expiry", { cardValue, discount, lvAmount });
}

export function processCancelRefund({ journeyId, cardId, psp, currency }) {
  const j = journeys[journeyId];
  const card = j.cards[cardId];
  const loadEvent = card.events.find(e => e.eventLabel === "Card Load" || e.eventLabel === "Swap In");
  const discountPct = loadEvent?.details?.discountPct || 0;
  const cardValue = card.balance;
  const discount = parseFloat((card.originalValue * discountPct / 100).toFixed(4));
  const pspAmount = parseFloat((cardValue - discount).toFixed(4));
  const r = ref("CANCEL");

  const cardAcc = acct("CARD", `Card ${cardId}`, currency);
  const pspAcc = acct("PSP", `PSP: ${psp}`, currency);
  const expAcc = acct("SYS_EXPENSE", "System Expense", currency);

  post(journeyId, "Cancellation (Refund)", r, cardAcc.key, "CR", cardValue, `Card ${cardId} cancelled`);
  post(journeyId, "Cancellation (Refund)", r, pspAcc.key, "DR", pspAmount, `Refund via ${psp}`);
  if (discount > 0) post(journeyId, "Cancellation (Refund)", r, expAcc.key, "DR", discount, `Expense reversal on cancel`);

  card.balance = 0;
  card.status = CARD_STATUS.CANCELLED;
  addCardEvent(journeyId, cardId, "Cancellation (Refund)", { psp, cardValue, pspAmount, discount });
}

export function processCancelReplacement({ journeyId, cardId, refundPsp, currency }) {
  const j = journeys[journeyId];
  const card = j.cards[cardId];
  const loadEvent = card.events.find(e => e.eventLabel === "Card Load");
  const discountPct = loadEvent?.details?.discountPct || 0;
  const cardValue = card.balance;
  const discount = parseFloat((card.originalValue * discountPct / 100).toFixed(4));
  const pspAmount = parseFloat((cardValue - discount).toFixed(4));
  const r = ref("CANCEL-REPL");

  const cardAcc = acct("CARD", `Card ${cardId}`, currency);
  const pspAcc = acct("PSP", `PSP: ${refundPsp}`, currency);
  const expAcc = acct("SYS_EXPENSE", "System Expense", currency);

  post(journeyId, "Cancellation (Replacement)", r, cardAcc.key, "CR", cardValue, `Card ${cardId} cancelled with replacement`);
  post(journeyId, "Cancellation (Replacement)", r, pspAcc.key, "DR", pspAmount, `Refund via replacement PSP ${refundPsp}`);
  if (discount > 0) post(journeyId, "Cancellation (Replacement)", r, expAcc.key, "DR", discount, `Expense reversal`);

  card.balance = 0;
  card.status = CARD_STATUS.CANCELLED;
  addCardEvent(journeyId, cardId, "Cancellation (Replacement)", { refundPsp, cardValue, pspAmount, discount });
}

export function processPayout({ psp, amount, currency }) {
  const r = ref("PAYOUT");
  const pspAcc = acct("PSP", `PSP: ${psp}`, currency);
  const bankAcc = acct("BANK", "Bank Account", currency);
  post(null, "Payout", r, pspAcc.key, "DR", amount, `Payout from ${psp}`);
  post(null, "Payout", r, bankAcc.key, "CR", amount, `Settled to bank`);
}

export function getBalanceSummary() {
  const grouped = {};
  Object.values(accounts).forEach(a => {
    if (!grouped[a.type]) grouped[a.type] = [];
    grouped[a.type].push(a);
  });
  return grouped;
}

export function getLedgerBalance() {
  return Object.values(accounts).reduce((s, a) => s + a.balance, 0);
}
