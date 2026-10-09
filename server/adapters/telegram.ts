export interface NotificationAdapter {
  send(chatId: string, text: string): Promise<{ status: string }>;
}
export class MockTelegramAdapter implements NotificationAdapter {
  async send(_chatId: string, _text: string) {
    return { status: "demo" };
  }
}
export class TelegramAdapter implements NotificationAdapter {
  constructor(private token: string) {}
  async send(chatId: string, text: string) {
    const response = await fetch(
      `https://api.telegram.org/bot${this.token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
        signal: AbortSignal.timeout(10000),
      },
    );
    const result = (await response.json()) as { ok: boolean };
    if (!response.ok || !result.ok)
      throw new Error("Telegram xabarni qabul qilmadi");
    return { status: "sent" };
  }
}
export const notificationAdapter = () =>
  process.env.TELEGRAM_BOT_TOKEN
    ? new TelegramAdapter(process.env.TELEGRAM_BOT_TOKEN)
    : new MockTelegramAdapter();
