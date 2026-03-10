import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
  Clipboard,
} from "react-native";
import {
  saveMessage,
  getAllMessages,
  clearAllMessages,
  MESSAGE_PRIORITIES,
  priorityMeta,
  formatTimestamp,
} from "../utils/offlineMessages";
import {
  startAdminServer,
  stopAdminServer,
  broadcastOverTCP,
  getLocalIP,
  getConnectedClientCount,
} from "../bluetooth/bluetoothService";

const PRIORITIES = [
  MESSAGE_PRIORITIES.INFO,
  MESSAGE_PRIORITIES.WARNING,
  MESSAGE_PRIORITIES.DANGER,
  MESSAGE_PRIORITIES.EVACUATION,
];

export default function AdminBroadcastScreen({ username, onBack }) {
  const [messageText, setMessageText] = useState("");
  const [priority, setPriority] = useState(MESSAGE_PRIORITIES.INFO);
  const [sentMessages, setSentMessages] = useState([]);
  const [serverRunning, setServerRunning] = useState(false);
  const [serverLoading, setServerLoading] = useState(false);
  const [localIP, setLocalIP] = useState(null);
  const [connectedCount, setConnectedCount] = useState(0);
  const [sending, setSending] = useState(false);

  const countTimerRef = useRef(null);

  useEffect(() => {
    loadMessages();
    return () => {
      if (countTimerRef.current) clearInterval(countTimerRef.current);
    };
  }, []);

  const loadMessages = useCallback(async () => {
    const msgs = await getAllMessages();
    setSentMessages(msgs);
  }, []);

  useEffect(() => {
    if (serverRunning) {
      countTimerRef.current = setInterval(() => {
        setConnectedCount(getConnectedClientCount());
      }, 1500);
    } else {
      clearInterval(countTimerRef.current);
      setConnectedCount(0);
    }
    return () => clearInterval(countTimerRef.current);
  }, [serverRunning]);

  const handleToggleServer = async () => {
    if (serverRunning) {
      stopAdminServer();
      setServerRunning(false);
      setLocalIP(null);
      setConnectedCount(0);
      return;
    }

    setServerLoading(true);
    try {
      const { localIP: ip } = await startAdminServer((event) => {
        if (event.type === "connect") {
          setConnectedCount(event.total);
        } else if (event.type === "disconnect") {
          setConnectedCount(event.total);
        }
      });

      const detected = ip || (await getLocalIP()) || "192.168.43.1";
      setLocalIP(detected);
      setServerRunning(true);
    } catch (err) {
      Alert.alert("Server Error", err.message || "Could not start server.");
    } finally {
      setServerLoading(false);
    }
  };

  const copyIP = () => {
    const displayIP = (localIP || "192.168.43.1") + ":57321";
    Clipboard.setString(displayIP);
    Alert.alert("Copied", `${displayIP} copied to clipboard. Share this with users.`);
  };

  const handleBroadcast = async () => {
    if (!messageText.trim()) {
      Alert.alert("Empty Message", "Please type a message before broadcasting.");
      return;
    }

    setSending(true);
    try {

      const msg = await saveMessage(username, messageText.trim(), priority);

      const tcpCount = broadcastOverTCP(msg);

      const meta = priorityMeta(priority);
      let detail = `Saved to local inbox.`;
      if (tcpCount > 0) {
        detail = `Delivered to ${tcpCount} connected device${tcpCount > 1 ? "s" : ""} via WiFi.`;
      } else if (serverRunning) {
        detail = `Server active. Waiting for users to connect.\nMessage saved to inbox.`;
      }

      Alert.alert(`${meta.icon} Broadcast Sent`, detail);
      setMessageText("");
      await loadMessages();
    } finally {
      setSending(false);
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      "Clear All Messages",
      "This will delete all broadcast messages from the local store. Proceed?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            await clearAllMessages();
            setSentMessages([]);
          },
        },
      ]
    );
  };

  const meta = priorityMeta(priority);

  return (
    <View style={styles.container}>

      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📢 Broadcast</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >

        <View style={styles.card}>
          <Text style={styles.cardTitle}>📡 WiFi Broadcast Server</Text>
          <Text style={styles.cardSubtitle}>
            Start the server so users on the same WiFi / hotspot can receive messages in real time — no internet needed.
          </Text>

          <TouchableOpacity
            style={[styles.serverBtn, serverRunning ? styles.serverBtnStop : styles.serverBtnStart]}
            onPress={handleToggleServer}
            disabled={serverLoading}
          >
            {serverLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.serverBtnText}>
                {serverRunning ? "■  Stop Server" : "▶  Start Server (No Internet)"}
              </Text>
            )}
          </TouchableOpacity>

          {serverRunning && (
            <View style={styles.serverInfoBox}>
              <Text style={styles.serverInfoLabel}>Tell users to connect to your hotspot, then enter:</Text>
              <TouchableOpacity style={styles.ipRow} onPress={copyIP} activeOpacity={0.7}>
                <Text style={styles.ipText}>{localIP || "192.168.43.1"}:57321</Text>
                <Text style={styles.ipCopyHint}>  📋 tap to copy</Text>
              </TouchableOpacity>
              {localIP && localIP !== "192.168.43.1" && (
                <Text style={styles.hotspotHint}>
                  📱 If using Android hotspot: <Text style={{ fontWeight: "800" }}>192.168.43.1</Text>
                </Text>
              )}
              <View style={styles.connectedRow}>
                <View style={[styles.dot, connectedCount > 0 ? styles.dotActive : styles.dotIdle]} />
                <Text style={styles.connectedText}>
                  {connectedCount === 0
                    ? "No users connected yet"
                    : `${connectedCount} user${connectedCount > 1 ? "s" : ""} connected`}
                </Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>✏️ Compose Broadcast</Text>

          <Text style={styles.inputLabel}>Alert Level</Text>
          <View style={styles.priorityRow}>
            {PRIORITIES.map((p) => {
              const m = priorityMeta(p);
              const active = priority === p;
              return (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.priorityBtn,
                    active && { backgroundColor: m.color, borderColor: m.color },
                  ]}
                  onPress={() => setPriority(p)}
                >
                  <Text style={styles.priorityBtnIcon}>{m.icon}</Text>
                  <Text
                    style={[
                      styles.priorityBtnLabel,
                      active && { color: "#fff", fontWeight: "700" },
                    ]}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.inputLabel}>Message</Text>
          <TextInput
            style={[styles.textArea, { borderColor: meta.color }]}
            placeholder="Type your broadcast message here…"
            placeholderTextColor="#94a3b8"
            value={messageText}
            onChangeText={setMessageText}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={500}
          />
          <Text style={styles.charCount}>{messageText.length}/500</Text>

          <TouchableOpacity
            style={[styles.broadcastBtn, { backgroundColor: meta.color }, sending && { opacity: 0.6 }]}
            onPress={handleBroadcast}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.broadcastBtnText}>{meta.icon}  Broadcast Message</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.historyHeader}>
          <Text style={styles.sectionTitle}>Sent Messages ({sentMessages.length})</Text>
          {sentMessages.length > 0 && (
            <TouchableOpacity onPress={handleClearAll}>
              <Text style={styles.clearAllText}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>

        {sentMessages.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>📭</Text>
            <Text style={styles.emptyStateText}>No messages sent yet.</Text>
          </View>
        ) : (
          sentMessages.map((msg) => {
            const m = priorityMeta(msg.priority);
            return (
              <View key={msg.id} style={[styles.msgCard, { borderLeftColor: m.color, backgroundColor: m.bg }]}>
                <View style={styles.msgCardHeader}>
                  <View style={[styles.priorityBadge, { backgroundColor: m.color }]}>
                    <Text style={styles.priorityBadgeText}>{m.icon} {m.label}</Text>
                  </View>
                  <Text style={styles.msgTimestamp}>{formatTimestamp(msg.timestamp)}</Text>
                </View>
                <Text style={styles.msgContent}>{msg.content}</Text>
              </View>
            );
          })
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#6d28d9",
    paddingTop: Platform.OS === "android" ? 40 : 56,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 8,
    minWidth: 70,
    alignItems: "center",
  },
  backBtnText: { color: "#e9d5ff", fontWeight: "600", fontSize: 14 },
  headerTitle: { color: "#fff", fontWeight: "800", fontSize: 18 },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#1e293b", marginBottom: 6 },
  cardSubtitle: { fontSize: 12, color: "#64748b", marginBottom: 14, lineHeight: 18 },

  serverBtn: {
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    marginBottom: 12,
  },
  serverBtnStart: { backgroundColor: "#16a34a" },
  serverBtnStop: { backgroundColor: "#dc2626" },
  serverBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  serverInfoBox: {
    backgroundColor: "#f0fdf4",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  serverInfoLabel: { fontSize: 11, color: "#166534", fontWeight: "600", marginBottom: 6 },
  hotspotHint: { fontSize: 11, color: "#166534", marginBottom: 6 },
  ipRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  ipText: { fontSize: 17, fontWeight: "800", color: "#15803d", fontFamily: Platform.OS === "android" ? "monospace" : "Courier" },
  ipCopyHint: { fontSize: 11, color: "#16a34a" },
  connectedRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { backgroundColor: "#16a34a" },
  dotIdle: { backgroundColor: "#94a3b8" },
  connectedText: { fontSize: 12, color: "#475569" },

  inputLabel: { fontSize: 12, fontWeight: "600", color: "#64748b", marginBottom: 8, marginTop: 4 },

  priorityRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  priorityBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  priorityBtnIcon: { fontSize: 14 },
  priorityBtnLabel: { fontSize: 12, fontWeight: "600", color: "#475569" },

  textArea: {
    backgroundColor: "#f8fafc",
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: "#1e293b",
    minHeight: 100,
    marginBottom: 4,
  },
  charCount: { fontSize: 11, color: "#94a3b8", textAlign: "right", marginBottom: 14 },

  broadcastBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  broadcastBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },

  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8 },
  clearAllText: { fontSize: 13, color: "#ef4444", fontWeight: "600" },

  emptyState: { alignItems: "center", paddingVertical: 32 },
  emptyStateIcon: { fontSize: 40, marginBottom: 8 },
  emptyStateText: { fontSize: 14, color: "#94a3b8" },

  msgCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  msgCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  priorityBadge: { borderRadius: 6, paddingVertical: 2, paddingHorizontal: 8 },
  priorityBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  msgTimestamp: { fontSize: 11, color: "#94a3b8" },
  msgContent: { fontSize: 14, color: "#1e293b", lineHeight: 20 },
});
