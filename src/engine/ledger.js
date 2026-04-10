// ─── ACCOUNT TYPES ───────────────────────────────────────────────────────────
export const ACCOUNT_TYPES = {
  CARD: 'Card Account',
  PSP: 'Payment Provider Account',
  CODE_PROVIDER: 'Code Provider Account',
  BANK: 'Bank Account',
  SYS_EXPENSE: 'System Expense Account',
  SYS_INCOME: 'System Income Account',
  SYS_SWAP: 'System Swap Account',
  SYS_LV: 'Loss & Void Account',
};

export const ACCOUNT_TYPE_COLORS = {
  CARD: '#2563eb',
  PSP: '#0891b2',
  CODE_PROVIDER: '#0d9488',
  BANK: '#7c3aed',
  SYS_EXPENSE: '#dc2626',
  SYS_INCOME: '#16a34a',
  SYS_SWAP: '#d97706',
  SYS_LV: '#be185d',
};

// ─── EVENT TYPES ─────────────────────────────────────────────────────────────
export const EVENT_TYPES = {
  LOAD: 'Card Load',
  LOAD_TOPUP: 'Card Top-Up',
  LOAD_COMPENSATION: 'Compensation Load',
  REDEEM: 'Redeem',
  SWAP_STEP1: 'Swap — Step 1 (Debit Group Card)',
  SWAP_STEP2: 'Swap — Step 2 (Credit Merchant Card)',
  EXPIRY: 'Card Expiry',
  CANCEL_REFUND: 'Cancellation with Refund',
  CANCEL_REPLACEMENT: 'Cancellation with Replacement',
  PAYOUT: 'Payout (PSP → Bank)',
};

// ─── LEDGER STATE ─────────────────────────────────────────────────────────────
let accounts = {};
let entries = [];
let entryIdCounter = 1;

export function getAccounts() { return { ...accounts }; }
export function getEntries() { return [...entries]; }

export function resetLedger() {
  accounts = {};
  entries = [];
  entryIdCounter = 1;
}

// ─── ACCOUNT MANAGEMENT ──────────────────────────────────────────────────────
export function getOrCreateAccount(type, name, currency = 'SEK') {
  const key = `${type}::${name}::${currency}`;
  if (!accounts[key]) {
    accounts[key] = { key, type, name, currency, balance: 0, createdAt: new Date().toISOString() };
  }
  return accounts[key];
}

function postEntry(eventType, eventRef, accountKey, side, amount, description) {
  const account = accounts[accountKey];
  const signed = side === 'DR' ? amount : -amount;
  account.balance += signed;
  const entry = {
    id: entryIdCounter++,
    timestamp: new Date().toISOString(),
    eventType,
    eventRef,
    accountKey,
    accountName: account.name,
    accountType: account.type,
    currency: account.currency,
    side,
    amount,
    balanceAfter: account.balance,
    description,
  };
  entries.push(entry);
  return entry;
}

// ─── EVENT PROCESSORS ────────────────────────────────────────────────────────

export function processLoad({ cardId, pspName, cardValue, discount, currency = 'SEK', ref }) {
  const expense = cardValue - (cardValue - discount); // = discount
  const pspAmount = cardValue - discount;

  const cardAcc = getOrCreateAccount('CARD', `Card: ${cardId}`, currency);
  const pspAcc = getOrCreateAccount('PSP', `PSP: ${pspName}`, currency);
  const expAcc = getOrCreateAccount('SYS_EXPENSE', 'System Expense', currency);

  postEntry(EVENT_TYPES.LOAD, ref, cardAcc.key, 'DR', cardValue, `Card loaded — ${cardId}`);
  postEntry(EVENT_TYPES.LOAD, ref, pspAcc.key, 'CR', pspAmount, `PSP receivable — ${pspName}`);
  postEntry(EVENT_TYPES.LOAD, ref, expAcc.key, 'CR', expense, `Load discount/expense`);
}

export function processTopUp({ cardId, pspName, topUpAmount, currency = 'SEK', ref }) {
  const cardAcc = getOrCreateAccount('CARD', `Card: ${cardId}`, currency);
  const pspAcc = getOrCreateAccount('PSP', `PSP: ${pspName}`, currency);

  postEntry(EVENT_TYPES.LOAD_TOPUP, ref, cardAcc.key, 'DR', topUpAmount, `Top-up — ${cardId}`);
  postEntry(EVENT_TYPES.LOAD_TOPUP, ref, pspAcc.key, 'CR', topUpAmount, `PSP receivable top-up — ${pspName}`);
}

export function processCompensation({ cardId, compensationAmount, currency = 'SEK', ref }) {
  const cardAcc = getOrCreateAccount('CARD', `Card: ${cardId}`, currency);
  const expAcc = getOrCreateAccount('SYS_EXPENSE', 'System Expense', currency);

  postEntry(EVENT_TYPES.LOAD_COMPENSATION, ref, cardAcc.key, 'DR', compensationAmount, `Compensation load — ${cardId}`);
  postEntry(EVENT_TYPES.LOAD_COMPENSATION, ref, expAcc.key, 'CR', compensationAmount, `Compensation cost — internal`);
}

export function processRedeem({ cardId, cardValue, codeProviderName, codeCost, currency = 'SEK', ref }) {
  const margin = cardValue - codeCost;

  const cardAcc = getOrCreateAccount('CARD', `Card: ${cardId}`, currency);
  const codeAcc = getOrCreateAccount('CODE_PROVIDER', `Code Provider: ${codeProviderName}`, currency);
  const incAcc = getOrCreateAccount('SYS_INCOME', 'System Income', currency);

  postEntry(EVENT_TYPES.REDEEM, ref, cardAcc.key, 'CR', cardValue, `Redemption — ${cardId}`);
  postEntry(EVENT_TYPES.REDEEM, ref, codeAcc.key, 'DR', codeCost, `Code cost — ${codeProviderName}`);
  postEntry(EVENT_TYPES.REDEEM, ref, incAcc.key, 'CR', margin, `Margin on redemption`);
}

export function processSwapStep1({ groupCardId, swapAmount, currency = 'SEK', ref }) {
  const cardAcc = getOrCreateAccount('CARD', `Card: ${groupCardId}`, currency);
  const swapAcc = getOrCreateAccount('SYS_SWAP', 'System Swap', currency);

  postEntry(EVENT_TYPES.SWAP_STEP1, ref, cardAcc.key, 'CR', swapAmount, `Swap initiated — debit group card ${groupCardId}`);
  postEntry(EVENT_TYPES.SWAP_STEP1, ref, swapAcc.key, 'DR', swapAmount, `Swap intermediary — holding ${swapAmount}`);
}

export function processSwapStep2({ merchantCardId, swapAmount, currency = 'SEK', ref }) {
  const swapAcc = getOrCreateAccount('SYS_SWAP', 'System Swap', currency);
  const cardAcc = getOrCreateAccount('CARD', `Card: ${merchantCardId}`, currency);

  postEntry(EVENT_TYPES.SWAP_STEP2, ref, swapAcc.key, 'CR', swapAmount, `Swap completed — releasing from intermediary`);
  postEntry(EVENT_TYPES.SWAP_STEP2, ref, cardAcc.key, 'DR', swapAmount, `Swap completed — credit merchant card ${merchantCardId}`);
}

export function processExpiry({ cardId, cardValue, discount, currency = 'SEK', ref }) {
  const cardAcc = getOrCreateAccount('CARD', `Card: ${cardId}`, currency);
  const expAcc = getOrCreateAccount('SYS_EXPENSE', 'System Expense', currency);
  const lvAcc = getOrCreateAccount('SYS_LV', 'Loss & Void', currency);
  const lvAmount = cardValue - discount;

  postEntry(EVENT_TYPES.EXPIRY, ref, cardAcc.key, 'CR', cardValue, `Card expired — ${cardId}`);
  postEntry(EVENT_TYPES.EXPIRY, ref, expAcc.key, 'DR', discount, `Expense reversal on expiry`);
  postEntry(EVENT_TYPES.EXPIRY, ref, lvAcc.key, 'DR', lvAmount, `Loss & Void — expired balance`);
}

export function processCancelRefund({ cardId, pspName, cardValue, discount, currency = 'SEK', ref }) {
  const cardAcc = getOrCreateAccount('CARD', `Card: ${cardId}`, currency);
  const pspAcc = getOrCreateAccount('PSP', `PSP: ${pspName}`, currency);
  const expAcc = getOrCreateAccount('SYS_EXPENSE', 'System Expense', currency);
  const pspAmount = cardValue - discount;

  postEntry(EVENT_TYPES.CANCEL_REFUND, ref, cardAcc.key, 'CR', cardValue, `Cancellation — card ${cardId}`);
  postEntry(EVENT_TYPES.CANCEL_REFUND, ref, pspAcc.key, 'DR', pspAmount, `Refund via PSP — ${pspName}`);
  postEntry(EVENT_TYPES.CANCEL_REFUND, ref, expAcc.key, 'DR', discount, `Expense reversal on cancellation`);
}

export function processCancelReplacement({ cancelCardId, refundPspName, cardValue, discount, currency = 'SEK', ref }) {
  const cancelCardAcc = getOrCreateAccount('CARD', `Card: ${cancelCardId}`, currency);
  const pspAcc = getOrCreateAccount('PSP', `PSP: ${refundPspName}`, currency);
  const expAcc = getOrCreateAccount('SYS_EXPENSE', 'System Expense', currency);
  const pspAmount = cardValue - discount;

  postEntry(EVENT_TYPES.CANCEL_REPLACEMENT, ref, cancelCardAcc.key, 'CR', cardValue, `Cancellation with replacement — card ${cancelCardId}`);
  postEntry(EVENT_TYPES.CANCEL_REPLACEMENT, ref, pspAcc.key, 'DR', pspAmount, `Refund applied via PSP — ${refundPspName}`);
  postEntry(EVENT_TYPES.CANCEL_REPLACEMENT, ref, expAcc.key, 'DR', discount, `Expense reversal on replacement cancel`);
}

export function processPayout({ pspName, payoutAmount, currency = 'SEK', ref }) {
  const pspAcc = getOrCreateAccount('PSP', `PSP: ${pspName}`, currency);
  const bankAcc = getOrCreateAccount('BANK', 'Bank Account', currency);

  postEntry(EVENT_TYPES.PAYOUT, ref, pspAcc.key, 'DR', payoutAmount, `Payout received — ${pspName}`);
  postEntry(EVENT_TYPES.PAYOUT, ref, bankAcc.key, 'CR', payoutAmount, `Settled to bank`);
}

// ─── BALANCE SUMMARY ─────────────────────────────────────────────────────────
export function getBalanceSummary() {
  const grouped = {};
  Object.values(accounts).forEach(acc => {
    if (!grouped[acc.type]) grouped[acc.type] = [];
    grouped[acc.type].push(acc);
  });
  return grouped;
}
