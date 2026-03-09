import { ethers } from "ethers";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Hardhat account #0 — default test private key, holds test ETH on localhost
const DEPLOYER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const RPC_URL = "http://127.0.0.1:8545";

async function main() {
  // Load compiled artifact produced by `npm run compile`
  const artifactPath = resolve(
    __dirname,
    "../artifacts/contracts/UserRegistry.sol/UserRegistry.json"
  );
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const deployer = new ethers.Wallet(DEPLOYER_KEY, provider);

  console.log("Deploying UserRegistry with account:", deployer.address);

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);
  const registry = await factory.deploy();
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log("✅ UserRegistry deployed to:", address);
  console.log("");
  console.log("📋 Next step:");
  console.log("   Copy this address into ../src/blockchain/blockchainService.js");
  console.log('   → CONTRACT_ADDRESS = "' + address + '"');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
