import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  FlatList,
  Platform,
} from "react-native";
import { WebView } from "react-native-webview";
import { getCustomZones, saveCustomZones } from "../utils/zoneStorage";
import { broadcastZones } from "../bluetooth/bluetoothService";

const ZONE_TYPES = [
  { type: "red",    emoji: "🔴", label: "Danger",  color: "#dc2626" },
  { type: "yellow", emoji: "🟡", label: "Caution", color: "#d97706" },
  { type: "green",  emoji: "🟢", label: "Safe",    color: "#16a34a" },
];

const ADMIN_MAP_HTML = `<!DOCTYPE html>
<html><head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
    #hint {
      position: absolute; top: 8px; left: 50%; transform: translateX(-50%);
      background: rgba(15,23,42,0.9); color: #fff; font-size: 12px;
      padding: 4px 16px; border-radius: 20px; z-index: 1000;
      pointer-events: none; white-space: nowrap;
    }
  </style>
</head><body>
  <div id="map"></div>
  <div id="hint">Select a zone type below, then tap the map</div>
  <script>
    // tap:false disables Leaflet's own touch emulation so the browser
    // delivers accurate native coordinates on Android WebView.
    var map = L.map('map', { tap: false, preferCanvas: true }).setView([22.5, 80.5], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors', maxZoom: 18
    }).addTo(map);

    var editMode = null;
    var circles = {};
    var previewMarker = null;

    var STYLES = {
      red:    { color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.4, weight: 2 },
      yellow: { color: '#d97706', fillColor: '#fbbf24', fillOpacity: 0.4, weight: 2 },
      green:  { color: '#16a34a', fillColor: '#4ade80', fillOpacity: 0.35, weight: 2 }
    };
    var POPUP_HDR = {
      red:    '<b style="color:#dc2626">⚠️ Danger Zone<\/b>',
      yellow: '<b style="color:#d97706">⚡ Caution Zone<\/b>',
      green:  '<b style="color:#16a34a">✅ Safe Zone<\/b>'
    };

    map.on('click', function(e) {
      if (!editMode) return;
      // Show a preview pin exactly where the user tapped
      if (previewMarker) { map.removeLayer(previewMarker); }
      previewMarker = L.circleMarker([e.latlng.lat, e.latlng.lng], {
        radius: 8, color: '#fff', fillColor: '#3b82f6', fillOpacity: 1, weight: 2.5
      }).addTo(map);
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ type: 'mapClick', lat: e.latlng.lat, lng: e.latlng.lng })
        );
      }
    });

    window.setEditMode = function(mode) {
      editMode = mode;
      var names = { red: 'Danger', yellow: 'Caution', green: 'Safe' };
      var el = document.getElementById('hint');
      el.textContent = mode
        ? ('Tap anywhere to place a ' + names[mode] + ' zone')
        : 'Select a zone type below, then tap the map';
    };

    window.addZone = function(z) {
      if (circles[z.id]) { map.removeLayer(circles[z.id]); }
      var s = STYLES[z.type] || STYLES.green;
      circles[z.id] = L.circle(
        [z.lat, z.lng],
        Object.assign({}, s, { radius: z.radiusKm * 1000 })
      ).addTo(map).bindPopup(
        (POPUP_HDR[z.type] || '') + '<br>' + (z.label || '')
      );
    };

    window.removeZone = function(id) {
      if (circles[id]) { map.removeLayer(circles[id]); delete circles[id]; }
    };

    window.loadZones = function(zones) {
      Object.keys(circles).forEach(function(id) { map.removeLayer(circles[id]); });
      circles = {};
      (zones || []).forEach(function(z) { window.addZone(z); });
    };

    window.clearPreviewMarker = function() {
      if (previewMarker) { map.removeLayer(previewMarker); previewMarker = null; }
    };
  <\/script>
</body><\/html>`;

export default function AdminZoneScreen({ onBack }) {
  const [zones, setZones] = useState([]);
  const [editType, setEditType] = useState("red");
  const [pendingCoords, setPendingCoords] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [zoneLabel, setZoneLabel] = useState("");
  const [zoneRadius, setZoneRadius] = useState("50");
  const webviewRef = useRef(null);
  const mapReadyRef = useRef(false);

  useEffect(() => {
    (async () => {
      const saved = await getCustomZones();
      setZones(saved);
    })();
  }, []);

  const injectJS = useCallback((code) => {
    if (webviewRef.current && mapReadyRef.current) {
      webviewRef.current.injectJavaScript(code + ";true;");
    }
  }, []);

  const handleWebViewLoad = useCallback(() => {
    mapReadyRef.current = true;
    // Small delay to let Leaflet finish rendering before injecting
    setTimeout(async () => {
      const saved = await getCustomZones();
      setZones(saved);
      if (webviewRef.current) {
        webviewRef.current.injectJavaScript(
          `window.loadZones(${JSON.stringify(saved)});window.setEditMode('red');true;`
        );
      }
    }, 600);
  }, []);

  const selectEditType = (type) => {
    setEditType(type);
    injectJS(`window.setEditMode('${type}')`);
  };

  const handleMessage = (event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "mapClick") {
        setPendingCoords({ lat: msg.lat, lng: msg.lng });
        setZoneLabel("");
        setZoneRadius("50");
        setModalVisible(true);
      }
    } catch {}
  };

  const handleAddZone = async () => {
    const radius = parseFloat(zoneRadius);
    if (!zoneLabel.trim()) {
      Alert.alert("Label Required", "Enter a name for this zone.");
      return;
    }
    if (isNaN(radius) || radius <= 0 || radius > 2000) {
      Alert.alert("Invalid Radius", "Enter a radius between 1 and 2000 km.");
      return;
    }
    const newZone = {
      id: `zone_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      type: editType,
      lat: pendingCoords.lat,
      lng: pendingCoords.lng,
      radiusKm: radius,
      label: zoneLabel.trim(),
    };
    const updated = [...zones, newZone];
    setZones(updated);
    injectJS("window.clearPreviewMarker()");
    setModalVisible(false);
    await saveCustomZones(updated);
    broadcastZones(updated);
    injectJS(`window.addZone(${JSON.stringify(newZone)})`);
  };

  const handleDeleteZone = (id) => {
    Alert.alert("Delete Zone", "Remove this zone from the map?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const updated = zones.filter((z) => z.id !== id);
          setZones(updated);
          await saveCustomZones(updated);
          broadcastZones(updated);
          injectJS(`window.removeZone('${id}')`);
        },
      },
    ]);
  };

  const typeMeta = (type) => ZONE_TYPES.find((t) => t.type === type) || ZONE_TYPES[0];

  return (
    <View style={styles.container}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🗺️ Zone Manager</Text>
        <View style={{ width: 70 }} />
      </View>

      {/* ── Leaflet map ── */}
      <View style={styles.mapContainer}>
        <WebView
          ref={webviewRef}
          source={{ html: ADMIN_MAP_HTML }}
          style={{ flex: 1 }}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          onLoad={handleWebViewLoad}
          onMessage={handleMessage}
        />
      </View>

      {/* ── Zone type selector ── */}
      <View style={styles.typeBar}>
        <Text style={styles.typeBarLabel}>Tap map to place:</Text>
        <View style={styles.typeBtns}>
          {ZONE_TYPES.map(({ type, emoji, label, color }) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.typeBtn,
                editType === type && { borderColor: color, backgroundColor: color + "22" },
              ]}
              onPress={() => selectEditType(type)}
            >
              <Text style={styles.typeBtnEmoji}>{emoji}</Text>
              <Text style={[styles.typeBtnText, editType === type && { color }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Zones list ── */}
      <View style={styles.listPanel}>
        <Text style={styles.listTitle}>Custom Zones ({zones.length})</Text>
        {zones.length === 0 ? (
          <Text style={styles.emptyText}>No custom zones yet — tap the map to add one.</Text>
        ) : (
          <FlatList
            data={zones}
            keyExtractor={(z) => z.id}
            style={{ flex: 1 }}
            renderItem={({ item }) => {
              const meta = typeMeta(item.type);
              return (
                <View style={styles.zoneRow}>
                  <Text style={[styles.zoneDot, { color: meta.color }]}>●</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.zoneLabel}>{item.label}</Text>
                    <Text style={styles.zoneSub}>
                      {meta.label} · {item.radiusKm} km ·{" "}
                      {item.lat.toFixed(2)}°N, {item.lng.toFixed(2)}°E
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDeleteZone(item.id)}
                  >
                    <Text style={styles.deleteBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        )}
      </View>

      {/* ── Add Zone Modal ── */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Zone</Text>
            <Text style={styles.modalCoords}>
              {typeMeta(editType).emoji} {typeMeta(editType).label}
              {pendingCoords
                ? `  ·  ${pendingCoords.lat.toFixed(3)}°N, ${pendingCoords.lng.toFixed(3)}°E`
                : ""}
            </Text>

            <Text style={styles.modalLabel}>Zone Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Punjab Border Zone"
              placeholderTextColor="#6b7280"
              value={zoneLabel}
              onChangeText={setZoneLabel}
              autoFocus
            />

            <Text style={styles.modalLabel}>Radius (km)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="50"
              placeholderTextColor="#6b7280"
              value={zoneRadius}
              onChangeText={setZoneRadius}
              keyboardType="numeric"
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { injectJS("window.clearPreviewMarker()"); setModalVisible(false); }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: typeMeta(editType).color }]}
                onPress={handleAddZone}
              >
                <Text style={styles.confirmBtnText}>Add Zone</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },

  header: {
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
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#334155",
    borderRadius: 8,
    minWidth: 70,
    alignItems: "center",
  },
  backBtnText: { color: "#93c5fd", fontWeight: "600", fontSize: 14 },
  headerTitle: { color: "#f1f5f9", fontWeight: "700", fontSize: 17 },

  mapContainer: { height: 310, backgroundColor: "#000" },

  typeBar: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  typeBarLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  typeBtns: { flexDirection: "row", gap: 8 },
  typeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#334155",
    backgroundColor: "#0f172a",
  },
  typeBtnEmoji: { fontSize: 15 },
  typeBtnText: { color: "#94a3b8", fontSize: 12, fontWeight: "600" },

  listPanel: {
    flex: 1,
    backgroundColor: "#0f172a",
    padding: 14,
  },
  listTitle: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  emptyText: { color: "#475569", fontSize: 13, textAlign: "center", marginTop: 16 },

  zoneRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  zoneDot: { fontSize: 20 },
  zoneLabel: { color: "#f1f5f9", fontSize: 13, fontWeight: "600" },
  zoneSub: { color: "#64748b", fontSize: 11, marginTop: 2 },
  deleteBtn: {
    padding: 7,
    backgroundColor: "#450a0a",
    borderRadius: 7,
  },
  deleteBtnText: { color: "#fca5a5", fontSize: 13, fontWeight: "700" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#1e293b",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 24,
    paddingBottom: 38,
    borderTopWidth: 1,
    borderTopColor: "#334155",
  },
  modalTitle: {
    color: "#f1f5f9",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  modalCoords: { color: "#64748b", fontSize: 12, marginBottom: 20 },
  modalLabel: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    color: "#f1f5f9",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 16,
  },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: "#334155",
    alignItems: "center",
  },
  cancelBtnText: { color: "#94a3b8", fontWeight: "600", fontSize: 15 },
  confirmBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: "center",
  },
  confirmBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
