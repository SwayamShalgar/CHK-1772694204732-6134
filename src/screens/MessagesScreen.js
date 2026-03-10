import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
  Vibration,
} from "react-native";
import {
  getAllMessages,
  markAllRead,
  markRead,
  deleteMessage,
  getUnreadCount,
  MESSAGE_PRIORITIES,
  priorityMeta,
  formatTimestamp,
} from "../utils/offlineMessages";
import {
  connectToAdmin,
  disconnectFromAdmin,
  isConnectedToAdmin,
  startBLEScan,
  stopBLEScan,
  discoverAdminIP,
  getLocalIP,
} from "../bluetooth/bluetoothService";

export default function MessagesScreen({ username, onBack }) {
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [adminIP, setAdminIP] = useState("");
  const [tcpConnected, setTcpConnected] = useState(false);
  const [tcpConnecting, setTcpConnecting] = useState(false);
  const [tcpStatus, setTcpStatus] = useState("disconnected"); 

  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [localIP, setLocalIP] = useState(null);

  const [nearbyDevices, setNearbyDevices] = useState([]);
  const [bleScanning, setBleScanning] = useState(false);

  const [activeTab, setActiveTab] = useState("messages"); 

  const refreshTimerRef = useRef(null);
  const stopBLERef = useRef(null);

  useEffect(() => {
    loadMessages();
    getLocalIP().then((ip) => setLocalIP(ip));

    refreshTimerRef.current = setInterval(loadMessages, 5000);
    return () => {
      clearInterval(refreshTimerRef.current);
      disconnectFromAdmin();
      if (stopBLERef.current) stopBLERef.current();
    };
  }, []);

  const loadMessages = useCallback(async () => {
    const msgs = await getAllMessages();
    const unread = await getUnreadCount();
    setMessages(msgs);
    setUnreadCount(unread);
    setLoading(false);
  }, []);

  const handleAutoDiscover = async () => {
    if (!localIP) {
      Alert.alert(
        "No Network",
        "This device has no WiFi/hotspot IP.\n\nPlease connect to the admin's hotspot first, then try again."
      );
      return;
    }
    setScanning(true);
    setScanProgress(0);
    const found = await discoverAdminIP((progress) => {
      setScanProgress(progress);
    });
    setScanning(false);
    if (found) {
      setAdminIP(found);
      Alert.alert("Admin Found! 🎉", `Admin server found at ${found}\n\nTap Connect to join.`);
    } else {
      Alert.alert(
        "Not Found",
        "No WarSafe admin server found on this network.\n\nMake sure:\n• Admin has tapped \"Start Server\"\n• Both devices are on the same hotspot"
      );
    }
  };

  const handleConnect = async () => {

    const raw = adminIP.trim();
    const ip = raw.includes(":") ? raw.split(":")[0] : raw;

    if (!ip) {
      Alert.alert("IP Required", "Enter the admin's IP or tap \"Find Admin\" to scan automatically.");
      return;
    }

    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
      Alert.alert(
        "Invalid IP",
        `"${ip}" doesn't look like an IPv4 address.\nExample: 192.168.43.1\n\nYou can paste the full address (e.g. 172.16.2.119:57321) — the port will be stripped automatically.`
      );
      return;
    }

    _doConnect(ip);
  };

  const _doConnect = async (ip) => {
    setTcpConnecting(true);
    try {
      await connectToAdmin(
        ip,
        username,
        (msg) => {

          Vibration.vibrate(200);
          loadMessages();
        },
        (status) => {
          if (status.type === "connected") {
            setTcpConnected(true);
            setTcpStatus("connected");
            setTcpConnecting(false);
          } else if (status.type === "disconnected") {
            setTcpConnected(false);
            setTcpStatus("disconnected");
          } else if (status.type === "error") {
            setTcpConnected(false);
            setTcpStatus("error");
            setTcpConnecting(false);
            Alert.alert(
              "Connection Failed",
              `Could not reach ${ip}:57321\n\n` +
              `Reason: ${status.error || "unknown"}\n\n` +
              "Make sure:\n• Admin's server is started\n• Both devices are on the same WiFi/hotspot\n• The IP address is correct"
            );
          }
        }
      );
    } catch (err) {
      setTcpConnecting(false);
      setTcpStatus("error");
    }
  };

  const handleDisconnect = () => {
    disconnectFromAdmin();
    setTcpConnected(false);
    setTcpStatus("disconnected");
  };

  const handleToggleBLEScan = () => {
    if (bleScanning) {
      if (stopBLERef.current) stopBLERef.current();
      stopBLERef.current = null;
      setBleScanning(false);
      return;
    }
    setBleScanning(true);
    stopBLERef.current = startBLEScan((devices) => {
      setNearbyDevices(devices);
    });

    setTimeout(() => {
      if (stopBLERef.current) {
        stopBLERef.current();
        stopBLERef.current = null;
      }
      setBleScanning(false);
    }, 30000);
  };

  const handleMarkAllRead = async () => {
    await markAllRead();
    loadMessages();
  };

  const handleDeleteMessage = async (id) => {
    await deleteMessage(id);
    loadMessages();
  };

  const handleOpenMessage = async (msg) => {
    if (!msg.read) {
      await markRead(msg.id);
      loadMessages();
    }
    const m = priorityMeta(msg.priority);
    Alert.alert(
      `${m.icon} ${m.label} — from ${msg.from}`,
      `${msg.content}\n\n${formatTimestamp(msg.timestamp)}`,
      [
        { text: "Delete", style: "destructive", onPress: () => handleDeleteMessage(msg.id) },
        { text: "Close" },
      ]
    );
  };

  const transportIcon = tcpConnected
    ? "🟢 WiFi Connected"
    : bleScanning
    ? "🔵 BLE Scanning…"
    : "⚫ Offline";

  return (
    <View style={styles.container}>

      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Messages</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBubble}>
              <Text style={styles.unreadBubbleText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <Text style={styles.transportBadge}>{transportIcon}</Text>
      </View>

      <View style={styles.tabBar}>
        {["messages", "connect", "nearby"].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabBtnText, activeTab === tab && styles.tabBtnTextActive]}>
              {tab === "messages" ? `📥 Inbox${unreadCount > 0 ? ` (${unreadCount})` : ""}` :
               tab === "connect"  ? "📡 Connect" :
                                    "🔵 Nearby"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === "messages" && (
        <View style={styles.tabContent}>
          {messages.length > 0 && unreadCount > 0 && (
            <TouchableOpacity style={styles.markAllBtn} onPress={handleMarkAllRead}>
              <Text style={styles.markAllBtnText}>✓ Mark all as read</Text>
            </TouchableOpacity>
          )}
          {loading ? (
            <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 40 }} />
          ) : messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyTitle}>No Messages</Text>
              <Text style={styles.emptyHint}>
                Ask your admin to broadcast a message, or connect to the admin&#39;s server in the &#34;Connect&#34; tab.
              </Text>
            </View>
          ) : (
            <FlatList
              data={messages}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
              renderItem={({ item }) => {
                const m = priorityMeta(item.priority);
                return (
                  <TouchableOpacity
                    style={[
                      styles.msgCard,
                      { borderLeftColor: m.color },
                    ]}
                    onPress={() => handleOpenMessage(item)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.msgCardRow}>
                      <View style={[styles.priorityBadge, { backgroundColor: m.color }]}>
                        <Text style={styles.priorityBadgeText}>{m.icon} {m.label}</Text>
                      </View>
                      <Text style={styles.msgTimestamp}>{formatTimestamp(item.timestamp)}</Text>
                      {!item.read && <View style={styles.unreadDot} />}
                    </View>
                    <Text style={styles.msgFrom}>From: {item.from}</Text>
                    <Text style={styles.msgContent} numberOfLines={3}>{item.content}</Text>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      )}

      {activeTab === "connect" && (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.connectContent}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📡 Connect to Admin Server</Text>

            <View style={styles.myIPRow}>
              <Text style={styles.myIPLabel}>Your IP: </Text>
              <Text style={[styles.myIPValue, !localIP && { color: "#ef4444" }]}>
                {localIP || "No WiFi — join hotspot first"}
              </Text>
            </View>

            <View style={styles.howToBox}>
              <Text style={styles.howToTitle}>Setup (no internet needed):</Text>
              <Text style={styles.howToStep}>1. Admin enables mobile hotspot on their phone</Text>
              <Text style={styles.howToStep}>2. Your phone connects to that hotspot</Text>
              <Text style={styles.howToStep}>3. Admin taps &ldquo;Start Server&rdquo; in Broadcast screen</Text>
              <Text style={styles.howToStep}>4. Tap &ldquo;Find Admin&rdquo; below — or enter IP manually</Text>
              <Text style={styles.howToStep}>5. Tap Connect → messages arrive instantly ✓</Text>
            </View>

            <View style={[styles.statusBadge, tcpConnected ? styles.statusConnected : tcpStatus === "error" ? styles.statusError : styles.statusIdle]}>
              <Text style={styles.statusText}>
                {tcpConnected ? "● Connected to admin server"
                 : tcpStatus === "error" ? "✕ Connection failed — check network"
                 : "○ Not connected"}
              </Text>
            </View>

            {!tcpConnected ? (
              <>

                <TouchableOpacity
                  style={[styles.findBtn, (scanning || tcpConnecting) && { opacity: 0.6 }]}
                  onPress={handleAutoDiscover}
                  disabled={scanning || tcpConnecting}
                >
                  {scanning ? (
                    <View style={styles.findBtnRow}>
                      <ActivityIndicator color="#fff" size="small" />
                      <Text style={styles.findBtnText}>  Scanning network… {scanProgress}%</Text>
                    </View>
                  ) : (
                    <Text style={styles.findBtnText}>🔍  Find Admin Automatically</Text>
                  )}
                </TouchableOpacity>

                {scanning && (
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${scanProgress}%` }]} />
                  </View>
                )}

                <Text style={styles.orDivider}>— or enter IP manually —</Text>

                <Text style={styles.inputLabel}>Admin&apos;s Local IP Address</Text>
                <TextInput
                  style={styles.ipInput}
                  placeholder="e.g. 192.168.43.1  or  192.168.43.1:57321"
                  placeholderTextColor="#94a3b8"
                  value={adminIP}
                  onChangeText={(t) => { setAdminIP(t); }}
                  keyboardType="default"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={styles.ipHint}>Port is stripped automatically if pasted with it.</Text>
                <TouchableOpacity
                  style={[styles.connectBtn, (tcpConnecting || scanning) && { opacity: 0.6 }]}
                  onPress={handleConnect}
                  disabled={tcpConnecting || scanning}
                >
                  {tcpConnecting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.connectBtnText}>Connect</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={styles.disconnectBtn} onPress={handleDisconnect}>
                <Text style={styles.disconnectBtnText}>Disconnect</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      )}

      {activeTab === "nearby" && (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.connectContent}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🔵 Nearby WarSafe Devices</Text>
            <Text style={styles.cardDesc}>
              Scan for other WarSafe Network devices via Bluetooth LE. This enables mesh-awareness — devices can relay broadcasts to others out of WiFi range.
            </Text>

            <TouchableOpacity
              style={[styles.scanBtn, bleScanning ? styles.scanBtnStop : styles.scanBtnStart]}
              onPress={handleToggleBLEScan}
            >
              {bleScanning ? (
                <View style={styles.scanningRow}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.scanBtnText}>  Scanning… (tap to stop)</Text>
                </View>
              ) : (
                <Text style={styles.scanBtnText}>🔍  Scan for Nearby Devices</Text>
              )}
            </TouchableOpacity>

            {nearbyDevices.length === 0 ? (
              <View style={styles.nearbyEmpty}>
                <Text style={styles.nearbyEmptyIcon}>📡</Text>
                <Text style={styles.nearbyEmptyText}>
                  {bleScanning ? "Searching for WarSafe devices…" : "No nearby devices found yet."}
                </Text>
              </View>
            ) : (
              nearbyDevices.map((dev) => (
                <View key={dev.id} style={styles.deviceCard}>
                  <Text style={styles.deviceName}>{dev.name}</Text>
                  <Text style={styles.deviceId}>{dev.id}</Text>
                  <Text style={styles.deviceRSSI}>Signal: {dev.rssi} dBm</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
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
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerTitle: { color: "#fff", fontWeight: "800", fontSize: 18 },
  unreadBubble: {
    backgroundColor: "#ef4444",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  unreadBubbleText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  transportBadge: { fontSize: 11, color: "#64748b", maxWidth: 110, textAlign: "right" },

  tabBar: {
    flexDirection: "row",
    backgroundColor: "#1e293b",
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: "#3b82f6" },
  tabBtnText: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  tabBtnTextActive: { color: "#93c5fd" },

  tabContent: { flex: 1 },

  markAllBtn: {
    alignSelf: "flex-end",
    margin: 12,
    marginBottom: 0,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#1e3a5f",
    borderRadius: 8,
  },
  markAllBtnText: { fontSize: 12, color: "#93c5fd", fontWeight: "600" },

  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, marginTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#94a3b8", marginBottom: 8 },
  emptyHint: { fontSize: 13, color: "#475569", textAlign: "center", lineHeight: 20 },

  msgCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: "#334155",
    borderRightColor: "#334155",
    borderBottomColor: "#334155",
  },
  msgCardRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  priorityBadge: { borderRadius: 6, paddingVertical: 2, paddingHorizontal: 8 },
  priorityBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  msgTimestamp: { fontSize: 11, color: "#475569", flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#3b82f6" },
  msgFrom: { fontSize: 11, color: "#64748b", marginBottom: 4, fontStyle: "italic" },
  msgContent: { fontSize: 14, color: "#e2e8f0", lineHeight: 20 },

  connectContent: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#f1f5f9", marginBottom: 8 },
  cardDesc: { fontSize: 12, color: "#64748b", lineHeight: 18, marginBottom: 14 },

  howToBox: {
    backgroundColor: "#0c1e35",
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#1e3a5f",
  },
  howToTitle: { fontSize: 12, fontWeight: "700", color: "#93c5fd", marginBottom: 6 },
  howToStep: { fontSize: 12, color: "#94a3b8", lineHeight: 22 },

  myIPRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  myIPLabel: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  myIPValue: { fontSize: 12, color: "#4ade80", fontWeight: "700", fontFamily: Platform.OS === "android" ? "monospace" : "Courier" },

  findBtn: {
    backgroundColor: "#1d4ed8",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    marginBottom: 8,
  },
  findBtnRow: { flexDirection: "row", alignItems: "center" },
  findBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  progressBarBg: {
    height: 4,
    backgroundColor: "#334155",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 10,
  },
  progressBarFill: {
    height: 4,
    backgroundColor: "#3b82f6",
    borderRadius: 2,
  },
  orDivider: { fontSize: 11, color: "#475569", textAlign: "center", marginVertical: 10 },

  statusBadge: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 14,
    borderWidth: 1,
  },
  statusConnected: { backgroundColor: "#0a2e1a", borderColor: "#15803d" },
  statusError: { backgroundColor: "#2e0a0a", borderColor: "#7f1d1d" },
  statusIdle: { backgroundColor: "#0f172a", borderColor: "#334155" },
  statusText: { fontSize: 13, fontWeight: "600", color: "#94a3b8" },

  inputLabel: { fontSize: 12, fontWeight: "600", color: "#94a3b8", marginBottom: 6 },
  ipInput: {
    backgroundColor: "#0f172a",
    borderWidth: 1.5,
    borderColor: "#334155",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 16,
    color: "#f1f5f9",
    marginBottom: 4,
    fontFamily: Platform.OS === "android" ? "monospace" : "Courier",
  },
  ipHint: { fontSize: 11, color: "#475569", marginBottom: 12, paddingHorizontal: 2 },
  connectBtn: {
    backgroundColor: "#1d4ed8",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  connectBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  disconnectBtn: {
    backgroundColor: "#2e0a0a",
    borderWidth: 1,
    borderColor: "#7f1d1d",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  disconnectBtnText: { color: "#fca5a5", fontWeight: "700", fontSize: 15 },

  scanBtn: { borderRadius: 10, paddingVertical: 13, alignItems: "center", marginBottom: 14 },
  scanBtnStart: { backgroundColor: "#2563eb" },
  scanBtnStop: { backgroundColor: "#475569" },
  scanBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  scanningRow: { flexDirection: "row", alignItems: "center" },

  nearbyEmpty: { alignItems: "center", paddingVertical: 32 },
  nearbyEmptyIcon: { fontSize: 36, marginBottom: 8 },
  nearbyEmptyText: { fontSize: 13, color: "#475569", textAlign: "center" },

  deviceCard: {
    backgroundColor: "#0c1e35",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#1e3a5f",
  },
  deviceName: { fontSize: 14, fontWeight: "700", color: "#93c5fd" },
  deviceId: { fontSize: 10, color: "#475569", marginTop: 2, fontFamily: Platform.OS === "android" ? "monospace" : "Courier" },
  deviceRSSI: { fontSize: 11, color: "#64748b", marginTop: 4 },
});
