# Friends Included finance system

This is the Day 4 wedding-guests-for-hire assignment implementation. It is a Next.js application: Supabase is the source of truth; Google Sheets receives readable synchronized Sales and Expenses tabs; Telegram receives submissions and notifications.

## Setup

1. Create a Supabase project. In **SQL Editor**, run [`db/schema.sql`](db/schema.sql).
2. Create a Google Sheet with tabs named `Sales` and `Expenses`. Put these headers in row 1:
   - Sales: `Reference,Submission time,Salesperson,Customer,Project,Description,Amount,Original split,Approved split,Richard earned,Anastasia earned,Jean-Claude earned,Status`
   - Expenses: `Reference,Submission time,Reporter,Description,Category,Amount,Proposed allocation,Final allocation,Status`
3. In Google Cloud, enable **Google Sheets API**, create a service account and key, and share the Sheet with the service account email as **Editor**.
4. Copy `.env.example` to `.env.local`; enter the Project URL, publishable key, and server-only secret key locally. Never commit this file.
5. Run `pnpm install` then `pnpm dev`.
6. Create a Telegram bot in BotFather, set `TELEGRAM_BOT_TOKEN` and a long random `TELEGRAM_WEBHOOK_SECRET`, then register `https://YOUR-VERCEL-URL/api/telegram/webhook` with Telegram's `setWebhook` API and the same secret token.

## Telegram test commands

First, select Svetlana in the website role selector and link your Telegram numeric user ID to the fake employee. Start the bot in a private chat. Then submit:

```text
/sale S01|Olivia Rose|A|One proud uncle and an emotional grandmother|1000|50|30|20
/expense E01|Rented suit and fake pearl necklace for the relatives|Materials|120|A
```

Only the manager can link a Telegram account. The bot saves the original chat ID with the transaction, so later notifications return to that chat even if the manager changes the user-to-role link.

## Assignment rules implemented

- Server-side roles, not just hidden controls.
- Pending sales excluded from income and commission results.
- 10% commission pool with deterministic cents rounding.
- Expenses reduce company result immediately; unallocated project expenses do not reduce a project result yet.
- Duplicate reference rejection; repeated approval is idempotent.
- Google Sheets retries update a row by reference instead of appending duplicates.
- Failed notification or Sheets delivery does not undo the financial decision.

## Before submitting

1. Clear practice data, then run Test 1 exactly as stated in the assignment.
2. Keep Test 1 data and run Test 2.
3. Check the listed expected totals, permissions, duplicate handling, sync retry, and notification failure behavior.
4. Push the repository to GitHub, import it in Vercel, enter the environment variables in Vercel, and share the Google Sheet with the instructor as Viewer.
5. Do **not** expose any private keys, the Telegram token, or service-account credentials.
