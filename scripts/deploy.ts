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
    "ETH"
  );

  // ── 1. Deploy MockUSDC ───────────────────────────────────────────────────
  console.log("\n[1/4] Deploying MockUSDC...");
  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log("MockUSDC deployed to:", usdcAddress);

  // ── 2. Deploy SpendGuard ─────────────────────────────────────────────────
  console.log("\n[2/4] Deploying SpendGuard...");
  const SpendGuard = await hre.ethers.getContractFactory("SpendGuard");
  const spendGuard = await SpendGuard.deploy(usdcAddress);
  await spendGuard.waitForDeployment();
  const spendGuardAddress = await spendGuard.getAddress();
  console.log("SpendGuard deployed to:", spendGuardAddress);

  console.log("\n[3/4] Seeding SpendGuard with 1,000 test USDC...");
  const SEED_AMOUNT = ethers.parseUnits("1000", 6); // 1000 USDC (6 decimals)
  
  const mintTx = await usdc.mint(deployer?.address, SEED_AMOUNT);
  await mintTx.wait(); // Wait for mint to be mined
  
  const approveTx = await usdc.approve(spendGuardAddress, SEED_AMOUNT);
  await approveTx.wait(); // Wait for approval to be mined
  
  const depositTx = await spendGuard.deposit(SEED_AMOUNT);
  await depositTx.wait(); // Wait for deposit to be mined
  
  console.log("SpendGuard funded with 1,000 USDC");

  // ── 4. Save Contract Data for Frontend ───────────────────────────────────
  console.log("\n[4/4] Saving ABIs and addresses to src/contracts...");
  saveFrontendFiles(usdcAddress, spendGuardAddress);

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  DEPLOYMENT COMPLETE");
  console.log("═══════════════════════════════════════════════════════");
  console.log("  MockUSDC   :", usdcAddress);
  console.log("  SpendGuard :", spendGuardAddress);
  console.log("═══════════════════════════════════════════════════════");
}

function saveFrontendFiles(usdcAddress: string, spendGuardAddress: string) {
  // Use process.cwd() to get the project root directory instead of __dirname
  const contractsDir = path.join(process.cwd(), "src", "contracts");

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }

  // 1. Save Addresses
  fs.writeFileSync(
    path.join(contractsDir, "addresses.json"),
    JSON.stringify(
      {
        MockUSDC: usdcAddress,
        SpendGuard: spendGuardAddress,
      },
      undefined,
      2
    )
  );

  // 2. Save ABIs (Extracting only the ABI to keep frontend imports lightweight)
  const MockUSDCArtifact = hre.artifacts.readArtifactSync("MockUSDC");
  fs.writeFileSync(
    path.join(contractsDir, "MockUSDC.json"),
    JSON.stringify({ abi: MockUSDCArtifact.abi }, null, 2)
  );

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