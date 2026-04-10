# Gift Card Ledger — Model Application

A prototype ledger system for modelling gift card transactions with double-entry bookkeeping.

## What this does

This application models how the system ledger should work for a digital gift card business. It supports 10 transaction event types across 8 scenarios:

| Event | Description |
|---|---|
| Card Load | Customer purchases a gift card via a PSP |
| Card Top-Up | Existing card topped up via PSP (no discount) |
| Compensation Load | Internal top-up — no PSP, cost to company |
| Redeem | Customer uses card; margin recognised at redemption |
| Swap — Step 1 | Group card balance moved to Swap intermediary |
| Swap — Step 2 | Swap intermediary releases to new merchant card |
| Card Expiry | Remaining balance written off to Loss & Void |
| Cancellation (Refund) | Card cancelled, full refund via PSP |
| Cancellation (Replacement) | Card cancelled, refund routed via replacement PSP |
| Payout | PSP settles collected funds to bank account |

## Account types

- **Card Account** — one per card ID, per currency
- **Payment Provider Account** — one per PSP, per currency
- **Code Provider Account** — one per provider, per currency
- **Bank Account** — one per currency
- **System Expense Account** — one per currency
- **System Income Account** — one per currency
- **System Swap Account** — intermediary for group card swaps
- **Loss & Void Account** — expired card balances

Each set of accounts is scoped to a single currency (SEK, EUR, USD, etc.).

---

## How to run this on GitHub (no coding needed)

### Step 1 — Create a GitHub account
Go to [github.com](https://github.com) and sign up for a free account if you don't have one.

### Step 2 — Create a new repository
1. Click the **+** button (top right) → **New repository**
2. Name it: `gift-card-ledger`
3. Set to **Public**
4. Click **Create repository**

### Step 3 — Upload the files
1. On your new repository page, click **uploading an existing file**
2. Drag and drop ALL the files and folders from this project
3. Click **Commit changes**

### Step 4 — Open GitHub Codespaces
1. On your repository page, click the green **Code** button
2. Click the **Codespaces** tab
3. Click **Create codespace on main**
4. Wait ~1 minute for it to open (it opens a full editor in your browser)

### Step 5 — Run the app
In the Codespaces terminal at the bottom, type these two commands one at a time:

```
npm install
npm run dev
```

5. A popup will appear saying "Open in browser" — click it
6. Your ledger app is now running!

### Step 6 — Publish to GitHub Pages (optional — makes it shareable)
In the terminal, run:
```
npm run build
```
Then go to your repository **Settings → Pages → Source → GitHub Actions** and follow the deploy steps.

---

## How to use the app

1. **Tab 1 — Enter Transaction**: Select an event type from the left panel, fill in the form fields, and click "Post Journal Entry"
2. **Tab 2 — Ledger Entries**: See every double-entry journal entry posted, filterable by event type or account
3. **Tab 3 — Account Balances**: See all account balances grouped by type, with a ledger balance check at the bottom (should always show BALANCED ✓)

The **currency selector** in the top right sets the currency for all new transactions. Switch currencies to work in multiple currencies — each gets its own set of accounts.

Use the **RESET** button to clear all entries and start fresh.
