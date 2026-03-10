import AsyncStorage from "@react-native-async-storage/async-storage";

export const WARSAFE_TCP_PORT = 57321;
const MESSAGES_KEY = "@warsafe:broadcast_messages";
const MAX_STORED = 200;

export const MESSAGE_PRIORITIES = {
  INFO: "info",
  WARNING: "warning",
  DANGER: "danger",
  EVACUATION: "evacuation",
};

function _makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function formatTimestamp(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function priorityMeta(priority) {
  switch (priority) {
    case MESSAGE_PRIORITIES.DANGER:
      return { color: "#dc2626", bg: "#fef2f2", icon: "🚨", label: "DANGER" };
    case MESSAGE_PRIORITIES.EVACUATION:
      return { color: "#ea580c", bg: "#fff7ed", icon: "🏃", label: "EVACUATE" };
    case MESSAGE_PRIORITIES.WARNING:
      return { color: "#d97706", bg: "#fffbeb", icon: "⚠️", label: "WARNING" };
    default:
      return { color: "#2563eb", bg: "#eff6ff", icon: "📢", label: "INFO" };
  }
}

export async function saveMessage(from, content, priority = MESSAGE_PRIORITIES.INFO) {
  const message = {
    id: _makeId(),
    from,
    content: content.trim(),
    priority,
    timestamp: Date.now(),
    read: false,
  };
  const existing = await getAllMessages();
  const updated = [message, ...existing].slice(0, MAX_STORED);
  await AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(updated));
  return message;
}

export async function getAllMessages() {
  try {
    const raw = await AsyncStorage.getItem(MESSAGES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function markRead(id) {
  const messages = await getAllMessages();
  const updated = messages.map((m) => (m.id === id ? { ...m, read: true } : m));
  await AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(updated));
}

export async function markAllRead() {
  const messages = await getAllMessages();
  const updated = messages.map((m) => ({ ...m, read: true }));
  await AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(updated));
}

export async function getUnreadCount() {
  const messages = await getAllMessages();
  return messages.filter((m) => !m.read).length;
}

export async function deleteMessage(id) {
  const messages = await getAllMessages();
  const updated = messages.filter((m) => m.id !== id);
  await AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(updated));
}

export async function clearAllMessages() {
  await AsyncStorage.removeItem(MESSAGES_KEY);
}
