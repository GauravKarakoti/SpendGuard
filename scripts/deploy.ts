import { ethers } from "ethers";
import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer?.address);
  console.log(
    "Account balance:",
    ethers.formatEther(await hre.ethers.provider.getBalance(deployer?.address)),
    "ETH"
  );

  // ── 1. Deploy MockUSDC ───────────────────────────────────────────────────
  console.log("\n[1/3] Deploying MockUSDC...");
  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log("MockUSDC deployed to:", usdcAddress);

  // ── 2. Deploy SpendGuard ─────────────────────────────────────────────────
  console.log("\n[2/3] Deploying SpendGuard...");
  const SpendGuard = await hre.ethers.getContractFactory("SpendGuard");
  const spendGuard = await SpendGuard.deploy(usdcAddress);
  await spendGuard.waitForDeployment();
  const spendGuardAddress = await spendGuard.getAddress();
  console.log("SpendGuard deployed to:", spendGuardAddress);

  // ── 3. Seed the contract with test USDC ──────────────────────────────────
  console.log("\n[3/3] Seeding SpendGuard with 1,000 test USDC...");
  const SEED_AMOUNT = ethers.parseUnits("1000", 6); // 1000 USDC (6 decimals)
  await usdc.mint(deployer?.address, SEED_AMOUNT);
  await usdc.approve(spendGuardAddress, SEED_AMOUNT);
  await spendGuard.deposit(SEED_AMOUNT);
  console.log("SpendGuard funded with 1,000 USDC");

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  DEPLOYMENT COMPLETE");
  console.log("═══════════════════════════════════════════════════════");
  console.log("  MockUSDC   :", usdcAddress);
  console.log("  SpendGuard :", spendGuardAddress);
  console.log("═══════════════════════════════════════════════════════");
  console.log("\nAdd these to your .env:");
  console.log(`NEXT_PUBLIC_SPENDGUARD_ADDRESS=${spendGuardAddress}`);
  console.log(`NEXT_PUBLIC_USDC_ADDRESS=${usdcAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
