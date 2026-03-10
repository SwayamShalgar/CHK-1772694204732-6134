import { ethers } from "ethers";
import { Platform } from "react-native";
import { CONTRACT_ABI } from "./contractABI";

// ─── CONFIGURATION ────────────────────────────────────────────────────────────
//
// 1. Start the local Hardhat node:
//      cd blockchain && npm run node
//
// 2. In a second terminal, deploy the contract:
//      cd blockchain && npm run deploy:local
//
// 3. Copy the printed address into CONTRACT_ADDRESS below.
//
// The default value is the address Hardhat assigns to the FIRST deployment
// on a freshly-started node (deterministic, always the same).
// ---------------------------------------------------------------------------

export const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

// Physical Android device via ADB USB: use adb reverse tcp:8545 tcp:8545
// then 127.0.0.1 on the device maps to the host's localhost.
const RPC_URL = "http://127.0.0.1:8545";

// Hardhat account #0 private key — publicly known, only holds test ETH.
// Acts as a "gas relayer" so end-users don't need wallets.
// Replace with an environment-variable-backed key before deploying to a real network.
const RELAYER_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

// ─── INTERNAL ─────────────────────────────────────────────────────────────────

let _contract = null;

/** Rejects after `ms` milliseconds — used to prevent infinite hangs when the node is offline. */
function _withTimeout(promise, ms = 6000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("RPC request timed out")), ms)
    ),
  ]);
}

/** Returns a keccak256 hash of the plain-text password (hex string). */
function _hashPassword(password) {
  return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(password));
}

/** Lazily initialises and caches the ethers Contract instance. */
async function _getContract() {
  if (_contract) return _contract;
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const signer = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);
  _contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  return _contract;
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Register a new user on the blockchain.
 * The password is hashed client-side before any network call so the
 * plain-text password never appears in a blockchain transaction.
 *
 * @returns {{ success: boolean, onChain: boolean, txHash?: string, error?: string }}
 *   onChain=false means the node was unreachable (caller may fall back to local).
 */
export async function registerUserOnChain(username, role, password) {
  try {
    const contract = await _getContract();
    const passwordHash = _hashPassword(password);
    const tx = await _withTimeout(contract.registerUser(username, role, passwordHash));
    const receipt = await _withTimeout(tx.wait(), 30000);
    return { success: true, onChain: true, txHash: receipt.transactionHash };
  } catch (err) {
    _contract = null; // reset so the next call retries a fresh connection
    const msg = err?.reason ?? err?.message ?? String(err);
    if (msg.includes("Username already taken")) {
      return { success: false, onChain: true, error: "Username already taken on blockchain." };
    }
    console.error("[Blockchain] registerUser:", msg);
    return { success: false, onChain: false, error: "Blockchain unavailable." };
  }
}

/**
 * Validate credentials against the on-chain registry (view call — no gas).
 *
 * @returns {{ success: boolean, onChain: boolean, error?: string }}
 *   onChain=false means the node was unreachable (caller may fall back to local).
 */
export async function validateLoginOnChain(username, role, password) {
  try {
    const contract = await _getContract();
    const passwordHash = _hashPassword(password);
    const valid = await _withTimeout(contract.validateLogin(username, role, passwordHash));
    return { success: valid, onChain: true };
  } catch (err) {
    _contract = null; // reset so the next call retries a fresh connection
    console.error("[Blockchain] validateLogin:", err?.message);
    return { success: false, onChain: false, error: "Blockchain unavailable." };
  }
}

/**
 * Check whether a username+role pair exists on-chain.
 * Returns null when the node is unreachable.
 */
export async function checkUserExistsOnChain(username, role) {
  try {
    const contract = await _getContract();
    return await contract.userExists(username, role);
  } catch {
    return null;
  }
}
