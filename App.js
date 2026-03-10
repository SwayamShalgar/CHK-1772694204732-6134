import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { WebView } from "react-native-webview";
import AdminBroadcastScreen from "./src/screens/AdminBroadcastScreen";
import AdminZoneScreen from "./src/screens/AdminZoneScreen";
import MessagesScreen from "./src/screens/MessagesScreen";
import { getCustomZones } from "./src/utils/zoneStorage";
import { tearDownAll, setZoneUpdateCallback } from "./src/bluetooth/bluetoothService";
import {
  getUnreadCount,
} from "./src/utils/offlineMessages";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
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
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import {
  verifyAadhaarCard,
  simulateFaceMatch,
  doesUsernameMatchAadhaar,
  maskAadhaar,
  maskName,
} from "./src/utils/aadhaarService";

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

    /* ── CUSTOM ZONES: injected at runtime by React Native ── */
    window.loadCustomZones = function(zones) {
      var CSTYLES = {
        red:    { color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.45, weight: 2 },
        yellow: { color: '#d97706', fillColor: '#fbbf24', fillOpacity: 0.45, weight: 2 },
        green:  { color: '#16a34a', fillColor: '#4ade80', fillOpacity: 0.4,  weight: 2 }
      };
      var CLABELS = {
        red:    '<b style="color:#dc2626">\u26a0\ufe0f Custom Danger Zone<\/b>',
        yellow: '<b style="color:#d97706">\u26a1 Custom Caution Zone<\/b>',
        green:  '<b style="color:#16a34a">\u2705 Custom Safe Zone<\/b>'
      };
      (zones || []).forEach(function(z) {
        var s = CSTYLES[z.type] || CSTYLES.green;
        L.circle([z.lat, z.lng], Object.assign({}, s, { radius: z.radiusKm * 1000 }))
          .addTo(map)
          .bindPopup((CLABELS[z.type] || '') + '<br>' + (z.label || ''));
      });
    };

    /* ── A* PATHFINDING: Shortest safe route to nearest safehouse ──
       Grid resolution : 0.75° (~83 km per cell)
       Zone penalties  : Red ×8  |  Yellow ×2.5  |  Green ×0.6  |  Open ×1
       Algorithm       : A* with Haversine heuristic, 8-directional movement
    ─────────────────────────────────────────────────────────────────── */
    window.findSafestRoute = (function() {
      var STEP = 0.75;
      var LAT0 = 6.5,  LAT1 = 37.5;
      var LNG0 = 68.0, LNG1 = 98.0;
      var ROWS = Math.ceil((LAT1 - LAT0) / STEP) + 1;
      var COLS = Math.ceil((LNG1 - LNG0) / STEP) + 1;

      /* encode (row, col) as a single integer key */
      function nk(r, c)  { return r * 200 + c; }
      function r2(k)     { return Math.floor(k / 200); }
      function c2(k)     { return k % 200; }
      function rc2ll(r, c) { return [LAT0 + r * STEP, LNG0 + c * STEP]; }
      function ll2rc(lat, lng) {
        return [
          Math.min(ROWS-1, Math.max(0, Math.round((lat - LAT0) / STEP))),
          Math.min(COLS-1, Math.max(0, Math.round((lng - LNG0) / STEP)))
        ];
      }

      /* Haversine great-circle distance (km) */
      function hav(la1, ln1, la2, ln2) {
        var R = 6371, dLa = (la2-la1)*Math.PI/180, dLn = (ln2-ln1)*Math.PI/180;
        var a = Math.sin(dLa/2)*Math.sin(dLa/2) +
                Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*
                Math.sin(dLn/2)*Math.sin(dLn/2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      }

      /* Zone-based traversal penalty for a lat/lng point */
      function zonePenalty(lat, lng) {
        var p = 1.0, i, z, d;
        for (i = 0; i < redZones.length; i++) {
          z = redZones[i];
          d = hav(lat, lng, z.center[0], z.center[1]) * 1000;
          if (d < z.radius) { p = Math.max(p, 8.0); }
        }
        for (i = 0; i < yellowZones.length; i++) {
          z = yellowZones[i];
          d = hav(lat, lng, z.center[0], z.center[1]) * 1000;
          if (d < z.radius) { p = Math.max(p, 2.5); }
        }
        for (i = 0; i < greenZones.length; i++) {
          z = greenZones[i];
          d = hav(lat, lng, z.center[0], z.center[1]) * 1000;
          if (d < z.radius) { p = Math.min(p, 0.6); }
        }
        return p;
      }

      /* Pre-compute penalty for every grid cell once at startup */
      var PEN = {};
      (function() {
        for (var r = 0; r < ROWS; r++) {
          for (var c = 0; c < COLS; c++) {
            var ll = rc2ll(r, c);
            PEN[nk(r, c)] = zonePenalty(ll[0], ll[1]);
          }
        }
      })();

      /* 8-directional movement offsets */
      var DIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];

      /* A* search from (sLat,sLng) to (eLat,eLng).  Returns [[lat,lng], ...] or null. */
      function aStar(sLat, sLng, eLat, eLng) {
        var sRC = ll2rc(sLat, sLng);
        var eRC = ll2rc(eLat, eLng);
        var sk  = nk(sRC[0], sRC[1]);
        var ek  = nk(eRC[0], eRC[1]);
        var eLL = rc2ll(eRC[0], eRC[1]);

        if (sk === ek) return [rc2ll(sRC[0], sRC[1]), eLL];

        var gScore = {}; gScore[sk] = 0;
        var parent = {};
        var closed = {};
        var open = [{ k: sk, r: sRC[0], c: sRC[1], f: hav(sLat, sLng, eLL[0], eLL[1]) }];

        for (var iter = 0; iter < 4000 && open.length > 0; iter++) {
          /* pop node with lowest f-score */
          open.sort(function(a,b) { return a.f - b.f; });
          var cur = open.shift();
          var ck  = cur.k;
          if (ck === ek) {
            /* reconstruct */
            var path = [], k = ek;
            while (k !== undefined) { path.push(rc2ll(r2(k), c2(k))); k = parent[k]; }
            return path.reverse();
          }
          if (closed[ck]) continue;
          closed[ck] = true;

          for (var d = 0; d < 8; d++) {
            var nr = cur.r + DIRS[d][0];
            var nc = cur.c + DIRS[d][1];
            if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
            var nkk = nk(nr, nc);
            if (closed[nkk]) continue;
            var nLL  = rc2ll(nr, nc);
            var cLL  = rc2ll(cur.r, cur.c);
            var pen  = PEN[nkk] !== undefined ? PEN[nkk] : 1.0;
            var tg   = gScore[ck] + hav(cLL[0], cLL[1], nLL[0], nLL[1]) * pen;
            if (gScore[nkk] === undefined || tg < gScore[nkk]) {
              gScore[nkk] = tg;
              parent[nkk] = ck;
              open.push({ k: nkk, r: nr, c: nc, f: tg + hav(nLL[0], nLL[1], eLL[0], eLL[1]) });
            }
          }
        }
        return null; /* no path within iteration budget */
      }

      /* Clear previous route layers */
      function clearRoute() {
        if (window._routeLayer)  { map.removeLayer(window._routeLayer);  window._routeLayer  = null; }
        if (window._userMarker)  { map.removeLayer(window._userMarker);  window._userMarker  = null; }
        if (window._destMarker)  { map.removeLayer(window._destMarker);  window._destMarker  = null; }
        if (window._routeArrows) { map.removeLayer(window._routeArrows); window._routeArrows = null; }
      }

      /* Public entry-point: find safest route from userLat/userLng */
      return function findSafestRoute(userLat, userLng) {
        clearRoute();

        /* Place user marker */
        window._userMarker = L.circleMarker([userLat, userLng], {
          radius: 10, color: '#fff', weight: 2.5, fillColor: '#3b82f6', fillOpacity: 1
        }).addTo(map).bindPopup('<b>\uD83D\uDCCD Your Location</b>').openPopup();

        /* Run A* to every safehouse, keep the cheapest route */
        var bestCost = Infinity, bestPath = null, bestHouse = null;
        for (var i = 0; i < safehouses.length; i++) {
          var sh   = safehouses[i];
          var path = aStar(userLat, userLng, sh.pos[0], sh.pos[1]);
          if (!path || path.length < 2) continue;
          var cost = 0;
          for (var j = 1; j < path.length; j++) {
            cost += hav(path[j-1][0], path[j-1][1], path[j][0], path[j][1]);
          }
          if (cost < bestCost) { bestCost = cost; bestPath = path; bestHouse = sh; }
        }

        if (!bestPath) {
          if (window.ReactNativeWebView)
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'routeError' }));
          return;
        }

        /* Draw route polyline */
        window._routeLayer = L.polyline(bestPath, {
          color: '#22c55e', weight: 5, opacity: 0.92, lineJoin: 'round'
        }).addTo(map);

        /* Destination safehouse marker with special popup */
        window._destMarker = L.marker(bestHouse.pos, { icon: safehouseIcon })
          .addTo(map)
          .bindPopup(
            '<b style="color:#16a34a">\uD83C\uDFC1 Nearest Safehouse</b><br>' +
            '<b>' + bestHouse.name + '</b><br>City: ' + bestHouse.city + '<br>' +
            '<span style="color:#16a34a;font-weight:600">~' + Math.round(bestCost) + ' km (safe route)<\/span>'
          ).openPopup();

        map.fitBounds(window._routeLayer.getBounds(), { padding: [50, 50] });

        /* Notify React Native */
        if (window.ReactNativeWebView)
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'routeResult',
            safehouse: bestHouse.name,
            city: bestHouse.city,
            distanceKm: Math.round(bestCost)
          }));
      };
    })();
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
  // step: 1 = Aadhaar card + name, 2 = Face scan, 3 = Account details
  const [step, setStep] = useState(1);

  // ── Step 1 state ──────────────────────────────────────────────────
  const [cardImageUri, setCardImageUri] = useState(null);
  const [enteredName, setEnteredName] = useState("");
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [cardVerifying, setCardVerifying] = useState(false);
  const [aadhaarRecord, setAadhaarRecord] = useState(null);

  // ── Step 2 state ──────────────────────────────────────────────────
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceScanned, setFaceScanned] = useState(false);
  const [scanning, setScanning] = useState(false);
  const cameraRef = useRef(null);
  const detectTimerRef = useRef(null);

  // Start face-detection timer once the camera hardware is ready
  useEffect(() => {
    if (step === 2 && cameraReady && !faceScanned && !faceDetected) {
      detectTimerRef.current = setTimeout(() => setFaceDetected(true), 2000);
    }
    return () => clearTimeout(detectTimerRef.current);
  }, [step, cameraReady, faceScanned, faceDetected]);

  // ── Step 3 state ──────────────────────────────────────────────────
  const [role, setRole] = useState("user");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Format Aadhaar number as XXXX XXXX XXXX
  const handleAadhaarChange = (text) => {
    const digits = text.replace(/\D/g, "").slice(0, 12);
    const formatted = digits.match(/.{1,4}/g)?.join(" ") ?? digits;
    setAadhaarNumber(formatted);
  };

  // ── Step 1: pick or photograph the Aadhaar card ───────────────────
  const handlePickCardImage = async (source) => {
    let result;
    if (source === "camera") {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Needed", "Camera permission is required to photograph your Aadhaar card.");
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [8, 5],
        quality: 0.85,
      });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Needed", "Photo library access is required to select your Aadhaar card image.");
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [8, 5],
        quality: 0.85,
      });
    }
    if (!result.canceled && result.assets?.[0]?.uri) {
      setCardImageUri(result.assets[0].uri);
    }
  };

  // ── Step 1: verify card — mock OCR checks card image + name match ──
  const handleVerifyCard = async () => {
    if (!cardImageUri) {
      Alert.alert("Card Photo Required", "Please photograph or upload your Aadhaar card first.");
      return;
    }
    if (!enteredName.trim()) {
      Alert.alert("Name Required", "Enter your name exactly as printed on the Aadhaar card.");
      return;
    }
    const raw = aadhaarNumber.replace(/\s/g, "");
    if (raw.length !== 12) {
      Alert.alert("Invalid Aadhaar", "Enter the complete 12-digit Aadhaar number printed on your card.");
      return;
    }
    setCardVerifying(true);
    const result = await verifyAadhaarCard(raw, enteredName.trim(), cardImageUri);
    setCardVerifying(false);
    if (result.success) {
      setAadhaarRecord(result.record);
      // Pre-fill username with the Aadhaar first name
      setUsername(result.record.name);
      setTimeout(() => setStep(2), 1500);
    } else {
      Alert.alert("Verification Failed ❌", result.error);
    }
  };

  // ── Step 2: capture selfie and match against card photo ───────────
  const handleCaptureFace = async () => {
    if (!faceDetected) {
      Alert.alert("Face Not Ready", "Hold your face steady in the frame and wait for the green outline.");
      return;
    }
    if (!cameraRef.current) {
      Alert.alert("Camera Not Ready", "Camera is still initialising. Please wait a moment and try again.");
      return;
    }
    setScanning(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, skipProcessing: false });
      const result = await simulateFaceMatch(photo?.uri);
      if (result.matched) {
        setFaceScanned(true);
        setTimeout(() => setStep(3), 1200);
      } else {
        Alert.alert(
          "Face Mismatch ❌",
          "Your face does not match the photo on the Aadhaar card. Please ensure you are holding up the correct card and try again."
        );
      }
    } catch (e) {
      Alert.alert("Capture Failed", "Could not take a photo. Please ensure camera permission is granted and try again.");
    } finally {
      setScanning(false);
    }
  };

  // ── Step 3: final account submission ───────────────────────────────
  const handleSignup = () => {
    if (!username.trim() || username.trim().length < 3) {
      Alert.alert("Error", "Username must be at least 3 characters.");
      return;
    }
    if (!doesUsernameMatchAadhaar(username.trim(), aadhaarRecord)) {
      Alert.alert(
        "Username Mismatch ❌",
        "Username must match the name on your Aadhaar card.\n\nPlease keep the pre-filled name or use your Aadhaar-registered name."
      );
      return;
    }
    if (!password || password.length < 6) {
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
    if (users[role].some((u) => u.username === username.trim())) {
      Alert.alert("Error", "Username already taken. Please choose another.");
      return;
    }
    onSignup(role, username.trim(), password);
  };

  // ── Shared progress bar ────────────────────────────────────────────
  const StepBar = () => (
    <View style={styles.stepBarRow}>
      {[1, 2, 3].map((s) => (
        <View
          key={s}
          style={[
            styles.stepBarDot,
            s < step ? styles.stepBarDone : s === step ? styles.stepBarActive : styles.stepBarPending,
          ]}
        />
      ))}
    </View>
  );

  const Header = () => (
    <View style={styles.header}>
      <View style={styles.shieldIcon}><Text style={styles.shieldText}>🛡️</Text></View>
      <Text style={styles.appTitle}>WarSafe Network</Text>
      <Text style={styles.appSubtitle}>Secure Communication Platform</Text>
    </View>
  );

  // ════════════════════════════════════════════════════════════════════
  // STEP 1 — Aadhaar Card Photo + Name + Number
  // ════════════════════════════════════════════════════════════════════
  if (step === 1) {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <Header />

          <View style={styles.card}>
            <StepBar />
            <Text style={styles.cardTitle}>Aadhaar Card Verification</Text>
            <Text style={styles.stepSubtitle}>Step 1 of 3 — Identity Verification</Text>

            {/* ── Card image capture ── */}
            <Text style={styles.inputLabel}>Aadhaar Card Photo</Text>
            <View style={styles.cardImageRow}>
              {cardImageUri ? (
                <Image source={{ uri: cardImageUri }} style={styles.cardImageThumb} resizeMode="cover" />
              ) : (
                <View style={styles.cardImagePlaceholder}>
                  <Text style={{ fontSize: 30 }}>🪪</Text>
                  <Text style={{ color: "#64748b", fontSize: 10, marginTop: 4 }}>No photo</Text>
                </View>
              )}
              <View style={styles.cardImageButtons}>
                <TouchableOpacity style={styles.cardImgBtn} onPress={() => handlePickCardImage("camera")}>
                  <Text style={styles.cardImgBtnText}>📷  Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cardImgBtn} onPress={() => handlePickCardImage("gallery")}>
                  <Text style={styles.cardImgBtnText}>🖼️  Gallery</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.adminCodeHint}>
              Take a clear, well-lit photo of your physical Aadhaar card.
            </Text>

            {/* ── Name on card ── */}
            <Text style={styles.inputLabel}>Name (as on Aadhaar Card)</Text>
            <TextInput
              style={styles.input}
              placeholder="Full name exactly as printed on card"
              placeholderTextColor="#9ca3af"
              value={enteredName}
              onChangeText={setEnteredName}
              autoCapitalize="words"
              autoCorrect={false}
            />

            {/* ── Aadhaar number ── */}
            <Text style={styles.inputLabel}>Aadhaar Number (12 digits)</Text>
            <TextInput
              style={styles.input}
              placeholder="XXXX XXXX XXXX"
              placeholderTextColor="#9ca3af"
              value={aadhaarNumber}
              onChangeText={handleAadhaarChange}
              keyboardType="numeric"
              maxLength={14}
            />
            <Text style={styles.adminCodeHint}>
              12-digit number printed at the bottom of your Aadhaar card.
            </Text>

            {/* ── OCR success banner ── */}
            {aadhaarRecord && (
              <View style={styles.aadhaarSuccessBanner}>
                <Text style={{ fontSize: 22 }}>✅</Text>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.aadhaarSuccessTitle}>Card Verified</Text>
                  <Text style={styles.aadhaarSuccessText}>Name: {maskName(aadhaarRecord.displayName)}</Text>
                  <Text style={styles.aadhaarSuccessText}>DOB: {aadhaarRecord.dob}</Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[styles.loginButton, styles.loginButtonUser, { marginTop: 8 }, cardVerifying && styles.buttonDisabled]}
              onPress={handleVerifyCard}
              activeOpacity={0.85}
              disabled={cardVerifying}
            >
              {cardVerifying ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.loginButtonText}>Reading Card…</Text>
                </View>
              ) : (
                <Text style={styles.loginButtonText}>🪪  Verify Aadhaar Card</Text>
              )}
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

  // ════════════════════════════════════════════════════════════════════
  // STEP 2 — Face Scan (compare selfie with Aadhaar card photo)
  // ════════════════════════════════════════════════════════════════════
  if (step === 2) {
    if (!permission) {
      return (
        <View style={[styles.scrollContainer, { flex: 1 }]}>
          <ActivityIndicator color="#3b82f6" size="large" />
          <Text style={{ color: "#94a3b8", marginTop: 12 }}>Requesting camera access…</Text>
        </View>
      );
    }
    if (!permission.granted) {
      return (
        <View style={[styles.scrollContainer, { flex: 1 }]}>
          <View style={styles.card}>
            <Text style={{ fontSize: 40, textAlign: "center", marginBottom: 16 }}>📷</Text>
            <Text style={[styles.cardTitle, { marginBottom: 8 }]}>Camera Required</Text>
            <Text style={{ color: "#94a3b8", textAlign: "center", marginBottom: 20, fontSize: 14 }}>
              Camera permission is needed to scan your face and match it with your Aadhaar card photo.
            </Text>
            <TouchableOpacity style={[styles.loginButton, styles.loginButtonUser]} onPress={requestPermission}>
              <Text style={styles.loginButtonText}>Grant Camera Permission</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={{ flex: 1, backgroundColor: "#0f172a" }}>
        <ScrollView contentContainerStyle={[styles.scrollContainer, { paddingBottom: 40 }]} keyboardShouldPersistTaps="handled">
          <Header />

          <View style={styles.card}>
            <StepBar />
            <Text style={styles.cardTitle}>Face Verification</Text>
            <Text style={styles.stepSubtitle}>Step 2 of 3 — Biometric Match</Text>

            {/* Aadhaar card reference thumbnail */}
            {cardImageUri && (
              <View style={styles.cardThumbnailRow}>
                <Image source={{ uri: cardImageUri }} style={styles.cardThumbnailSmall} resizeMode="cover" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={{ color: "#94a3b8", fontSize: 11, fontWeight: "600" }}>COMPARING AGAINST</Text>
                  <Text style={{ color: "#f1f5f9", fontSize: 13, fontWeight: "700", marginTop: 2 }}>
                    Aadhaar Card Photo
                  </Text>
                  <Text style={{ color: "#64748b", fontSize: 12 }}>{maskName(aadhaarRecord?.displayName ?? "")}</Text>
                </View>
                <Text style={{ fontSize: 20 }}>🆚</Text>
              </View>
            )}

            {/* Front camera for selfie */}
            <View style={styles.cameraContainer}>
              <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing="front"
                onCameraReady={() => setCameraReady(true)}
              />
              <View style={styles.cameraOverlay} pointerEvents="none">
                <View style={[styles.faceBox, faceDetected && styles.faceBoxDetected]} />
                <Text style={styles.faceBoxHint}>
                  {faceDetected ? "Face detected ✓" : "Align face in oval…"}
                </Text>
              </View>
            </View>

            <View style={styles.faceStatusRow}>
              <Text style={{ fontSize: 16 }}>{faceDetected ? "✅" : "⏳"}</Text>
              <Text style={[styles.faceStatusText, { color: faceDetected ? "#22c55e" : "#f59e0b" }]}>
                {faceScanned
                  ? "Face matched with Aadhaar card ✓"
                  : faceDetected
                  ? "Face detected — tap Scan to match"
                  : "Scanning… hold face in oval"}
              </Text>
            </View>

            {faceScanned ? (
              <View style={styles.aadhaarSuccessBanner}>
                <Text style={{ fontSize: 22 }}>✅</Text>
                <Text style={[styles.aadhaarSuccessTitle, { marginLeft: 10 }]}>
                  Face Matched with Aadhaar Card
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.loginButton, styles.loginButtonUser, { marginTop: 8 }, scanning && styles.buttonDisabled]}
                onPress={handleCaptureFace}
                activeOpacity={0.85}
                disabled={scanning}
              >
                {scanning ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.loginButtonText}>Comparing with Aadhaar photo…</Text>
                  </View>
                ) : (
                  <Text style={styles.loginButtonText}>{"📸  Scan & Match Face"}</Text>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity style={{ marginTop: 14, alignSelf: "center" }} onPress={() => { setFaceDetected(false); setFaceScanned(false); setCameraReady(false); setStep(1); }}>
              <Text style={[styles.signupLinkText, styles.signupLinkAction]}>← Back</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════════════
  // STEP 3 — Account Details
  // ════════════════════════════════════════════════════════════════════
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <Header />

        <View style={styles.card}>
          <StepBar />
          <Text style={styles.cardTitle}>Create Account</Text>
          <Text style={styles.stepSubtitle}>Step 3 of 3 — Account Details</Text>

          {/* Verified identity strip */}
          <View style={styles.aadhaarVerifiedBadge}>
            <Text style={{ fontSize: 14 }}>🪪</Text>
            <Text style={styles.aadhaarVerifiedBadgeText}>
              {maskAadhaar(aadhaarNumber)}{"  |  "}{maskName(aadhaarRecord?.displayName ?? "")}
            </Text>
            <Text style={{ fontSize: 14 }}>✅</Text>
          </View>

          <View style={styles.roleToggleContainer}>
            <TouchableOpacity
              style={[styles.roleButton, role === "user" && styles.roleButtonActive]}
              onPress={() => { setRole("user"); setAdminCode(""); }}
            >
              <Text style={[styles.roleButtonText, role === "user" && styles.roleButtonTextActive]}>User</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleButton, role === "admin" && styles.roleButtonActiveAdmin]}
              onPress={() => setRole("admin")}
            >
              <Text style={[styles.roleButtonText, role === "admin" && styles.roleButtonTextActive]}>Admin</Text>
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
            placeholder="Must match your Aadhaar name"
            placeholderTextColor="#9ca3af"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.adminCodeHint}>
            Pre-filled from Aadhaar. Must match your registered name.
          </Text>

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
            style={[
              styles.loginButton,
              role === "admin" ? styles.loginButtonAdmin : styles.loginButtonUser,
              { marginTop: 8 },
              isLoading && styles.buttonDisabled,
            ]}
            onPress={handleSignup}
            activeOpacity={0.85}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.loginButtonText}>Sign Up as {role === "admin" ? "Admin" : "User"}</Text>
            )}
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
  const webviewRef   = useRef(null);
  const mapLoadedRef = useRef(false);
  const locationRef  = useRef(null);  // cached GPS coords

  const [locStatus,  setLocStatus]  = useState("idle");  // idle|locating|ready|denied
  const [routeInfo,  setRouteInfo]  = useState(null);    // { safehouse, city, distanceKm }

  /* Inject (or refresh) custom admin zones */
  const injectCustomZones = useCallback(async (zones) => {
    const z = zones != null ? zones : await getCustomZones();
    if (mapLoadedRef.current && webviewRef.current) {
      webviewRef.current.injectJavaScript(
        `window.loadCustomZones(${JSON.stringify(z)});true;`
      );
    }
  }, []);

  /* Inject GPS coords → A* runs in the WebView */
  const injectRoute = useCallback((coords) => {
    if (!mapLoadedRef.current || !webviewRef.current || !coords) return;
    webviewRef.current.injectJavaScript(
      `window.findSafestRoute(${coords.latitude}, ${coords.longitude});true;`
    );
  }, []);

  /* Request location permission, get fix, trigger route */
  const requestAndLocate = useCallback(async () => {
    setLocStatus("locating");
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setLocStatus("denied");
      Alert.alert(
        "Location Required",
        "Enable location permission in Settings so WarSafe can find the nearest safehouse."
      );
      return;
    }
    try {
      const fix = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      locationRef.current = fix.coords;
      setLocStatus("ready");
      injectRoute(fix.coords);
    } catch {
      setLocStatus("idle");
      Alert.alert("GPS Error", "Could not get your location. Please ensure GPS is switched on.");
    }
  }, [injectRoute]);

  /* Live zone updates from admin over TCP */
  useEffect(() => {
    setZoneUpdateCallback((zones) => injectCustomZones(zones));
    return () => setZoneUpdateCallback(null);
  }, [injectCustomZones]);

  /* After the WebView / Leaflet is ready */
  const handleLoad = useCallback(() => {
    setTimeout(async () => {
      mapLoadedRef.current = true;
      await injectCustomZones();
      if (locationRef.current) injectRoute(locationRef.current);
    }, 600);
  }, [injectCustomZones, injectRoute]);

  /* Handle messages from the WebView (route results) */
  const handleMessage = useCallback((event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "routeResult") setRouteInfo(msg);
      if (msg.type === "routeError")  Alert.alert("No Route", "Could not find a safe route to any safehouse.");
    } catch {}
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#0f172a" }}>
      <View style={styles.mapHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.mapTitle}>India Zone Map</Text>
        <TouchableOpacity
          style={[styles.backButton, locStatus === "locating" && { opacity: 0.55 }]}
          onPress={locStatus !== "locating" ? requestAndLocate : undefined}
          disabled={locStatus === "locating"}
        >
          {locStatus === "locating"
            ? <ActivityIndicator color="#93c5fd" size="small" />
            : <Text style={styles.backButtonText}>
                {locStatus === "ready" ? "⟳ Route" : "📍 Route"}
              </Text>
          }
        </TouchableOpacity>
      </View>

      {/* Route result banner */}
      {routeInfo && (
        <View style={styles.routeBanner}>
          <Text style={styles.routeBannerIcon}>🏁</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.routeBannerTitle}>{routeInfo.safehouse}</Text>
            <Text style={styles.routeBannerSub}>
              Nearest safe route · ~{routeInfo.distanceKm} km
            </Text>
          </View>
          <TouchableOpacity onPress={() => setRouteInfo(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={{ color: "#94a3b8", fontSize: 18, paddingHorizontal: 6 }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      <WebView
        ref={webviewRef}
        source={{ html: LEAFLET_HTML }}
        style={{ flex: 1 }}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        onLoad={handleLoad}
        onMessage={handleMessage}
      />
    </View>
  );
}

function DashboardScreen({ role, username, sessionData, onLogout }) {
  const isAdmin = role === "admin";
  const [showMap, setShowMap] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [showZoneManager, setShowZoneManager] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const n = await getUnreadCount();
      if (active) setUnread(n);
    };
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  if (showMap) {
    return <MapScreen onBack={() => setShowMap(false)} />;
  }

  if (showMessages) {
    if (isAdmin) {
      return (
        <AdminBroadcastScreen
          username={username}
          onBack={() => setShowMessages(false)}
        />
      );
    }
    return (
      <MessagesScreen
        username={username}
        onBack={() => setShowMessages(false)}
      />
    );
  }

  if (showZoneManager && isAdmin) {
    return <AdminZoneScreen onBack={() => setShowZoneManager(false)} />;
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
          <TouchableOpacity style={[styles.tile, { backgroundColor: "#fdf4ff" }]} onPress={() => setShowMessages(true)}>
            <View style={{ position: "relative", alignItems: "center" }}>
              <Text style={styles.tileIcon}>💬</Text>
              {!isAdmin && unread > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{unread > 99 ? "99+" : unread}</Text>
                </View>
              )}
            </View>
            <Text style={styles.tileLabel}>{isAdmin ? "Broadcast" : "Messages"}</Text>
            {isAdmin && (
              <Text style={styles.tileSubLabel}>Send alerts</Text>
            )}
            {!isAdmin && unread > 0 && (
              <Text style={[styles.tileSubLabel, { color: "#2563eb" }]}>{unread} unread</Text>
            )}
          </TouchableOpacity>
        </View>

        {isAdmin && (
          <View style={styles.tileRow}>
            <TouchableOpacity
              style={[styles.tile, { backgroundColor: "#f5f3ff" }]}
              onPress={() => setShowZoneManager(true)}
            >
              <Text style={styles.tileIcon}>🗺️</Text>
              <Text style={styles.tileLabel}>Zone Manager</Text>
              <Text style={styles.tileSubLabel}>Set danger / caution / safe zones</Text>
            </TouchableOpacity>
          </View>
        )}

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
    tearDownAll();
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

  // ── Aadhaar card image capture styles ────────────────────────────
  cardImageRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 10,
  },
  cardImageThumb: {
    width: 110,
    height: 70,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#22c55e",
  },
  cardImagePlaceholder: {
    width: 110,
    height: 70,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f172a",
  },
  cardImageButtons: {
    flex: 1,
    gap: 8,
  },
  cardImgBtn: {
    backgroundColor: "#1e3a5f",
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  cardImgBtnText: {
    color: "#93c5fd",
    fontSize: 13,
    fontWeight: "600",
  },
  cardThumbnailRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  cardThumbnailSmall: {
    width: 72,
    height: 46,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#3b82f6",
  },
  faceBoxHint: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    marginTop: 8,
    fontWeight: "600",
    textAlign: "center",
  },
  stepBarRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
  },
  stepBarDot: {
    height: 8,
    borderRadius: 4,
  },
  stepBarActive: {
    width: 24,
    backgroundColor: "#3b82f6",
  },
  stepBarDone: {
    width: 8,
    backgroundColor: "#22c55e",
  },
  stepBarPending: {
    width: 8,
    backgroundColor: "#334155",
  },
  stepSubtitle: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginTop: -14,
    marginBottom: 20,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  aadhaarSuccessBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#052e16",
    borderWidth: 1,
    borderColor: "#16a34a",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  aadhaarSuccessTitle: {
    color: "#86efac",
    fontSize: 14,
    fontWeight: "700",
  },
  aadhaarSuccessText: {
    color: "#4ade80",
    fontSize: 13,
    marginTop: 2,
  },
  aadhaarVerifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0f2b1f",
    borderWidth: 1,
    borderColor: "#16a34a",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 18,
  },
  aadhaarVerifiedBadgeText: {
    color: "#4ade80",
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
    flexWrap: "wrap",
  },
  cameraContainer: {
    width: "100%",
    height: 280,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#000",
    marginBottom: 12,
    position: "relative",
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  faceBox: {
    width: 180,
    height: 220,
    borderWidth: 2,
    borderColor: "#f59e0b",
    borderRadius: 90,
    borderStyle: "dashed",
  },
  faceBoxDetected: {
    borderColor: "#22c55e",
    borderStyle: "solid",
  },
  faceStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  faceStatusText: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
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
  tileSubLabel: { fontSize: 10, color: "#94a3b8", marginTop: 2, textAlign: "center" },
  unreadBadge: {
    position: "absolute",
    top: -4,
    right: -12,
    backgroundColor: "#ef4444",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  unreadBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
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
  routeBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#052e16",
    borderBottomWidth: 1,
    borderBottomColor: "#16a34a",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  routeBannerIcon: { fontSize: 22 },
  routeBannerTitle: {
    color: "#86efac",
    fontSize: 14,
    fontWeight: "700",
  },
  routeBannerSub: {
    color: "#4ade80",
    fontSize: 12,
    marginTop: 1,
  },
});
