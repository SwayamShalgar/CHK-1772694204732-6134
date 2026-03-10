import AsyncStorage from "@react-native-async-storage/async-storage";

const SESSION_KEY = "@warsafe:session";

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

export async function saveSession(username, role) {
  const now = Date.now();
  const session = {
    username,
    role,
    loginTime: now,
    expiresAt: now + SESSION_DURATION_MS,
  };
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function getSession() {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (Date.now() >= session.expiresAt) {
      await AsyncStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export async function clearSession() {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export function sessionExpiryLabel(session) {
  if (!session) return "";
  const msLeft = Math.max(0, session.expiresAt - Date.now());
  const totalMinutes = Math.floor(msLeft / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `Session expires in ${hours}h ${minutes}m`;
  return `Session expires in ${minutes}m`;
}
