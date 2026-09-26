import { google } from "googleapis";

function sheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
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
