import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { WebView } from "react-native-webview";
import {
  ActivityIndicator,
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
import {
  registerUserOnChain,
  validateLoginOnChain,
} from "./src/blockchain/blockchainService";
import {
  saveSession,
  getSession,
  clearSession,
  sessionExpiryLabel,
} from "./src/utils/sessionManager";

const SEED_USERS = {
  user: [{ username: "user", password: "user123" }],
  admin: [{ username: "admin", password: "admin123" }],
};

const ADMIN_INVITE_CODE = "WARSAFE2024";

const LEAFLET_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
    .legend {
      background: white;
      padding: 10px 14px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      line-height: 1.9;
      font-family: sans-serif;
      font-size: 13px;
    }
    .legend-item { display: flex; align-items: center; gap: 8px; }
    .dot { width: 14px; height: 14px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
    .safehouse-icon {
      background: #16a34a;
      border: 2px solid #fff;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      line-height: 1;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map').setView([22.5, 80.5], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18
    }).addTo(map);

    /* ── RED ZONES: Active border/conflict areas ── */
    var redZones = [
      { center: [34.2, 77.6],  radius: 130000, label: 'Ladakh – India-China-Pakistan Tri-Border' },
      { center: [33.4, 74.4],  radius: 100000, label: 'Line of Control – Jammu & Kashmir' },
      { center: [31.4, 74.8],  radius: 80000,  label: 'India-Pakistan Border – Punjab' },
      { center: [27.2, 70.8],  radius: 100000, label: 'India-Pakistan Border – Rajasthan' },
      { center: [27.8, 97.2],  radius: 90000,  label: 'India-China Border – Arunachal Pradesh' },
      { center: [27.5, 88.5],  radius: 70000,  label: 'India-China Border – Sikkim' },
      { center: [23.8, 93.8],  radius: 80000,  label: 'India-Myanmar Border – Manipur' }
    ];
    redZones.forEach(function(z) {
      L.circle(z.center, {
        color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.35, weight: 2, radius: z.radius
      }).addTo(map).bindPopup('<b style="color:#dc2626">&#9888; Danger Zone</b><br>' + z.label);
    });

    /* ── YELLOW ZONES: Buffer / caution areas near borders ── */
    var yellowZones = [
      { center: [32.5, 75.5],  radius: 90000,  label: 'Jammu Region Buffer Zone' },
      { center: [30.7, 76.5],  radius: 85000,  label: 'Punjab-Himachal Border Buffer' },
      { center: [25.5, 71.5],  radius: 95000,  label: 'Rajasthan Desert Buffer Zone' },
      { center: [24.5, 68.5],  radius: 75000,  label: 'Gujarat-Pakistan Border Buffer' },
      { center: [26.2, 91.7],  radius: 90000,  label: 'Assam-Bangladesh Border Zone' },
      { center: [23.5, 92.5],  radius: 80000,  label: 'Tripura-Bangladesh Buffer' },
      { center: [26.5, 94.5],  radius: 85000,  label: 'Nagaland-Myanmar Buffer Zone' },
      { center: [29.0, 80.5],  radius: 80000,  label: 'Uttarakhand-Nepal-China Buffer' }
    ];
    yellowZones.forEach(function(z) {
      L.circle(z.center, {
        color: '#d97706', fillColor: '#fbbf24', fillOpacity: 0.35, weight: 2, radius: z.radius
      }).addTo(map).bindPopup('<b style="color:#d97706">&#9889; Caution Zone</b><br>' + z.label);
    });

    /* ── GREEN ZONES: Safe interior cities ── */
    var greenZones = [
      { center: [28.61, 77.21], radius: 75000,  label: 'New Delhi – National Capital' },
      { center: [19.08, 72.88], radius: 80000,  label: 'Mumbai – Financial Capital' },
      { center: [12.97, 77.59], radius: 70000,  label: 'Bengaluru – Tech Hub' },
      { center: [17.39, 78.49], radius: 70000,  label: 'Hyderabad' },
      { center: [13.08, 80.27], radius: 65000,  label: 'Chennai' },
      { center: [22.57, 88.36], radius: 65000,  label: 'Kolkata' },
      { center: [18.52, 73.86], radius: 60000,  label: 'Pune' },
      { center: [23.02, 72.57], radius: 65000,  label: 'Ahmedabad' },
      { center: [21.16, 79.09], radius: 60000,  label: 'Nagpur – Central India' },
      { center: [26.85, 80.95], radius: 65000,  label: 'Lucknow' },
      { center: [15.34, 75.14], radius: 55000,  label: 'Dharwad – Karnataka Interior' },
      { center: [20.45, 85.84], radius: 60000,  label: 'Bhubaneswar – Odisha' }
    ];
    greenZones.forEach(function(z) {
      L.circle(z.center, {
        color: '#16a34a', fillColor: '#4ade80', fillOpacity: 0.3, weight: 2, radius: z.radius
      }).addTo(map).bindPopup('<b style="color:#16a34a">&#10003; Safe Zone</b><br>' + z.label);
    });

    /* ── SAFEHOUSE MARKERS in green zones ── */
    var safehouseIcon = L.divIcon({
      className: '',
      html: '<div class="safehouse-icon">&#127968;<\/div>',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -18]
    });

    var safehouses = [
      { pos: [28.61, 77.21],  name: 'Delhi Safehouse',      city: 'New Delhi' },
      { pos: [19.10, 72.86],  name: 'Mumbai Safehouse',     city: 'Mumbai' },
      { pos: [12.95, 77.62],  name: 'Bengaluru Safehouse',  city: 'Bengaluru' },
      { pos: [17.41, 78.47],  name: 'Hyderabad Safehouse',  city: 'Hyderabad' },
      { pos: [13.06, 80.25],  name: 'Chennai Safehouse',    city: 'Chennai' },
      { pos: [22.55, 88.38],  name: 'Kolkata Safehouse',    city: 'Kolkata' },
      { pos: [18.50, 73.88],  name: 'Pune Safehouse',       city: 'Pune' },
      { pos: [23.04, 72.55],  name: 'Ahmedabad Safehouse',  city: 'Ahmedabad' },
      { pos: [21.14, 79.11],  name: 'Nagpur Safehouse',     city: 'Nagpur' },
      { pos: [26.87, 80.93],  name: 'Lucknow Safehouse',    city: 'Lucknow' }
    ];
    safehouses.forEach(function(s) {
      L.marker(s.pos, { icon: safehouseIcon })
        .addTo(map)
        .bindPopup(
          '<b style="color:#16a34a">&#127968; ' + s.name + '<\/b>' +
          '<br><span style="font-size:12px">City: ' + s.city + '<\/span>' +
          '<br><span style="font-size:11px;color:#6b7280">Verified Safe Location<\/span>'
        );
    });

    /* ── LEGEND ── */
    var legend = L.control({ position: 'bottomright' });
    legend.onAdd = function() {
      var div = L.DomUtil.create('div', 'legend');
      div.innerHTML =
        '<b style="font-size:13px">India Zone Map<\/b><br><br>' +
        '<div class="legend-item"><span class="dot" style="background:#dc2626"><\/span> Danger Zone (Border)<\/div>' +
        '<div class="legend-item"><span class="dot" style="background:#fbbf24"><\/span> Caution Zone (Buffer)<\/div>' +
        '<div class="legend-item"><span class="dot" style="background:#4ade80"><\/span> Safe Zone (Interior)<\/div>' +
        '<div class="legend-item" style="margin-top:4px">&#127968; Safehouse<\/div>';
      return div;
    };
    legend.addTo(map);
  <\/script>
</body>
</html>
`;

function LoginScreen({ onLogin, onSignup, users, isLoading }) {
  const [role, setRole] = useState("user");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = () => {
    if (!username.trim()) {
      Alert.alert("Error", "Please enter your username.");
      return;
    }
    if (!password) {
      Alert.alert("Error", "Please enter your password.");
      return;
    }
    // Validation and blockchain call handled by App's handleLogin
    onLogin(role, username.trim(), password);
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
            style={[styles.loginButton, role === "admin" ? styles.loginButtonAdmin : styles.loginButtonUser, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            activeOpacity={0.85}
            disabled={isLoading}
          >
            {isLoading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.loginButtonText}>Sign In as {role === "admin" ? "Admin" : "User"}</Text>
            }
          </TouchableOpacity>

          <Text style={styles.demoHint}>
            Demo — User: user / user123 · Admin: admin / admin123
          </Text>

          <View style={styles.signupLinkRow}>
            <Text style={styles.signupLinkText}>Don't have an account? </Text>
            <TouchableOpacity onPress={onSignup}>
              <Text style={[styles.signupLinkText, styles.signupLinkAction]}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>

        <StatusBar style="light" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SignupScreen({ onSignup, onBack, users, isLoading }) {
  const [role, setRole] = useState("user");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSignup = () => {
    if (!username.trim()) {
      Alert.alert("Error", "Username is required.");
      return;
    }
    if (username.trim().length < 3) {
      Alert.alert("Error", "Username must be at least 3 characters.");
      return;
    }
    if (!password) {
      Alert.alert("Error", "Password is required.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }
    if (role === "admin" && adminCode !== ADMIN_INVITE_CODE) {
      Alert.alert("Error", "Invalid admin invite code.");
      return;
    }
    const exists = users[role].some((u) => u.username === username.trim());
    if (exists) {
      Alert.alert("Error", "Username already taken. Please choose another.");
      return;
    }
    onSignup(role, username.trim(), password);
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
          <Text style={styles.cardTitle}>Create Account</Text>

          <View style={styles.roleToggleContainer}>
            <TouchableOpacity
              style={[styles.roleButton, role === "user" && styles.roleButtonActive]}
              onPress={() => { setRole("user"); setUsername(""); setPassword(""); setConfirmPassword(""); setAdminCode(""); }}
            >
              <Text style={[styles.roleButtonText, role === "user" && styles.roleButtonTextActive]}>
                User
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleButton, role === "admin" && styles.roleButtonActiveAdmin]}
              onPress={() => { setRole("admin"); setUsername(""); setPassword(""); setConfirmPassword(""); setAdminCode(""); }}
            >
              <Text style={[styles.roleButtonText, role === "admin" && styles.roleButtonTextActive]}>
                Admin
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.roleBadge, role === "admin" ? styles.roleBadgeAdmin : styles.roleBadgeUser]}>
            <Text style={styles.roleBadgeText}>
              {role === "admin" ? "Administrator Account" : "User Account"}
            </Text>
          </View>

          <Text style={styles.inputLabel}>Username</Text>
          <TextInput
            style={styles.input}
            placeholder={`Choose a ${role} username`}
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
              placeholder="Create password (min 6 chars)"
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

          <Text style={styles.inputLabel}>Confirm Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Re-enter password"
              placeholderTextColor="#9ca3af"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirm}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeBtn}>
              <Text style={styles.eyeText}>{showConfirm ? "🙈" : "👁️"}</Text>
            </TouchableOpacity>
          </View>

          {role === "admin" && (
            <>
              <Text style={styles.inputLabel}>Admin Invite Code</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter admin invite code"
                placeholderTextColor="#9ca3af"
                value={adminCode}
                onChangeText={setAdminCode}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
              <Text style={styles.adminCodeHint}>Contact your administrator for the invite code.</Text>
            </>
          )}

          <TouchableOpacity
            style={[styles.loginButton, role === "admin" ? styles.loginButtonAdmin : styles.loginButtonUser, { marginTop: 8 }, isLoading && styles.buttonDisabled]}
            onPress={handleSignup}
            activeOpacity={0.85}
            disabled={isLoading}
          >
            {isLoading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.loginButtonText}>Sign Up as {role === "admin" ? "Admin" : "User"}</Text>
            }
          </TouchableOpacity>

          <View style={styles.signupLinkRow}>
            <Text style={styles.signupLinkText}>Already have an account? </Text>
            <TouchableOpacity onPress={onBack}>
              <Text style={[styles.signupLinkText, styles.signupLinkAction]}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>

        <StatusBar style="light" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function MapScreen({ onBack }) {
  return (
    <View style={{ flex: 1, backgroundColor: "#0f172a" }}>
      <View style={styles.mapHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.mapTitle}>India Zone Map</Text>
        <View style={{ width: 70 }} />
      </View>
      <WebView
        source={{ html: LEAFLET_HTML }}
        style={{ flex: 1 }}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
      />
    </View>
  );
}

function DashboardScreen({ role, username, sessionData, onLogout }) {
  const isAdmin = role === "admin";
  const [showMap, setShowMap] = useState(false);

  if (showMap) {
    return <MapScreen onBack={() => setShowMap(false)} />;
  }

  return (
    <View style={styles.dashContainer}>
      <View style={[styles.dashHeader, isAdmin ? styles.dashHeaderAdmin : styles.dashHeaderUser]}>
        <Text style={styles.dashWelcome}>Welcome back,</Text>
        <Text style={styles.dashName}>{username}</Text>
        <View style={styles.dashBadge}>
          <Text style={styles.dashBadgeText}>{isAdmin ? "🔑 Administrator" : "👤 User"}</Text>
        </View>
        {sessionData && (
          <Text style={styles.sessionLabel}>
            🔒 {sessionExpiryLabel(sessionData)}
          </Text>
        )}
      </View>

      <ScrollView style={styles.dashContent} contentContainerStyle={{ padding: 20 }}>
        
        <Text style={styles.sectionTitle}>Quick Access</Text>
        <View style={styles.tileRow}>
          <View style={[styles.tile, { backgroundColor: "#eff6ff" }]}>
            <Text style={styles.tileIcon}>📡</Text>
            <Text style={styles.tileLabel}>Network Status</Text>
          </View>
          <TouchableOpacity style={[styles.tile, { backgroundColor: "#f0fdf4" }]} onPress={() => setShowMap(true)}>
            <Text style={styles.tileIcon}>🗺️</Text>
            <Text style={styles.tileLabel}>Map</Text>
          </TouchableOpacity>
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
  const [users, setUsers] = useState(SEED_USERS);
  const [screen, setScreen] = useState("login"); // "login" | "signup" | "dashboard"
  const [role, setRole] = useState(null);
  const [username, setUsername] = useState("");
  const [sessionData, setSessionData] = useState(null);
  const [appLoading, setAppLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);

  // On mount: restore persisted session from AsyncStorage
  useEffect(() => {
    (async () => {
      const session = await getSession();
      if (session) {
        setRole(session.role);
        setUsername(session.username);
        setSessionData(session);
        setScreen("dashboard");
      }
      setAppLoading(false);
    })();
  }, []);

  const handleLogin = async (r, u, p) => {
    setTxLoading(true);
    try {
      // Try blockchain validation first
      const result = await validateLoginOnChain(u, r, p);
      if (result.onChain) {
        if (result.success) {
          const session = await saveSession(u, r);
          setRole(r);
          setUsername(u);
          setSessionData(session);
          setScreen("dashboard");
        } else {
          Alert.alert("Login Failed", "Invalid username or password.");
        }
      } else {
        // Blockchain unavailable — fall back to in-memory seed/registered users
        const list = users[r];
        const found = list.find((x) => x.username === u && x.password === p);
        if (found) {
          const session = await saveSession(u, r);
          setRole(r);
          setUsername(u);
          setSessionData(session);
          setScreen("dashboard");
        } else {
          Alert.alert("Login Failed", "Invalid username or password.");
        }
      }
    } finally {
      setTxLoading(false);
    }
  };

  const handleLogout = async () => {
    await clearSession();
    setScreen("login");
    setRole(null);
    setUsername("");
    setSessionData(null);
  };

  const handleSignup = async (r, u, p) => {
    setTxLoading(true);
    try {
      const result = await registerUserOnChain(u, r, p);
      if (result.success) {
        // Mirror to in-memory state for instant login-fallback
        setUsers((prev) => ({
          ...prev,
          [r]: [...prev[r], { username: u, password: p }],
        }));
        const txShort = result.txHash ? result.txHash.slice(0, 12) + "..." : "";
        Alert.alert(
          "Account Created ✅",
          `Registered on blockchain.\nTx: ${txShort}\n\nPlease sign in.`,
          [{ text: "Sign In", onPress: () => setScreen("login") }]
        );
      } else if (!result.onChain) {
        // Blockchain unavailable — fall back to local-only registration
        const exists = users[r].some((x) => x.username === u);
        if (exists) {
          Alert.alert("Error", "Username already taken. Please choose another.");
          return;
        }
        setUsers((prev) => ({
          ...prev,
          [r]: [...prev[r], { username: u, password: p }],
        }));
        Alert.alert(
          "Account Created",
          "Registered locally (blockchain offline).\n\nPlease sign in.",
          [{ text: "Sign In", onPress: () => setScreen("login") }]
        );
      } else {
        Alert.alert("Registration Failed", result.error ?? "Could not register.");
      }
    } finally {
      setTxLoading(false);
    }
  };

  // Splash screen while restoring (AsyncStorage) session on startup
  if (appLoading) {
    return (
      <View style={styles.splashContainer}>
        <Text style={styles.splashIcon}>🛡️</Text>
        <Text style={styles.splashTitle}>WarSafe Network</Text>
        <ActivityIndicator color="#3b82f6" size="large" style={{ marginTop: 24 }} />
      </View>
    );
  }

  if (screen === "dashboard") {
    return <DashboardScreen role={role} username={username} sessionData={sessionData} onLogout={handleLogout} />;
  }
  if (screen === "signup") {
    return <SignupScreen onSignup={handleSignup} onBack={() => setScreen("login")} users={users} isLoading={txLoading} />;
  }
  return <LoginScreen onLogin={handleLogin} onSignup={() => setScreen("signup")} users={users} isLoading={txLoading} />;
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
    marginBottom: 12,
  },
  signupLinkRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 4,
  },
  signupLinkText: {
    color: "#64748b",
    fontSize: 13,
  },
  signupLinkAction: {
    color: "#3b82f6",
    fontWeight: "700",
  },
  adminCodeHint: {
    color: "#64748b",
    fontSize: 11,
    marginTop: -8,
    marginBottom: 14,
    paddingHorizontal: 2,
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
  mapHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1e293b",
    paddingTop: Platform.OS === "android" ? 40 : 56,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#334155",
    borderRadius: 8,
    minWidth: 70,
    alignItems: "center",
  },
  backButtonText: { color: "#93c5fd", fontWeight: "600", fontSize: 14 },
  mapTitle: { color: "#f1f5f9", fontWeight: "700", fontSize: 17 },
  // Blockchain / session styles
  buttonDisabled: { opacity: 0.55 },
  sessionLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.65)",
    marginTop: 6,
    textAlign: "center",
  },
  splashContainer: {
    flex: 1,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
  },
  splashIcon: { fontSize: 56 },
  splashTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#f8fafc",
    marginTop: 12,
  },
});
