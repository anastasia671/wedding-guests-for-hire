export async function sendTelegram(chatId: number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Telegram bot token is missing.");
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text })
  });
  if (!response.ok) throw new Error(`Telegram rejected the notification (${response.status}).`);
}
