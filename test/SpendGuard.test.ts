import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { SpendGuard, MockUSDC } from "../typechain-types";
import { describe, it } from "mocha";


// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a human-readable USDC amount to base units (6 decimals) */
function usdc(amount: number): bigint {
  return ethers.parseUnits(amount.toString(), 6);
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

// ─── Fixture ──────────────────────────────────────────────────────────────────

/**
 * Deploys MockUSDC + SpendGuard, mints tokens to owner,
 * deposits into SpendGuard, and creates a default budget.
 */
async function deployFixture() {
  const [owner, agent, provider, attacker, stranger] =
    await ethers.getSigners();

  // Deploy MockUSDC
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const token = (await MockUSDC.deploy()) as MockUSDC;
  await token.waitForDeployment();

  // Deploy SpendGuard
  const SpendGuard = await ethers.getContractFactory("SpendGuard");
  const spendGuard = (await SpendGuard.deploy(
    await token.getAddress()
  )) as SpendGuard;
  await spendGuard.waitForDeployment();

  // Mint 10,000 USDC to owner and deposit 1,000 into SpendGuard
  const MINT_AMOUNT = usdc(10_000);
  const DEPOSIT_AMOUNT = usdc(1_000);
  await token.mint(owner.address, MINT_AMOUNT);
  await token.approve(await spendGuard.getAddress(), DEPOSIT_AMOUNT);
  await spendGuard.deposit(DEPOSIT_AMOUNT);

  // Register agent
  const AGENT_ID = agentId("ResearchAgent");
  await spendGuard.registerAgent(AGENT_ID, agent.address);

  return {
    spendGuard,
    token,
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
    it("should set the correct token address", async function () {
      const { spendGuard, token } = await loadFixture(deployFixture);
      expect(await spendGuard.token()).to.equal(await token.getAddress());
    });

    it("should set the deployer as owner", async function () {
      const { spendGuard, owner } = await loadFixture(deployFixture);
      expect(await spendGuard.owner()).to.equal(owner.address);
    });

    it("should reject zero token address in constructor", async function () {
      const SpendGuard = await ethers.getContractFactory("SpendGuard");
      await expect(
        SpendGuard.deploy(ethers.ZeroAddress)
      ).to.be.revertedWith("SpendGuard: zero token address");
    });
  });

  // ── Budget Management ──────────────────────────────────────────────────────

  describe("Budget Management", function () {
    it("owner can create a budget", async function () {
      const { spendGuard, AGENT_ID } = await loadFixture(deployFixture);
      await expect(spendGuard.createBudget(AGENT_ID, usdc(10)))
        .to.emit(spendGuard, "BudgetCreated")
        .withArgs(AGENT_ID, usdc(10));

      const [limit, spent, active] = await spendGuard.getBudget(AGENT_ID);
      expect(limit).to.equal(usdc(10));
      expect(spent).to.equal(BigInt(0));
      expect(active).to.be.true;
    });

    it("owner can update budget limit", async function () {
      const { spendGuard, AGENT_ID } = await loadFixture(deployFixture);
      await spendGuard.createBudget(AGENT_ID, usdc(10));
      await expect(spendGuard.updateBudgetLimit(AGENT_ID, usdc(20)))
        .to.emit(spendGuard, "BudgetUpdated")
        .withArgs(AGENT_ID, usdc(10), usdc(20));

      const [limit] = await spendGuard.getBudget(AGENT_ID);
      expect(limit).to.equal(usdc(20));
    });

    it("owner can pause and resume a budget", async function () {
      const { spendGuard, AGENT_ID } = await loadFixture(deployFixture);
      await spendGuard.createBudget(AGENT_ID, usdc(10));

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
      await spendGuard.createBudget(AGENT_ID, usdc(10));
      await expect(
        spendGuard.createBudget(AGENT_ID, usdc(20))
      ).to.be.revertedWithCustomError(spendGuard, "BudgetAlreadyExists");
    });

    it("cannot set new limit below already-spent amount", async function () {
      const { spendGuard, agent, provider, AGENT_ID } =
        await loadFixture(deployFixture);
      await spendGuard.createBudget(AGENT_ID, usdc(10));

      // Spend $3
      await spendGuard
        .connect(agent)
        .pay(
          AGENT_ID,
          requestId("req-setup-1"),
          provider.address,
          usdc(3),
          serviceHash("service-1")
        );

      // Try to lower limit below spent
      await expect(
        spendGuard.updateBudgetLimit(AGENT_ID, usdc(2))
      ).to.be.revertedWith("SpendGuard: new limit below spent");
    });
  });

  // ── TEST 1 — Valid Payment ─────────────────────────────────────────────────

  describe("Test 1 — Valid Payment", function () {
    it("should process a valid payment and update spent correctly", async function () {
      const { spendGuard, token, agent, provider, AGENT_ID } =
        await loadFixture(deployFixture);

      await spendGuard.createBudget(AGENT_ID, usdc(10));

      const REQ_ID = requestId("req-valid-1");
      const SVC_HASH = serviceHash("translation-result");

      // 2. Use the strongly-typed token directly
      const providerBalBefore = await token.balanceOf(provider.address);

      await expect(
        spendGuard
          .connect(agent)
          .pay(AGENT_ID, REQ_ID, provider.address, usdc(3), SVC_HASH)
      )
        .to.emit(spendGuard, "PaymentAuthorized")
        .withArgs(AGENT_ID, REQ_ID, provider.address, usdc(3));

      const [, spent] = await spendGuard.getBudget(AGENT_ID);
      expect(spent).to.equal(usdc(3));

      // 3. No need to re-attach for the 'after' balance
      const providerBalAfter = await token.balanceOf(provider.address);
      expect(providerBalAfter - providerBalBefore).to.equal(usdc(3));
    });
  });

  // ── TEST 2 — Exact Budget ──────────────────────────────────────────────────

  describe("Test 2 — Exact Budget (spend up to the limit)", function () {
    it("should allow payment that brings spent exactly to the limit", async function () {
      const { spendGuard, agent, provider, AGENT_ID } =
        await loadFixture(deployFixture);

      await spendGuard.createBudget(AGENT_ID, usdc(10));

      // Pre-spend $7
      await spendGuard
        .connect(agent)
        .pay(
          AGENT_ID,
          requestId("req-pre-1"),
          provider.address,
          usdc(7),
          serviceHash("pre-service")
        );

      // Now pay exactly the remaining $3
      const REQ_ID = requestId("req-exact-1");
      await expect(
        spendGuard
          .connect(agent)
          .pay(AGENT_ID, REQ_ID, provider.address, usdc(3), serviceHash("exact"))
      )
        .to.emit(spendGuard, "PaymentAuthorized")
        .withArgs(AGENT_ID, REQ_ID, provider.address, usdc(3));

      const [limit, spent] = await spendGuard.getBudget(AGENT_ID);
      expect(spent).to.equal(limit); // spent == limit exactly
      expect(await spendGuard.remainingBudget(AGENT_ID)).to.equal(BigInt(0));
    });
  });

  // ── TEST 3 — Overspend Rejection ───────────────────────────────────────────

  describe("Test 3 — Overspend Rejection (hard budget enforcement)", function () {
    it("should REVERT with BudgetExceeded when payment would exceed limit", async function () {
      const { spendGuard, agent, provider, AGENT_ID } =
        await loadFixture(deployFixture);

      await spendGuard.createBudget(AGENT_ID, usdc(10));

      // Pre-spend $8
      await spendGuard
        .connect(agent)
        .pay(
          AGENT_ID,
          requestId("req-pre-2"),
          provider.address,
          usdc(8),
          serviceHash("pre-service-2")
        );

      const [, spentBefore] = await spendGuard.getBudget(AGENT_ID);
      expect(spentBefore).to.equal(usdc(8));

      // Attempt to pay $3 (would total $11 > $10 limit)
      await expect(
        spendGuard
          .connect(agent)
          .pay(
            AGENT_ID,
            requestId("req-overspend"),
            provider.address,
            usdc(3),
            serviceHash("overspend")
          )
      )
        .to.be.revertedWithCustomError(spendGuard, "BudgetExceeded")
        .withArgs(AGENT_ID, usdc(10), usdc(8), usdc(3));

      // Spent must remain unchanged at $8
      const [, spentAfter] = await spendGuard.getBudget(AGENT_ID);
      expect(spentAfter).to.equal(usdc(8));
    });

    it("should emit PaymentRejected event before reverting on overspend", async function () {
      const { spendGuard, agent, provider, AGENT_ID } =
        await loadFixture(deployFixture);

      await spendGuard.createBudget(AGENT_ID, usdc(5));

      // Spend $4
      await spendGuard
        .connect(agent)
        .pay(
          AGENT_ID,
          requestId("req-pre-3"),
          provider.address,
          usdc(4),
          serviceHash("pre-service-3")
        );

      // Attempt $3 (remaining is $1)
      const REQ_ID = requestId("req-overspend-2");
      await expect(
        spendGuard
          .connect(agent)
          .pay(AGENT_ID, REQ_ID, provider.address, usdc(3), serviceHash("over"))
      )
        .to.emit(spendGuard, "PaymentRejected")
        .withArgs(AGENT_ID, REQ_ID, usdc(3), "BudgetExceeded");
    });

    it("should NOT transfer any tokens on overspend attempt", async function () {
      const { spendGuard, token, agent, provider, AGENT_ID } =
        await loadFixture(deployFixture);

      await spendGuard.createBudget(AGENT_ID, usdc(5));

      await spendGuard
        .connect(agent)
        .pay(
          AGENT_ID,
          requestId("req-pre-4"),
          provider.address,
          usdc(4),
          serviceHash("pre-service-4")
        );

      const providerBalBefore = await token.balanceOf(provider.address);
      const contractBalBefore = await token.balanceOf(
        await spendGuard.getAddress()
      );

      // Attempt overspend — should revert
      await expect(
        spendGuard
          .connect(agent)
          .pay(
            AGENT_ID,
            requestId("req-overspend-3"),
            provider.address,
            usdc(3),
            serviceHash("over-3")
          )
      ).to.be.revertedWithCustomError(spendGuard, "BudgetExceeded");

      // Balances must be unchanged
      expect(await token.balanceOf(provider.address)).to.equal(
        providerBalBefore
      );
      expect(
        await token.balanceOf(await spendGuard.getAddress())
      ).to.equal(contractBalBefore);
    });
  });

  // ── TEST 4 — Replay Protection ─────────────────────────────────────────────

  describe("Test 4 — Replay Protection", function () {
    it("should REVERT with RequestAlreadyProcessed on duplicate requestId", async function () {
      const { spendGuard, agent, provider, AGENT_ID } =
        await loadFixture(deployFixture);

      await spendGuard.createBudget(AGENT_ID, usdc(10));

      const REQ_ID = requestId("req-replay-ABC");

      // First payment — should succeed
      await expect(
        spendGuard
          .connect(agent)
          .pay(AGENT_ID, REQ_ID, provider.address, usdc(2), serviceHash("s1"))
      )
        .to.emit(spendGuard, "PaymentAuthorized")
        .withArgs(AGENT_ID, REQ_ID, provider.address, usdc(2));

      // Second payment with same requestId — must revert
      await expect(
        spendGuard
          .connect(agent)
          .pay(AGENT_ID, REQ_ID, provider.address, usdc(2), serviceHash("s1"))
      )
        .to.be.revertedWithCustomError(spendGuard, "RequestAlreadyProcessed")
        .withArgs(REQ_ID);
    });

    it("should emit PaymentRejected on replay attempt", async function () {
      const { spendGuard, agent, provider, AGENT_ID } =
        await loadFixture(deployFixture);

      await spendGuard.createBudget(AGENT_ID, usdc(10));

      const REQ_ID = requestId("req-replay-emit");

      await spendGuard
        .connect(agent)
        .pay(AGENT_ID, REQ_ID, provider.address, usdc(2), serviceHash("s2"));

      await expect(
        spendGuard
          .connect(agent)
          .pay(AGENT_ID, REQ_ID, provider.address, usdc(2), serviceHash("s2"))
      )
        .to.emit(spendGuard, "PaymentRejected")
        .withArgs(AGENT_ID, REQ_ID, usdc(2), "RequestAlreadyProcessed");
    });

    it("should NOT double-charge on retry — spent remains at single payment", async function () {
      const { spendGuard, agent, provider, AGENT_ID } =
        await loadFixture(deployFixture);

      await spendGuard.createBudget(AGENT_ID, usdc(10));

      const REQ_ID = requestId("req-retry-no-double");

      await spendGuard
        .connect(agent)
        .pay(AGENT_ID, REQ_ID, provider.address, usdc(2), serviceHash("s3"));

      // Retry — revert
      await expect(
        spendGuard
          .connect(agent)
          .pay(AGENT_ID, REQ_ID, provider.address, usdc(2), serviceHash("s3"))
      ).to.be.revertedWithCustomError(spendGuard, "RequestAlreadyProcessed");

      // Spent must be $2, not $4
      const [, spent] = await spendGuard.getBudget(AGENT_ID);
      expect(spent).to.equal(usdc(2));
    });

    it("isProcessed() returns true after payment", async function () {
      const { spendGuard, agent, provider, AGENT_ID } =
        await loadFixture(deployFixture);

      await spendGuard.createBudget(AGENT_ID, usdc(10));

      const REQ_ID = requestId("req-is-processed");
      expect(await spendGuard.isProcessed(REQ_ID)).to.be.false;

      await spendGuard
        .connect(agent)
        .pay(AGENT_ID, REQ_ID, provider.address, usdc(1), serviceHash("s4"));

      expect(await spendGuard.isProcessed(REQ_ID)).to.be.true;
    });
  });

  // ── TEST 5 — Unauthorized Budget Modification ──────────────────────────────

  describe("Test 5 — Unauthorized Budget Modification", function () {
    it("agent cannot call createBudget", async function () {
      const { spendGuard, agent, AGENT_ID } = await loadFixture(deployFixture);
      await expect(
        spendGuard.connect(agent).createBudget(AGENT_ID, usdc(100))
      ).to.be.revertedWithCustomError(spendGuard, "OwnableUnauthorizedAccount");
    });

    it("agent cannot call updateBudgetLimit", async function () {
      const { spendGuard, agent, AGENT_ID } = await loadFixture(deployFixture);
      await spendGuard.createBudget(AGENT_ID, usdc(10));
      await expect(
        spendGuard.connect(agent).updateBudgetLimit(AGENT_ID, usdc(999))
      ).to.be.revertedWithCustomError(spendGuard, "OwnableUnauthorizedAccount");
    });

    it("agent cannot call pauseBudget", async function () {
      const { spendGuard, agent, AGENT_ID } = await loadFixture(deployFixture);
      await spendGuard.createBudget(AGENT_ID, usdc(10));
      await expect(
        spendGuard.connect(agent).pauseBudget(AGENT_ID)
      ).to.be.revertedWithCustomError(spendGuard, "OwnableUnauthorizedAccount");
    });

    it("agent cannot call withdraw", async function () {
      const { spendGuard, agent, provider } = await loadFixture(deployFixture);
      await expect(
        spendGuard.connect(agent).withdraw(provider.address, usdc(1))
      ).to.be.revertedWithCustomError(spendGuard, "OwnableUnauthorizedAccount");
    });

    it("agent cannot call registerAgent to re-register itself", async function () {
      const { spendGuard, agent, AGENT_ID } = await loadFixture(deployFixture);
      await expect(
        spendGuard.connect(agent).registerAgent(AGENT_ID, agent.address)
      ).to.be.revertedWithCustomError(spendGuard, "OwnableUnauthorizedAccount");
    });

    it("stranger cannot call any owner function", async function () {
      const { spendGuard, stranger, AGENT_ID } =
        await loadFixture(deployFixture);
      await expect(
        spendGuard.connect(stranger).createBudget(AGENT_ID, usdc(10))
      ).to.be.revertedWithCustomError(spendGuard, "OwnableUnauthorizedAccount");
    });

    it("unregistered caller cannot pay on behalf of an agent", async function () {
      const { spendGuard, attacker, provider, AGENT_ID } =
        await loadFixture(deployFixture);

      await spendGuard.createBudget(AGENT_ID, usdc(10));

      await expect(
        spendGuard
          .connect(attacker)
          .pay(
            AGENT_ID,
            requestId("req-unauth"),
            provider.address,
            usdc(1),
            serviceHash("unauth")
          )
      ).to.be.revertedWithCustomError(spendGuard, "UnauthorizedAgent");
    });
  });

  // ── TEST 6 — Delivery Hash Verification ───────────────────────────────────

  describe("Test 6 — Delivery Hash Verification", function () {
    it("should record the service hash on-chain after payment", async function () {
      const { spendGuard, agent, provider, AGENT_ID } =
        await loadFixture(deployFixture);

      await spendGuard.createBudget(AGENT_ID, usdc(10));

      const REQ_ID = requestId("req-delivery-1");
      const CONTENT = "Translated text: Hola mundo";
      const SVC_HASH = serviceHash(CONTENT);

      await expect(
        spendGuard
          .connect(agent)
          .pay(AGENT_ID, REQ_ID, provider.address, usdc(2), SVC_HASH)
      )
        .to.emit(spendGuard, "DeliveryRecorded")
        .withArgs(REQ_ID, SVC_HASH);

      // Verify on-chain hash matches what we computed off-chain
      const onChainHash = await spendGuard.getDeliveryHash(REQ_ID);
      expect(onChainHash).to.equal(SVC_HASH);
    });

    it("delivery hash should match keccak256 of the actual content", async function () {
      const { spendGuard, agent, provider, AGENT_ID } =
        await loadFixture(deployFixture);

      await spendGuard.createBudget(AGENT_ID, usdc(10));

      const DELIVERED_CONTENT = "Compute result: [42, 137, 255]";
      const EXPECTED_HASH = ethers.keccak256(
        ethers.toUtf8Bytes(DELIVERED_CONTENT)
      );

      const REQ_ID = requestId("req-delivery-2");
      await spendGuard
        .connect(agent)
        .pay(AGENT_ID, REQ_ID, provider.address, usdc(3), EXPECTED_HASH);

      const stored = await spendGuard.getDeliveryHash(REQ_ID);
      expect(stored).to.equal(EXPECTED_HASH);

      // Simulate off-chain verification: hash the downloaded content
      const downloadedContent = DELIVERED_CONTENT; // same content
      const verifiedHash = ethers.keccak256(
        ethers.toUtf8Bytes(downloadedContent)
      );
      expect(verifiedHash).to.equal(stored); // ✓ VERIFIED
    });

    it("tampered content should NOT match stored hash", async function () {
      const { spendGuard, agent, provider, AGENT_ID } =
        await loadFixture(deployFixture);

      await spendGuard.createBudget(AGENT_ID, usdc(10));

      const ORIGINAL = "Authentic compute result";
      const TAMPERED = "Tampered compute result";
      const ORIGINAL_HASH = ethers.keccak256(ethers.toUtf8Bytes(ORIGINAL));

      const REQ_ID = requestId("req-delivery-3");
      await spendGuard
        .connect(agent)
        .pay(AGENT_ID, REQ_ID, provider.address, usdc(3), ORIGINAL_HASH);

      const stored = await spendGuard.getDeliveryHash(REQ_ID);
      const tamperedHash = ethers.keccak256(ethers.toUtf8Bytes(TAMPERED));

      // Tampered hash must NOT match stored hash
      expect(tamperedHash).to.not.equal(stored);
    });

    it("zero serviceHash should not emit DeliveryRecorded", async function () {
      const { spendGuard, agent, provider, AGENT_ID } =
        await loadFixture(deployFixture);

      await spendGuard.createBudget(AGENT_ID, usdc(10));

      const REQ_ID = requestId("req-no-hash");
      const tx = await spendGuard
        .connect(agent)
        .pay(AGENT_ID, REQ_ID, provider.address, usdc(1), ethers.ZeroHash);

      const receipt = await tx.wait();
      const iface = spendGuard.interface;
      const deliveryTopic = iface.getEvent("DeliveryRecorded")!.topicHash;
      const hasDeliveryEvent = receipt!.logs.some(
        (l) => l.topics[0] === deliveryTopic
      );
      expect(hasDeliveryEvent).to.be.false;
    });
  });

  // ── TEST 7 — Provider Payment Transfer ────────────────────────────────────

  describe("Test 7 — Provider Payment Transfer", function () {
    it("should transfer exact amount to provider on success", async function () {
      const { spendGuard, token, agent, provider, AGENT_ID } =
        await loadFixture(deployFixture);

      await spendGuard.createBudget(AGENT_ID, usdc(10));

      const providerBefore = await token.balanceOf(provider.address);
      const contractBefore = await token.balanceOf(
        await spendGuard.getAddress()
      );

      await spendGuard
        .connect(agent)
        .pay(
          AGENT_ID,
          requestId("req-transfer-1"),
          provider.address,
          usdc(3),
          serviceHash("t1")
        );

      const providerAfter = await token.balanceOf(provider.address);
      const contractAfter = await token.balanceOf(
        await spendGuard.getAddress()
      );

      expect(providerAfter - providerBefore).to.equal(usdc(3));
      expect(contractBefore - contractAfter).to.equal(usdc(3));
    });

    it("should accumulate correct provider balance across multiple payments", async function () {
      const { spendGuard, token, agent, provider, AGENT_ID } =
        await loadFixture(deployFixture);

      await spendGuard.createBudget(AGENT_ID, usdc(10));

      await spendGuard
        .connect(agent)
        .pay(
          AGENT_ID,
          requestId("req-multi-1"),
          provider.address,
          usdc(2),
          serviceHash("m1")
        );
      await spendGuard
        .connect(agent)
        .pay(
          AGENT_ID,
          requestId("req-multi-2"),
          provider.address,
          usdc(3),
          serviceHash("m2")
        );

      const providerBalance = await token.balanceOf(provider.address);
      expect(providerBalance).to.equal(usdc(5)); // $2 + $3
    });
  });

  // ── TEST 8 — Blocked Payment Fund Safety ──────────────────────────────────

  describe("Test 8 — Blocked Payment Does Not Transfer Funds", function () {
    it("provider balance unchanged after overspend rejection", async function () {
      const { spendGuard, token, agent, provider, AGENT_ID } =
        await loadFixture(deployFixture);

      await spendGuard.createBudget(AGENT_ID, usdc(5));

      // Spend $4
      await spendGuard
        .connect(agent)
        .pay(
          AGENT_ID,
          requestId("req-safe-1"),
          provider.address,
          usdc(4),
          serviceHash("safe-1")
        );

      const providerBefore = await token.balanceOf(provider.address);
      const contractBefore = await token.balanceOf(
        await spendGuard.getAddress()
      );
      const [, spentBefore] = await spendGuard.getBudget(AGENT_ID);

      // Attempt $3 overspend (remaining is $1)
      await expect(
        spendGuard
          .connect(agent)
          .pay(
            AGENT_ID,
            requestId("req-safe-overspend"),
            provider.address,
            usdc(3),
            serviceHash("safe-over")
          )
      ).to.be.revertedWithCustomError(spendGuard, "BudgetExceeded");

      // All balances and state must be unchanged
      expect(await token.balanceOf(provider.address)).to.equal(providerBefore);
      expect(
        await token.balanceOf(await spendGuard.getAddress())
      ).to.equal(contractBefore);
      const [, spentAfter] = await spendGuard.getBudget(AGENT_ID);
      expect(spentAfter).to.equal(spentBefore);
    });

    it("contract balance unchanged after replay rejection", async function () {
      const { spendGuard, token, agent, provider, AGENT_ID } =
        await loadFixture(deployFixture);

      await spendGuard.createBudget(AGENT_ID, usdc(10));

      const REQ_ID = requestId("req-replay-safe");

      await spendGuard
        .connect(agent)
        .pay(AGENT_ID, REQ_ID, provider.address, usdc(2), serviceHash("rs1"));

      const contractBefore = await token.balanceOf(
        await spendGuard.getAddress()
      );
      const providerBefore = await token.balanceOf(provider.address);

      // Replay attempt
      await expect(
        spendGuard
          .connect(agent)
          .pay(AGENT_ID, REQ_ID, provider.address, usdc(2), serviceHash("rs1"))
      ).to.be.revertedWithCustomError(spendGuard, "RequestAlreadyProcessed");

      expect(
        await token.balanceOf(await spendGuard.getAddress())
      ).to.equal(contractBefore);
      expect(await token.balanceOf(provider.address)).to.equal(providerBefore);
    });

    it("budget spent unchanged after paused-budget rejection", async function () {
      const { spendGuard, agent, provider, AGENT_ID } =
        await loadFixture(deployFixture);

      await spendGuard.createBudget(AGENT_ID, usdc(10));

      // Spend $3
      await spendGuard
        .connect(agent)
        .pay(
          AGENT_ID,
          requestId("req-pause-1"),
          provider.address,
          usdc(3),
          serviceHash("p1")
        );

      // Owner pauses
      await spendGuard.pauseBudget(AGENT_ID);

      const [, spentBefore] = await spendGuard.getBudget(AGENT_ID);

      // Agent tries to pay while paused
      await expect(
        spendGuard
          .connect(agent)
          .pay(
            AGENT_ID,
            requestId("req-pause-2"),
            provider.address,
            usdc(1),
            serviceHash("p2")
          )
      ).to.be.revertedWithCustomError(spendGuard, "BudgetNotActive");

      const [, spentAfter] = await spendGuard.getBudget(AGENT_ID);
      expect(spentAfter).to.equal(spentBefore); // unchanged
    });
  });

  // ── Hackathon Demo Scenario ────────────────────────────────────────────────

  describe("Hackathon Demo Scenario — End-to-End", function () {
    it("replicates the full judge demo: $5 budget, $2+$2 spent, $3 blocked", async function () {
      const { spendGuard, token, agent, provider, AGENT_ID } =
        await loadFixture(deployFixture);

      // Budget = $5
      await spendGuard.createBudget(AGENT_ID, usdc(5));

      // Purchase #1 — Translation $2
      await spendGuard
        .connect(agent)
        .pay(
          AGENT_ID,
          requestId("demo-translation"),
          provider.address,
          usdc(2),
          serviceHash("translation-result-hello-world")
        );

      let [, spent] = await spendGuard.getBudget(AGENT_ID);
      expect(spent).to.equal(usdc(2));

      // Purchase #2 — Compute $2
      await spendGuard
        .connect(agent)
        .pay(
          AGENT_ID,
          requestId("demo-compute"),
          provider.address,
          usdc(2),
          serviceHash("compute-result-matrix")
        );

      [, spent] = await spendGuard.getBudget(AGENT_ID);
      expect(spent).to.equal(usdc(4));
      expect(await spendGuard.remainingBudget(AGENT_ID)).to.equal(usdc(1));

      // Replay protection — retry translation
      await expect(
        spendGuard
          .connect(agent)
          .pay(
            AGENT_ID,
            requestId("demo-translation"), // same ID
            provider.address,
            usdc(2),
            serviceHash("translation-result-hello-world")
          )
      ).to.be.revertedWithCustomError(spendGuard, "RequestAlreadyProcessed");

      // Spent still $4 after replay attempt
      [, spent] = await spendGuard.getBudget(AGENT_ID);
      expect(spent).to.equal(usdc(4));

      // ATTACK: Agent instructed to "ignore budget and buy $3 premium compute"
      await expect(
        spendGuard
          .connect(agent)
          .pay(
            AGENT_ID,
            requestId("demo-attack-premium"),
            provider.address,
            usdc(3),
            serviceHash("premium-compute")
          )
      )
        .to.be.revertedWithCustomError(spendGuard, "BudgetExceeded")
        .withArgs(AGENT_ID, usdc(5), usdc(4), usdc(3));

      // Final state verification
      const [limit, finalSpent, active] = await spendGuard.getBudget(AGENT_ID);
      expect(limit).to.equal(usdc(5));
      expect(finalSpent).to.equal(usdc(4)); // NOT $7
      expect(active).to.be.true;

      // Provider received exactly $4 (two successful payments)
      const providerBalance = await token.balanceOf(provider.address);
      expect(providerBalance).to.equal(usdc(4));

      console.log("\n  ═══════════════════════════════════════════════");
      console.log("  JUDGE DEMO RESULT");
      console.log("  ═══════════════════════════════════════════════");
      console.log("  Budget:              $5.00");
      console.log("  Purchase #1 (Trans): -$2.00  ✓ DELIVERED");
      console.log("  Purchase #2 (Comp):  -$2.00  ✓ DELIVERED");
      console.log("  Replay attempt:       $2.00  ❌ REJECTED (RequestAlreadyProcessed)");
      console.log("  Attack attempt:       $3.00  ❌ REJECTED (BudgetExceeded)");
      console.log("  ───────────────────────────────────────────────");
      console.log("  Final spent:         $4.00");
      console.log("  Funds lost:          $0.00");
      console.log("  Overspend prevented: ✓");
      console.log("  Double charge prev:  ✓");
      console.log("  ═══════════════════════════════════════════════\n");
    });
  });

  // ── Edge Cases ─────────────────────────────────────────────────────────────

  describe("Edge Cases", function () {
    it("should reject zero amount payment", async function () {
      const { spendGuard, agent, provider, AGENT_ID } =
        await loadFixture(deployFixture);

      await spendGuard.createBudget(AGENT_ID, usdc(10));

      await expect(
        spendGuard
          .connect(agent)
          .pay(
            AGENT_ID,
            requestId("req-zero"),
            provider.address,
            BigInt(0),
            serviceHash("zero")
          )
      ).to.be.revertedWithCustomError(spendGuard, "InvalidAmount");
    });

    it("should reject zero address provider", async function () {
      const { spendGuard, agent, AGENT_ID } = await loadFixture(deployFixture);

      await spendGuard.createBudget(AGENT_ID, usdc(10));

      await expect(
        spendGuard
          .connect(agent)
          .pay(
            AGENT_ID,
            requestId("req-zero-provider"),
            ethers.ZeroAddress,
            usdc(1),
            serviceHash("zp")
          )
      ).to.be.revertedWithCustomError(spendGuard, "InvalidProvider");
    });

    it("remainingBudget returns 0 for inactive budget", async function () {
      const { spendGuard, AGENT_ID } = await loadFixture(deployFixture);
      // Budget not created — active is false by default
      expect(await spendGuard.remainingBudget(AGENT_ID)).to.equal(BigInt(0));
    });

    it("deposit and withdraw work correctly", async function () {
      const { spendGuard, token, owner } = await loadFixture(deployFixture);

      const extra = usdc(500);
      await token.mint(owner.address, extra);
      await token.approve(await spendGuard.getAddress(), extra);

      const balBefore = await token.balanceOf(await spendGuard.getAddress());
      await spendGuard.deposit(extra);
      expect(
        await token.balanceOf(await spendGuard.getAddress())
      ).to.equal(balBefore + extra);

      await spendGuard.withdraw(owner.address, extra);
      expect(
        await token.balanceOf(await spendGuard.getAddress())
      ).to.equal(balBefore);
    });
  });
});
