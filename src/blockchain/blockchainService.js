import { ethers } from "ethers";
import { Platform } from "react-native";
import { CONTRACT_ABI } from "./contractABI";

export const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

const RPC_URL = "http://127.0.0.1:8545";

const RELAYER_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

let _contract = null;

function _withTimeout(promise, ms = 6000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("RPC request timed out")), ms)
    ),
  ]);
}

function _hashPassword(password) {
  return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(password));
}

async function _getContract() {
  if (_contract) return _contract;
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const signer = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);
  _contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  return _contract;
}

export async function registerUserOnChain(username, role, password) {
  try {
    const contract = await _getContract();
    const passwordHash = _hashPassword(password);
    const tx = await _withTimeout(contract.registerUser(username, role, passwordHash));
    const receipt = await _withTimeout(tx.wait(), 30000);
    return { success: true, onChain: true, txHash: receipt.transactionHash };
  } catch (err) {
    _contract = null; 
    const msg = err?.reason ?? err?.message ?? String(err);
    if (msg.includes("Username already taken")) {
      return { success: false, onChain: true, error: "Username already taken on blockchain." };
    }
    console.error("[Blockchain] registerUser:", msg);
    return { success: false, onChain: false, error: "Blockchain unavailable." };
  }
}

export async function validateLoginOnChain(username, role, password) {
  try {
    const contract = await _getContract();
    const passwordHash = _hashPassword(password);
    const valid = await _withTimeout(contract.validateLogin(username, role, passwordHash));
    return { success: valid, onChain: true };
  } catch (err) {
    _contract = null; 
    console.error("[Blockchain] validateLogin:", err?.message);
    return { success: false, onChain: false, error: "Blockchain unavailable." };
  }
}

export async function checkUserExistsOnChain(username, role) {
  try {
    const contract = await _getContract();
    return await contract.userExists(username, role);
  } catch {
    return null;
  }
}
