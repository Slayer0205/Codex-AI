import type { Knex } from "knex";
import type { NotificationAdapter } from "../adapters/telegram.js";
// At-most-once delivery: a process crash after claiming may leave `sending`.
// Do not blindly retry uncertain sends; an operator can create a new reminder.
export async function deliverQueued(db: Knex, adapter: NotificationAdapter) {
  const queue = await db("notifications")
    .where({ status: "queued" })
    .orderBy("createdAt")
    .limit(25);
  for (const n of queue) {
    const claimed = await db("notifications")
      .where({ id: n.id, status: "queued", organizationId: n.organizationId })
      .update({ status: "sending" });
    if (!claimed) continue;
    let recipient: string | undefined;
    if (n.customerId) {
      const c = await db("customers")
        .where({ id: n.customerId, organizationId: n.organizationId })
        .first();
      recipient = c?.telegramId;
    } else {
      const settings = await db("settings")
        .where({ organizationId: n.organizationId })
        .first();
      const value = settings ? JSON.parse(settings.value) : {};
      if (value.notifications === false) {
        await db("notifications")
          .where({ id: n.id, organizationId: n.organizationId })
          .update({ status: "disabled" });
        continue;
      }
      recipient = value.telegramId;
    }
    let status = "unconfigured";
    try {
      if (recipient) status = (await adapter.send(recipient, n.body)).status;
    } catch {
      status = "failed";
    }
    await db("notifications")
      .where({ id: n.id, organizationId: n.organizationId })
      .update({ status });
  }
}
