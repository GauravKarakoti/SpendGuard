import { ethers } from "ethers";
import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer?.address);
  console.log(
    "Account balance:",
    ethers.formatEther(await hre.ethers.provider.getBalance(deployer?.address)),
    "0G" 
  );

  // ── 1. Deploy SpendGuard ─────────────────────────────────────────────────
  console.log("\n[1/2] Deploying SpendGuard...");
  const SpendGuard = await hre.ethers.getContractFactory("SpendGuard");
  
  // No arguments needed since MockUSDC was removed and we use native token
  const spendGuard = await SpendGuard.deploy();
  await spendGuard.waitForDeployment();
  
  const spendGuardAddress = await spendGuard.getAddress();
  console.log("SpendGuard deployed to:", spendGuardAddress);

  // ── 2. Save Contract Data for Frontend ───────────────────────────────────
  console.log("\n[2/2] Saving ABIs and addresses to src/contracts...");
  saveFrontendFiles(spendGuardAddress);

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("   DEPLOYMENT COMPLETE");
  console.log("═══════════════════════════════════════════════════════");
  console.log("   SpendGuard :", spendGuardAddress);
  console.log("═══════════════════════════════════════════════════════");
}

function saveFrontendFiles(spendGuardAddress: string) {
  const contractsDir = path.join(process.cwd(), "src", "contracts");

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }

  // 1. Save Addresses
  fs.writeFileSync(
    path.join(contractsDir, "addresses.json"),
    JSON.stringify(
      {
        SpendGuard: spendGuardAddress,
      },
      undefined,
      2
    )
  );

  // 2. Save ABIs
  const SpendGuardArtifact = hre.artifacts.readArtifactSync("SpendGuard");
  fs.writeFileSync(
    path.join(contractsDir, "SpendGuard.json"),
    JSON.stringify({ abi: SpendGuardArtifact.abi }, null, 2)
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});