import { BOT_MESSAGE_TTL_MS } from "../game/constants.js";

export function scheduleMessageDeletion(message: { delete(): Promise<unknown> }, delay = BOT_MESSAGE_TTL_MS): void {
  setTimeout(() => {
    void message.delete().catch(() => undefined);
  }, delay);
}

export function scheduleReplyDeletion(interaction: { deleteReply(): Promise<unknown> }, delay = BOT_MESSAGE_TTL_MS): void {
  setTimeout(() => {
    void interaction.deleteReply().catch(() => undefined);
  }, delay);
}
