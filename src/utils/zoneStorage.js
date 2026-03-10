import AsyncStorage from "@react-native-async-storage/async-storage";

const ZONES_KEY = "@warsafe_custom_zones";

export async function getCustomZones() {
  try {
    const data = await AsyncStorage.getItem(ZONES_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveCustomZones(zones) {
  try {
    await AsyncStorage.setItem(ZONES_KEY, JSON.stringify(zones));
  } catch {}
}
