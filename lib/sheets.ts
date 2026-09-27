import { google } from "googleapis";

function googleCredentials() {
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  let email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let key = rawKey;

  // Vercel can safely store either the private-key value itself or the whole
  // downloaded service-account JSON credential. Supporting both avoids fragile
  // manual copying of a multi-line key.
  if (rawKey?.trim().startsWith("{")) {
    try {
      const credential = JSON.parse(rawKey) as { client_email?: string; private_key?: string };
      email ??= credential.client_email;
      key = credential.private_key;
    } catch {
      throw new Error("Google service-account JSON is not valid.");
    }
  }

  return { email, key: key?.replace(/\\n/g, "\n") };
}

function sheetsClient() {
  const { email, key } = googleCredentials();
  if (!email || !key) throw new Error("Google service-account settings are missing.");
  return google.sheets({ version: "v4", auth: new google.auth.JWT({ email, key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] }) });
}

/** Update by reference so decisions and retries never append a second transaction. */
export async function upsertSheetRow(tab: "Sales" | "Expenses", reference: string, values: (string | number)[]) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("Google spreadsheet ID is missing.");
  const sheets = sheetsClient();
  const existing = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${tab}!A:A` });
  const row = (existing.data.values ?? []).findIndex((value) => value[0] === reference) + 1;
  const range = `${tab}!A${row || (existing.data.values?.length ?? 1) + 1}`;
  await sheets.spreadsheets.values.update({ spreadsheetId, range, valueInputOption: "USER_ENTERED", requestBody: { values: [values] } });
}
