import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { SpendGuard } from "../typechain-types";
import { describe, it } from "mocha";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a human-readable token amount to native base units (18 decimals) */
function native(amount: number): bigint {
  return ethers.parseEther(amount.toString());
}

/** Create a deterministic agentId from a string */
function agentId(name: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(name));
}

/** Create a deterministic requestId from a string */
function requestId(name: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(name));
}

/** Create a deterministic serviceHash from a string */
function serviceHash(content: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(content));
}

/** Generate an EIP-712 signature from the Agent for SpendGuard */
async function signPayment(
  spendGuardAddress: string,
  agentSigner: SignerWithAddress,
  aId: string,
  rId: string,
  providerAddr: string,
  amount: bigint,
  svcHash: string
) {
  const domain = {
    name: "SpendGuard",
    version: "1",
    chainId: (await ethers.provider.getNetwork()).chainId,
    verifyingContract: spendGuardAddress,
  };

  const types = {
    Payment: [
      { name: "agentId", type: "bytes32" },
      { name: "requestId", type: "bytes32" },
      { name: "provider", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "serviceHash", type: "bytes32" },
    ],
  };

  const value = {
    agentId: aId,
    requestId: rId,
    provider: providerAddr,
    amount: amount,
    serviceHash: svcHash,
  };

  return agentSigner.signTypedData(domain, types, value);
}

// ─── Fixture ──────────────────────────────────────────────────────────────────

/**
 * Deploys SpendGuard and batch-initializes a default budget using setupAgent.
 */
async function deployFixture() {
  const [owner, agent, provider, attacker, stranger] = await ethers.getSigners();

  // Deploy SpendGuard (no MockUSDC needed)
  const SpendGuard = await ethers.getContractFactory("SpendGuard");
  const spendGuard = (await SpendGuard.deploy()) as SpendGuard;
  await spendGuard.waitForDeployment();
  const spendGuardAddr = await spendGuard.getAddress();

  // Initialize via Batch Setup: Register Agent + Create Budget + Deposit 100 0G
  const AGENT_ID = agentId("ResearchAgent");
  const DEPOSIT_AMOUNT = native(100);
  const BUDGET_LIMIT = native(50);
  
  await spendGuard.setupAgent(AGENT_ID, agent.address, BUDGET_LIMIT, {
    value: DEPOSIT_AMOUNT,
  });

  return {
    spendGuard,
    spendGuardAddr,
    owner,
    agent,
    provider,
    attacker,
    stranger,
    AGENT_ID,
  };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe("SpendGuard", function () {
  // ── Deployment ─────────────────────────────────────────────────────────────

  describe("Deployment", function () {
    it("should set the deployer as owner", async function () {
      const { spendGuard, owner } = await loadFixture(deployFixture);
      expect(await spendGuard.owner()).to.equal(owner.address);
    });
  });

  // ── Budget Management ──────────────────────────────────────────────────────

  describe("Budget Management", function () {
    it("owner can create a new budget", async function () {
      const { spendGuard } = await loadFixture(deployFixture);
      const NEW_AGENT = agentId("NewAgent");
      
      await expect(spendGuard.createBudget(NEW_AGENT, native(10)))
        .to.emit(spendGuard, "BudgetCreated")
        .withArgs(NEW_AGENT, native(10));

      const [limit, spent, active] = await spendGuard.getBudget(NEW_AGENT);
      expect(limit).to.equal(native(10));
      expect(spent).to.equal(BigInt(0));
      expect(active).to.be.true;
    });

    it("owner can update budget limit", async function () {
      const { spendGuard, AGENT_ID } = await loadFixture(deployFixture);
      
      await expect(spendGuard.updateBudgetLimit(AGENT_ID, native(60)))
        .to.emit(spendGuard, "BudgetUpdated")
        .withArgs(AGENT_ID, native(50), native(60));

      const [limit] = await spendGuard.getBudget(AGENT_ID);
      expect(limit).to.equal(native(60));
    });

    it("owner can pause and resume a budget", async function () {
      const { spendGuard, AGENT_ID } = await loadFixture(deployFixture);

      await expect(spendGuard.pauseBudget(AGENT_ID))
        .to.emit(spendGuard, "BudgetPaused")
        .withArgs(AGENT_ID);

      const [, , active] = await spendGuard.getBudget(AGENT_ID);
      expect(active).to.be.false;

      await expect(spendGuard.resumeBudget(AGENT_ID))
        .to.emit(spendGuard, "BudgetResumed")
        .withArgs(AGENT_ID);

      const [, , activeAfter] = await spendGuard.getBudget(AGENT_ID);
      expect(activeAfter).to.be.true;
    });

    it("cannot create duplicate budget for same agentId", async function () {
      const { spendGuard, AGENT_ID } = await loadFixture(deployFixture);
      await expect(
        spendGuard.createBudget(AGENT_ID, native(20))
      ).to.be.revertedWithCustomError(spendGuard, "BudgetAlreadyExists");
    });

    it("cannot set new limit below already-spent amount", async function () {
      const { spendGuard, spendGuardAddr, agent, provider, AGENT_ID } = await loadFixture(deployFixture);

      // Spend 30
      const reqId = requestId("req-setup-1");
      const svcHash = serviceHash("service-1");
      const sig = await signPayment(spendGuardAddr, agent, AGENT_ID, reqId, provider.address, native(30), svcHash);
      
      await spendGuard.connect(provider).claimPayment(AGENT_ID, reqId, provider.address, native(30), svcHash, sig);

      // Try to lower limit to 20 (below spent 30)
      await expect(
        spendGuard.updateBudgetLimit(AGENT_ID, native(20))
      ).to.be.revertedWith("SpendGuard: new limit below spent");
    });
  });

  // ── TEST 1 — Valid Payment ─────────────────────────────────────────────────

  describe("Test 1 — Valid Gasless EIP-712 Payment", function () {
    it("should process a valid signature and update spent correctly", async function () {
      const { spendGuard, spendGuardAddr, agent, provider, AGENT_ID } = await loadFixture(deployFixture);

      const REQ_ID = requestId("req-valid-1");
      const SVC_HASH = serviceHash("translation-result");
      const AMOUNT = native(3);

      const signature = await signPayment(spendGuardAddr, agent, AGENT_ID, REQ_ID, provider.address, AMOUNT, SVC_HASH);

      // Hardhat's changeEtherBalances safely accounts for the gas the provider spends to call claimPayment
      await expect(
        spendGuard.connect(provider).claimPayment(AGENT_ID, REQ_ID, provider.address, AMOUNT, SVC_HASH, signature)
      )
        .to.emit(spendGuard, "PaymentAuthorized")
        .withArgs(AGENT_ID, REQ_ID, provider.address, AMOUNT)
        .and.to.changeEtherBalances([spendGuard, provider], [-AMOUNT, AMOUNT]);

      const [, spent] = await spendGuard.getBudget(AGENT_ID);
      expect(spent).to.equal(AMOUNT);
    });
  });

  // ── TEST 2 — Exact Budget ──────────────────────────────────────────────────

  describe("Test 2 — Exact Budget (spend up to the limit)", function () {
    it("should allow payment that brings spent exactly to the limit", async function () {
      const { spendGuard, spendGuardAddr, agent, provider, AGENT_ID } = await loadFixture(deployFixture);

      // Current limit is 50. Pre-spend 40
      const req1 = requestId("req-pre-1");
      const sig1 = await signPayment(spendGuardAddr, agent, AGENT_ID, req1, provider.address, native(40), ethers.ZeroHash);
      await spendGuard.connect(provider).claimPayment(AGENT_ID, req1, provider.address, native(40), ethers.ZeroHash, sig1);

      // Now pay exactly the remaining 10
      const req2 = requestId("req-exact-1");
      const sig2 = await signPayment(spendGuardAddr, agent, AGENT_ID, req2, provider.address, native(10), ethers.ZeroHash);
      
      await expect(
        spendGuard.connect(provider).claimPayment(AGENT_ID, req2, provider.address, native(10), ethers.ZeroHash, sig2)
      )
        .to.emit(spendGuard, "PaymentAuthorized")
        .withArgs(AGENT_ID, req2, provider.address, native(10));

      const [limit, spent] = await spendGuard.getBudget(AGENT_ID);
      expect(spent).to.equal(limit);
      expect(await spendGuard.remainingBudget(AGENT_ID)).to.equal(BigInt(0));
    });
  });

  // ── TEST 3 — Overspend Rejection ───────────────────────────────────────────

  describe("Test 3 — Overspend Rejection (hard budget enforcement)", function () {
    it("should REVERT with BudgetExceeded when payment would exceed limit", async function () {
      const { spendGuard, spendGuardAddr, agent, provider, AGENT_ID } = await loadFixture(deployFixture);

      // Pre-spend 45 (Limit is 50)
      const req1 = requestId("req-pre-2");
      const sig1 = await signPayment(spendGuardAddr, agent, AGENT_ID, req1, provider.address, native(45), ethers.ZeroHash);
      await spendGuard.connect(provider).claimPayment(AGENT_ID, req1, provider.address, native(45), ethers.ZeroHash, sig1);

      // Attempt to spend 10
      const req2 = requestId("req-overspend");
      const sig2 = await signPayment(spendGuardAddr, agent, AGENT_ID, req2, provider.address, native(10), ethers.ZeroHash);

      await expect(
        spendGuard.connect(provider).claimPayment(AGENT_ID, req2, provider.address, native(10), ethers.ZeroHash, sig2)
      )
        .to.be.revertedWithCustomError(spendGuard, "BudgetExceeded")
        .withArgs(AGENT_ID, native(50), native(45), native(10));

      const [, spentAfter] = await spendGuard.getBudget(AGENT_ID);
      expect(spentAfter).to.equal(native(45));
    });

    it("should NOT transfer any native tokens on overspend attempt", async function () {
      const { spendGuard, spendGuardAddr, agent, provider, AGENT_ID } = await loadFixture(deployFixture);

      // Pre-spend 45 (Limit is 50)
      const req1 = requestId("req-pre-4");
      const sig1 = await signPayment(spendGuardAddr, agent, AGENT_ID, req1, provider.address, native(45), ethers.ZeroHash);
      await spendGuard.connect(provider).claimPayment(AGENT_ID, req1, provider.address, native(45), ethers.ZeroHash, sig1);

      const req2 = requestId("req-overspend-3");
      const sig2 = await signPayment(spendGuardAddr, agent, AGENT_ID, req2, provider.address, native(10), ethers.ZeroHash);

      // Attempt overspend — should revert & transfer 0
      await expect(
        spendGuard.connect(provider).claimPayment(AGENT_ID, req2, provider.address, native(10), ethers.ZeroHash, sig2)
      ).to.be.revertedWithCustomError(spendGuard, "BudgetExceeded");
      // Hardhat changeEtherBalances handles ensuring 0 funds moved automatically if reverted, but we can be explicit:
      await expect(
        spendGuard.connect(provider).claimPayment(AGENT_ID, req2, provider.address, native(10), ethers.ZeroHash, sig2)
      ).to.be.reverted; 
    });
  });

  // ── TEST 4 — Replay Protection ─────────────────────────────────────────────

  describe("Test 4 — Replay Protection", function () {
    it("should REVERT with RequestAlreadyProcessed on duplicate requestId", async function () {
      const { spendGuard, spendGuardAddr, agent, provider, AGENT_ID } = await loadFixture(deployFixture);

      const REQ_ID = requestId("req-replay-ABC");
      const sig = await signPayment(spendGuardAddr, agent, AGENT_ID, REQ_ID, provider.address, native(2), ethers.ZeroHash);

      // First claim — succeeds
      await spendGuard.connect(provider).claimPayment(AGENT_ID, REQ_ID, provider.address, native(2), ethers.ZeroHash, sig);

      // Second claim with identical signature — reverts
      await expect(
        spendGuard.connect(provider).claimPayment(AGENT_ID, REQ_ID, provider.address, native(2), ethers.ZeroHash, sig)
      )
        .to.be.revertedWithCustomError(spendGuard, "RequestAlreadyProcessed")
        .withArgs(REQ_ID);
    });

    it("isProcessed() returns true after payment", async function () {
      const { spendGuard, spendGuardAddr, agent, provider, AGENT_ID } = await loadFixture(deployFixture);

      const REQ_ID = requestId("req-is-processed");
      expect(await spendGuard.isProcessed(REQ_ID)).to.be.false;

      const sig = await signPayment(spendGuardAddr, agent, AGENT_ID, REQ_ID, provider.address, native(1), ethers.ZeroHash);
      await spendGuard.connect(provider).claimPayment(AGENT_ID, REQ_ID, provider.address, native(1), ethers.ZeroHash, sig);

      expect(await spendGuard.isProcessed(REQ_ID)).to.be.true;
    });
  });

  // ── TEST 5 — Unauthorized Mod & Signature Falsification ──────────────────

  describe("Test 5 — Unauthorized Modification & Signature Falsification", function () {
    it("agent cannot directly call setupAgent to hijack funds", async function () {
      const { spendGuard, agent, AGENT_ID } = await loadFixture(deployFixture);
      await expect(
        spendGuard.connect(agent).setupAgent(AGENT_ID, agent.address, native(100))
      ).to.be.revertedWith("NotAgentOwner");
    });

    it("agent cannot call withdraw", async function () {
      const { spendGuard, agent } = await loadFixture(deployFixture);
      await expect(
        spendGuard.connect(agent).withdraw(native(1))
      ).to.be.revertedWith("Insufficient balance"); 
    });

    it("invalid or forged signature rejects claimPayment", async function () {
      const { spendGuard, spendGuardAddr, attacker, provider, AGENT_ID } = await loadFixture(deployFixture);

      const REQ_ID = requestId("req-forged");
      // Attacker signs instead of the registered Agent
      const forgedSig = await signPayment(spendGuardAddr, attacker, AGENT_ID, REQ_ID, provider.address, native(1), ethers.ZeroHash);

      await expect(
        spendGuard.connect(provider).claimPayment(AGENT_ID, REQ_ID, provider.address, native(1), ethers.ZeroHash, forgedSig)
      ).to.be.revertedWith("Invalid signature or unauthorized agent");
    });
  });

  // ── TEST 6 — Delivery Hash Verification ───────────────────────────────────

  describe("Test 6 — Delivery Hash Verification", function () {
    it("should record the service hash on-chain after payment", async function () {
      const { spendGuard, spendGuardAddr, agent, provider, AGENT_ID } = await loadFixture(deployFixture);

      const REQ_ID = requestId("req-delivery-1");
      const CONTENT = "Translated text: Hola mundo";
      const SVC_HASH = serviceHash(CONTENT);

      const sig = await signPayment(spendGuardAddr, agent, AGENT_ID, REQ_ID, provider.address, native(2), SVC_HASH);

      await expect(
        spendGuard.connect(provider).claimPayment(AGENT_ID, REQ_ID, provider.address, native(2), SVC_HASH, sig)
      )
        .to.emit(spendGuard, "DeliveryRecorded")
        .withArgs(REQ_ID, SVC_HASH);

      const onChainHash = await spendGuard.getDeliveryHash(REQ_ID);
      expect(onChainHash).to.equal(SVC_HASH);
    });

    it("zero serviceHash should not emit DeliveryRecorded", async function () {
      const { spendGuard, spendGuardAddr, agent, provider, AGENT_ID } = await loadFixture(deployFixture);

      const REQ_ID = requestId("req-no-hash");
      const sig = await signPayment(spendGuardAddr, agent, AGENT_ID, REQ_ID, provider.address, native(1), ethers.ZeroHash);

      const tx = await spendGuard.connect(provider).claimPayment(AGENT_ID, REQ_ID, provider.address, native(1), ethers.ZeroHash, sig);

      const receipt = await tx.wait();
      const iface = spendGuard.interface;
      const deliveryTopic = iface.getEvent("DeliveryRecorded")!.topicHash;
      const hasDeliveryEvent = receipt!.logs.some(
        (l) => l.topics[0] === deliveryTopic
      );
      expect(hasDeliveryEvent).to.be.false;
    });
  });

  // ── Hackathon Demo Scenario ────────────────────────────────────────────────

  describe("Hackathon Demo Scenario — End-to-End Gasless", function () {
    it("replicates the full judge demo: Budget 5.0 0G, Spend 2.0+2.0, Block 3.0", async function () {
      const { spendGuard, spendGuardAddr, agent, provider, AGENT_ID } = await loadFixture(deployFixture);

      // Reduce test budget to 5 0G
      await spendGuard.updateBudgetLimit(AGENT_ID, native(5));

      // Purchase #1 — Translation 2 0G
      const req1 = requestId("demo-translation");
      const svc1 = serviceHash("translation-result-hello-world");
      const sig1 = await signPayment(spendGuardAddr, agent, AGENT_ID, req1, provider.address, native(2), svc1);
      
      await spendGuard.connect(provider).claimPayment(AGENT_ID, req1, provider.address, native(2), svc1, sig1);
      
      let [, spent] = await spendGuard.getBudget(AGENT_ID);
      expect(spent).to.equal(native(2));

      // Purchase #2 — Compute 2 0G
      const req2 = requestId("demo-compute");
      const svc2 = serviceHash("compute-result-matrix");
      const sig2 = await signPayment(spendGuardAddr, agent, AGENT_ID, req2, provider.address, native(2), svc2);

      await spendGuard.connect(provider).claimPayment(AGENT_ID, req2, provider.address, native(2), svc2, sig2);

      [, spent] = await spendGuard.getBudget(AGENT_ID);
      expect(spent).to.equal(native(4));
      expect(await spendGuard.remainingBudget(AGENT_ID)).to.equal(native(1));

      // Replay protection — replay trans sig1
      await expect(
        spendGuard.connect(provider).claimPayment(AGENT_ID, req1, provider.address, native(2), svc1, sig1)
      ).to.be.revertedWithCustomError(spendGuard, "RequestAlreadyProcessed");

      // ATTACK: Agent manipulated to sign for 3 0G premium compute
      const req3 = requestId("demo-attack-premium");
      const svc3 = serviceHash("premium-compute");
      const sig3 = await signPayment(spendGuardAddr, agent, AGENT_ID, req3, provider.address, native(3), svc3);

      await expect(
        spendGuard.connect(provider).claimPayment(AGENT_ID, req3, provider.address, native(3), svc3, sig3)
      )
        .to.be.revertedWithCustomError(spendGuard, "BudgetExceeded")
        .withArgs(AGENT_ID, native(5), native(4), native(3));

      // Final state verification
      const [limit, finalSpent, active] = await spendGuard.getBudget(AGENT_ID);
      expect(limit).to.equal(native(5));
      expect(finalSpent).to.equal(native(4)); 
      expect(active).to.be.true;

      console.log("\n  ═══════════════════════════════════════════════");
      console.log("  JUDGE DEMO RESULT (GASLESS)");
      console.log("  ═══════════════════════════════════════════════");
      console.log("  Budget:              5.00 0G");
      console.log("  Purchase #1 (Trans): -2.00 0G  ✓ DELIVERED");
      console.log("  Purchase #2 (Comp):  -2.00 0G  ✓ DELIVERED");
      console.log("  Replay attempt:       2.00 0G  ❌ REJECTED (RequestAlreadyProcessed)");
      console.log("  Attack attempt:       3.00 0G  ❌ REJECTED (BudgetExceeded)");
      console.log("  ───────────────────────────────────────────────");
      console.log("  Final spent:         4.00 0G");
      console.log("  Overspend prevented: ✓");
      console.log("  Double charge prev:  ✓");
      console.log("  ═══════════════════════════════════════════════\n");
    });
  });

  // ── Edge Cases ─────────────────────────────────────────────────────────────

  describe("Edge Cases", function () {
    it("should reject zero amount payment signatures", async function () {
      const { spendGuard, spendGuardAddr, agent, provider, AGENT_ID } = await loadFixture(deployFixture);

      const reqId = requestId("req-zero");
      const sig = await signPayment(spendGuardAddr, agent, AGENT_ID, reqId, provider.address, BigInt(0), ethers.ZeroHash);

      await expect(
        spendGuard.connect(provider).claimPayment(AGENT_ID, reqId, provider.address, BigInt(0), ethers.ZeroHash, sig)
      ).to.be.revertedWith("Invalid input");
    });

    it("remainingBudget returns 0 for inactive budget", async function () {
      const { spendGuard } = await loadFixture(deployFixture);
      // Not created = inactive
      expect(await spendGuard.remainingBudget(agentId("ghost"))).to.equal(BigInt(0));
    });

    it("deposit and withdraw work correctly", async function () {
      const { spendGuard, owner } = await loadFixture(deployFixture);

      const extra = native(50);
      
      // Test Deposit
      await expect(spendGuard.connect(owner).deposit({ value: extra }))
        .to.changeEtherBalances([owner, spendGuard], [-extra, extra]);

      // Test Withdraw
      await expect(spendGuard.connect(owner).withdraw(extra))
        .to.changeEtherBalances([spendGuard, owner], [-extra, extra]);
    });
  });
});