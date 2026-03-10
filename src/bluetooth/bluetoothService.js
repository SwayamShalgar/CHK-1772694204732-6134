import { BleManager } from "react-native-ble-plx";
import TcpSocket from "react-native-tcp-socket";
import NetInfo from "@react-native-community/netinfo";
import { saveMessage, MESSAGE_PRIORITIES } from "../utils/offlineMessages";

export const WARSAFE_SERVICE_UUID = "0000CAFE-0000-1000-8000-00805F9B34FB";
export const WARSAFE_TCP_PORT = 57321;

let _bleManager = null;
let _tcpServer = null;
let _tcpClients = [];        
let _tcpClientSocket = null; 
let _onMessageCallback = null;
let _bleSubscription = null;
let _nearbyDevices = [];

function _getBleManager() {
  if (!_bleManager) _bleManager = new BleManager();
  return _bleManager;
}

export function startBLEScan(onUpdate) {
  const manager = _getBleManager();
  _nearbyDevices = [];

  try {
    _bleSubscription = manager.startDeviceScan(
      null, 
      { allowDuplicates: false },
      (error, device) => {
        if (error) {
          console.warn("[BLE] Scan error:", error.message);
          return;
        }
        if (!device) return;

        const name = device.name || device.localName || "";
        const isWarSafe =
          name.toLowerCase().includes("warsafe") ||
          (device.serviceUUIDs && device.serviceUUIDs.includes(WARSAFE_SERVICE_UUID));

        if (isWarSafe) {
          _nearbyDevices = _nearbyDevices.filter((d) => d.id !== device.id);
          _nearbyDevices.push({
            id: device.id,
            name: name || "Unknown WarSafe Device",
            rssi: device.rssi,
            lastSeen: Date.now(),
          });
          onUpdate([..._nearbyDevices]);
        }
      }
    );
  } catch (err) {
    console.warn("[BLE] Could not start scan:", err.message);
  }

  return () => {
    try {
      manager.stopDeviceScan();
      if (_bleSubscription) {
        _bleSubscription.remove?.();
        _bleSubscription = null;
      }
    } catch {}
  };
}

export function stopBLEScan() {
  try {
    _getBleManager().stopDeviceScan();
  } catch {}
}

export async function getLocalIP() {
  try {
    const info = await NetInfo.fetch();

    if (info.type === "wifi" && info.details?.ipAddress) {
      return info.details.ipAddress;
    }

    if (info.details?.ipAddress) {
      return info.details.ipAddress;
    }

    return "192.168.43.1";
  } catch {
    return "192.168.43.1";
  }
}

export async function detectHotspotIP() {
  const candidates = [
    "192.168.43.1",  
    "172.20.10.1",   
    "192.168.1.1",
    "192.168.0.1",
    "10.0.0.1",
    "192.168.2.1",
  ];
  for (const ip of candidates) {
    const ok = await _probe(ip, WARSAFE_TCP_PORT, 600);
    if (ok) return ip;
  }
  return null;
}

export function getSubnetPrefix(ip) {
  if (!ip) return null;
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  return `${parts[0]}.${parts[1]}.${parts[2]}.`;
}

export function sameSubnet(ipA, ipB) {
  if (!ipA || !ipB) return false;
  return getSubnetPrefix(ipA) === getSubnetPrefix(ipB);
}

function _probe(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    let done = false;
    let sock;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      try { sock?.destroy(); } catch {}
      resolve(false);
    }, timeoutMs);

    try {
      sock = TcpSocket.createConnection({ host, port, tls: false }, () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try { sock.destroy(); } catch {}
        resolve(true);
      });
      sock.on("error", () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try { sock?.destroy(); } catch {}
        resolve(false);
      });
    } catch {
      clearTimeout(timer);
      resolve(false);
    }
  });
}

export async function discoverAdminIP(onProgress, concurrency = 20) {
  const localIP = await getLocalIP();
  let prefix = getSubnetPrefix(localIP);

  const fallbackPrefixes = [
    "192.168.43.",  
    "192.168.1.",
    "192.168.0.",
    "172.20.10.",   
    "10.0.0.",
  ];

  const subnetsToScan = prefix
    ? [prefix]
    : fallbackPrefixes;

  for (const currentPrefix of subnetsToScan) {

    const candidates = [1, ...Array.from({ length: 253 }, (_, i) => i + 2)];
    const total = candidates.length;
    let probed = 0;

    for (let i = 0; i < total; i += concurrency) {
      const batch = candidates.slice(i, i + concurrency);
      const results = await Promise.all(
        batch.map(async (last) => {
          const ip = `${currentPrefix}${last}`;
          const ok = await _probe(ip, WARSAFE_TCP_PORT, 1200);
          return ok ? ip : null;
        })
      );
      probed += batch.length;

      if (currentPrefix === subnetsToScan[0]) {
        onProgress?.(Math.round((probed / total) * 100), null);
      }
      const found = results.find(Boolean);
      if (found) {
        onProgress?.(100, found);
        return found;
      }
    }
  }

  onProgress?.(100, null);
  return null;
}

export function startAdminServer(onEvent) {
  return new Promise((resolve, reject) => {
    if (_tcpServer) {
      resolve({ localIP: null });
      return;
    }

    _tcpClients = [];

    _tcpServer = TcpSocket.createServer((socket) => {
      const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
      _tcpClients.push(socket);
      onEvent?.({ type: "connect", clientId, total: _tcpClients.length });

      socket.on("close", () => {
        _tcpClients = _tcpClients.filter((s) => s !== socket);
        onEvent?.({ type: "disconnect", clientId, total: _tcpClients.length });
      });

      socket.on("error", (err) => {
        console.warn("[TCP Server] client error:", err.message);
        _tcpClients = _tcpClients.filter((s) => s !== socket);
      });
    });

    _tcpServer.on("error", (err) => {
      console.error("[TCP Server] error:", err.message);
      reject(err);
    });

    _tcpServer.listen({ port: WARSAFE_TCP_PORT, host: "0.0.0.0" }, async () => {

      let localIP = await getLocalIP();
      if (!localIP) {
        localIP = await detectHotspotIP();
      }
      onEvent?.({ type: "started", localIP, port: WARSAFE_TCP_PORT });
      resolve({ localIP });
    });
  });
}

export function broadcastOverTCP(message) {
  if (_tcpClients.length === 0) return 0;
  const payload = JSON.stringify(message) + "\n"; 
  let sent = 0;
  for (const client of _tcpClients) {
    try {
      client.write(payload);
      sent++;
    } catch (err) {
      console.warn("[TCP] failed to write to client:", err.message);
    }
  }
  return sent;
}

export function stopAdminServer() {
  try { _tcpServer?.close(); } catch {}
  _tcpServer = null;
  _tcpClients = [];
}

export function getConnectedClientCount() {
  return _tcpClients.length;
}

export function connectToAdmin(adminIP, currentUsername, onMessage, onStatus, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    if (_tcpClientSocket) {
      disconnectFromAdmin();
    }

    _onMessageCallback = onMessage;
    let buffer = "";
    let settled = false; 

    function _safeErr(err) {
      if (!err) return "Connection refused or timed out";
      if (typeof err === "string") return err;
      return err.message || err.code || JSON.stringify(err);
    }

    const connectTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { _tcpClientSocket?.destroy(); } catch {}
      _tcpClientSocket = null;
      const msg = `Timed out after ${timeoutMs / 1000}s — host unreachable or wrong IP`;
      console.warn("[TCP Client] timeout:", msg);
      onStatus?.({ type: "error", error: msg });
      reject(new Error(msg));
    }, timeoutMs);

    _tcpClientSocket = TcpSocket.createConnection(
      { host: adminIP, port: WARSAFE_TCP_PORT, tls: false },
      () => {
        clearTimeout(connectTimer);
        if (!settled) { settled = true; resolve(); }
        onStatus?.({ type: "connected", adminIP });
      }
    );

    _tcpClientSocket.on("data", async (data) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop(); 
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);

          await saveMessage(msg.from, msg.content, msg.priority);
          _onMessageCallback?.(msg);
        } catch (e) {
          console.warn("[TCP Client] bad payload:", line);
        }
      }
    });

    _tcpClientSocket.on("error", (err) => {
      clearTimeout(connectTimer);
      const msg = _safeErr(err);
      console.warn("[TCP Client] error:", msg);
      onStatus?.({ type: "error", error: msg });
      if (!settled) { settled = true; reject(new Error(msg)); }

      try { _tcpClientSocket?.destroy(); } catch {}
    });

    _tcpClientSocket.on("close", () => {
      _tcpClientSocket = null;

      if (settled) {
        onStatus?.({ type: "disconnected" });
      }
    });
  });
}

export function disconnectFromAdmin() {
  try { _tcpClientSocket?.destroy(); } catch {}
  _tcpClientSocket = null;
}

export function isConnectedToAdmin() {
  return _tcpClientSocket !== null;
}

export function tearDownAll() {
  stopAdminServer();
  disconnectFromAdmin();
  stopBLEScan();
  try { _bleManager?.destroy(); } catch {}
  _bleManager = null;
}
