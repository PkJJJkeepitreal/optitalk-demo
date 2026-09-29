export type MessageStatus = "pending" | "spoken" | "interrupted" | "failed" | "text";
export type ConversationMessage = {
  id: string;
  role: "self" | "partner";
  text: string;
  createdAt: number;
  status: MessageStatus;
};
export type ConversationContext = { role: "self" | "partner"; text: string };

export const MAX_MESSAGES = 100;
export const MAX_MESSAGE_LENGTH = 500;

export function sanitizeMessages(value: unknown): ConversationMessage[] {
  if (!Array.isArray(value)) return [];
  const statuses = new Set(["pending", "spoken", "interrupted", "failed", "text"]);
  return value.filter((entry): entry is ConversationMessage =>
    !!entry && typeof entry === "object" &&
    typeof entry.id === "string" && entry.id.length <= 100 &&
    (entry.role === "self" || entry.role === "partner") &&
    typeof entry.text === "string" && !!entry.text.trim() &&
    typeof entry.createdAt === "number" && Number.isFinite(entry.createdAt) && entry.createdAt >= 0 && entry.createdAt <= 8.64e15 &&
    statuses.has(entry.status)
  ).slice(-MAX_MESSAGES).map(entry => ({
    id: entry.id, role: entry.role, text: entry.text.trim().slice(0, MAX_MESSAGE_LENGTH),
    createdAt: entry.createdAt,
    // A queued utterance cannot still be playing after a reload.
    status: entry.status === "pending" ? "interrupted" : entry.status,
  }));
}

export function sanitizeContext(value: unknown): ConversationContext[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is ConversationContext =>
    !!entry && typeof entry === "object" &&
    (entry.role === "self" || entry.role === "partner") &&
    typeof entry.text === "string" && !!entry.text.trim()
  ).slice(-6).map(entry => ({ role: entry.role, text: entry.text.trim().slice(0, MAX_MESSAGE_LENGTH) }));
}

export function getRecommendationContext(messages: ConversationMessage[]): ConversationContext[] {
  return sanitizeContext(messages.filter(entry => entry.status === "spoken" || entry.status === "text"));
}
