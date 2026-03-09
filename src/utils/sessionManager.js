import AsyncStorage from "@react-native-async-storage/async-storage";

const SESSION_KEY = "@warsafe:session";

/** Session lasts 24 hours by default. */
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

// ─── SESSION SHAPE ────────────────────────────────────────────────────────────
// {
//   username : string
//   role     : "user" | "admin"
//   loginTime: number   (Date.now() at login)
//   expiresAt: number   (loginTime + SESSION_DURATION_MS)
// }

/**
 * Persist a login session to AsyncStorage.
 * Call immediately after a successful login.
 */
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

/**
 * Load the stored session.
 * Returns the session object if valid and not expired, otherwise null.
 * Automatically removes a stale session from storage.
 */
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

/**
 * Remove the stored session.
 * Call on explicit logout.
 */
export async function clearSession() {
  await AsyncStorage.removeItem(SESSION_KEY);
}

/**
 * Returns a human-readable label showing time remaining in the session,
 * e.g. "Session expires in 23h 45m".
 */
export function sessionExpiryLabel(session) {
  if (!session) return "";
  const msLeft = Math.max(0, session.expiresAt - Date.now());
  const totalMinutes = Math.floor(msLeft / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `Session expires in ${hours}h ${minutes}m`;
  return `Session expires in ${minutes}m`;
}
