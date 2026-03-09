import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const CREDENTIALS = {
  user: { username: "user", password: "user123" },
  admin: { username: "admin", password: "admin123" },
};

function LoginScreen({ onLogin }) {
  const [role, setRole] = useState("user");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = () => {
    const creds = CREDENTIALS[role];
    if (username.trim() === creds.username && password === creds.password) {
      onLogin(role, username.trim());
    } else {
      Alert.alert("Login Failed", "Invalid username or password.");
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.shieldIcon}>
            <Text style={styles.shieldText}>🛡️</Text>
          </View>
          <Text style={styles.appTitle}>WarSafe Network</Text>
          <Text style={styles.appSubtitle}>Secure Communication Platform</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign In</Text>

          <View style={styles.roleToggleContainer}>
            <TouchableOpacity
              style={[styles.roleButton, role === "user" && styles.roleButtonActive]}
              onPress={() => { setRole("user"); setUsername(""); setPassword(""); }}
            >
              <Text style={[styles.roleButtonText, role === "user" && styles.roleButtonTextActive]}>
                User
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleButton, role === "admin" && styles.roleButtonActiveAdmin]}
              onPress={() => { setRole("admin"); setUsername(""); setPassword(""); }}
            >
              <Text style={[styles.roleButtonText, role === "admin" && styles.roleButtonTextActive]}>
                Admin
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.roleBadge, role === "admin" ? styles.roleBadgeAdmin : styles.roleBadgeUser]}>
            <Text style={styles.roleBadgeText}>
              {role === "admin" ? "Administrator Access" : "User Access"}
            </Text>
          </View>

          <Text style={styles.inputLabel}>Username</Text>
          <TextInput
            style={styles.input}
            placeholder={`Enter ${role} username`}
            placeholderTextColor="#9ca3af"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.inputLabel}>Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Enter password"
              placeholderTextColor="#9ca3af"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
              <Text style={styles.eyeText}>{showPassword ? "🙈" : "👁️"}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.loginButton, role === "admin" ? styles.loginButtonAdmin : styles.loginButtonUser]}
            onPress={handleLogin}
            activeOpacity={0.85}
          >
            <Text style={styles.loginButtonText}>Sign In as {role === "admin" ? "Admin" : "User"}</Text>
          </TouchableOpacity>

          <Text style={styles.demoHint}>
            Demo — User: user / user123 · Admin: admin / admin123
          </Text>
        </View>

        <StatusBar style="light" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function DashboardScreen({ role, username, onLogout }) {
  const isAdmin = role === "admin";

  return (
    <View style={styles.dashContainer}>
      <View style={[styles.dashHeader, isAdmin ? styles.dashHeaderAdmin : styles.dashHeaderUser]}>
        <Text style={styles.dashWelcome}>Welcome back,</Text>
        <Text style={styles.dashName}>{username}</Text>
        <View style={styles.dashBadge}>
          <Text style={styles.dashBadgeText}>{isAdmin ? "🔑 Administrator" : "👤 User"}</Text>
        </View>
      </View>

      <ScrollView style={styles.dashContent} contentContainerStyle={{ padding: 20 }}>
        
        <Text style={styles.sectionTitle}>Quick Access</Text>
        <View style={styles.tileRow}>
          <View style={[styles.tile, { backgroundColor: "#eff6ff" }]}>
            <Text style={styles.tileIcon}>📡</Text>
            <Text style={styles.tileLabel}>Network Status</Text>
          </View>
          <View style={[styles.tile, { backgroundColor: "#f0fdf4" }]}>
            <Text style={styles.tileIcon}>🗺️</Text>
            <Text style={styles.tileLabel}>Map</Text>
          </View>
        </View>
        <View style={styles.tileRow}>
          <View style={[styles.tile, { backgroundColor: "#fff7ed" }]}>
            <Text style={styles.tileIcon}>📢</Text>
            <Text style={styles.tileLabel}>Alerts</Text>
          </View>
          <View style={[styles.tile, { backgroundColor: "#fdf4ff" }]}>
            <Text style={styles.tileIcon}>💬</Text>
            <Text style={styles.tileLabel}>Messages</Text>
          </View>
        </View>

      </ScrollView>

      <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      <StatusBar style="light" />
    </View>
  );
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [role, setRole] = useState(null);
  const [username, setUsername] = useState("");

  const handleLogin = (r, u) => {
    setRole(r);
    setUsername(u);
    setLoggedIn(true);
  };

  const handleLogout = () => {
    setLoggedIn(false);
    setRole(null);
    setUsername("");
  };

  if (loggedIn) {
    return <DashboardScreen role={role} username={username} onLogout={handleLogout} />;
  }
  return <LoginScreen onLogin={handleLogin} />;
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  shieldIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#1e3a5f",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#3b82f6",
  },
  shieldText: { fontSize: 36 },
  appTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#f8fafc",
    letterSpacing: 0.5,
  },
  appSubtitle: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 4,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#1e293b",
    borderRadius: 20,
    padding: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#f1f5f9",
    marginBottom: 20,
    textAlign: "center",
  },
  roleToggleContainer: {
    flexDirection: "row",
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  roleButtonActive: {
    backgroundColor: "#2563eb",
  },
  roleButtonActiveAdmin: {
    backgroundColor: "#7c3aed",
  },
  roleButtonText: {
    color: "#64748b",
    fontWeight: "600",
    fontSize: 14,
  },
  roleButtonTextActive: {
    color: "#fff",
  },
  roleBadge: {
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: "center",
    marginBottom: 20,
  },
  roleBadgeUser: { backgroundColor: "#1e3a5f" },
  roleBadgeAdmin: { backgroundColor: "#3b1f6e" },
  roleBadgeText: { color: "#c7d2fe", fontSize: 12, fontWeight: "600" },
  inputLabel: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    color: "#f1f5f9",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 14,
  },
  passwordContainer: {
    flexDirection: "row",
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    marginBottom: 24,
    alignItems: "center",
  },
  passwordInput: {
    flex: 1,
    color: "#f1f5f9",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  eyeBtn: { paddingHorizontal: 14 },
  eyeText: { fontSize: 18 },
  loginButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  loginButtonUser: { backgroundColor: "#2563eb" },
  loginButtonAdmin: { backgroundColor: "#7c3aed" },
  loginButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  demoHint: {
    color: "#475569",
    fontSize: 11,
    textAlign: "center",
  },

  dashContainer: { flex: 1, backgroundColor: "#f8fafc" },
  dashHeader: {
    paddingTop: Platform.OS === "android" ? 40 : 60,
    paddingBottom: 28,
    paddingHorizontal: 24,
  },
  dashHeaderUser: { backgroundColor: "#1d4ed8" },
  dashHeaderAdmin: { backgroundColor: "#6d28d9" },
  dashWelcome: { color: "#bfdbfe", fontSize: 14 },
  dashName: { color: "#fff", fontSize: 26, fontWeight: "800", marginTop: 2 },
  dashBadge: {
    marginTop: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
    alignSelf: "flex-start",
  },
  dashBadgeText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  dashContent: { flex: 1 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
  },
  tileRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  tile: {
    flex: 1,
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  tileIcon: { fontSize: 28, marginBottom: 8 },
  tileLabel: { fontSize: 13, fontWeight: "600", color: "#374151", textAlign: "center" },
  logoutButton: {
    margin: 20,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  logoutText: { color: "#ef4444", fontWeight: "700", fontSize: 15 },
});
