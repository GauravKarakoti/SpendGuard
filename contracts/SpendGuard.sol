// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title SpendGuard
 * @notice Enforces hard spending budgets for AI agents.
 *         The agent is NOT trusted — the contract is the final authority.
 *
 * Security model:
 *   - Only the owner can create/modify budgets and register agents.
 *   - The agent can only call pay(), which is gated by budget + replay checks.
 *   - Even a fully compromised agent cannot exceed its budget.
 */
contract SpendGuard is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Structs ────────────────────────────────────────────────────────────

    struct Budget {
        uint256 limit;   // Maximum total spend (in token base units)
        uint256 spent;   // Cumulative amount spent so far
        bool    active;  // Whether this budget is currently active
    }

    // ─── State ──────────────────────────────────────────────────────────────

    /// @notice The ERC-20 token used for payments (test USDC)
    IERC20 public immutable token;

    /// @notice agentId => Budget
    mapping(bytes32 => Budget) public budgets;

    /// @notice agentId => authorized agent address
    mapping(bytes32 => address) public agentAddresses;

    /// @notice requestId => processed flag (replay protection)
    mapping(bytes32 => bool) public processedRequests;

    /// @notice requestId => delivery content hash
    mapping(bytes32 => bytes32) public deliveryHashes;

    // ─── Events ─────────────────────────────────────────────────────────────

    event BudgetCreated(
        bytes32 indexed agentId,
        uint256 limit
    );

    event BudgetUpdated(
        bytes32 indexed agentId,
        uint256 oldLimit,
        uint256 newLimit
    );

    event AgentRegistered(
        bytes32 indexed agentId,
        address indexed agentAddress
    );

    event PaymentAuthorized(
        bytes32 indexed agentId,
        bytes32 indexed requestId,
        address indexed provider,
        uint256 amount
    );

    event PaymentRejected(
        bytes32 indexed agentId,
        bytes32 indexed requestId,
        uint256 amount,
        string  reason
    );

    event DeliveryRecorded(
        bytes32 indexed requestId,
        bytes32 contentHash
    );

    event BudgetPaused(bytes32 indexed agentId);
    event BudgetResumed(bytes32 indexed agentId);
    event FundsDeposited(address indexed depositor, uint256 amount);
    event FundsWithdrawn(address indexed recipient, uint256 amount);

    // ─── Errors ─────────────────────────────────────────────────────────────

    error BudgetExceeded(bytes32 agentId, uint256 limit, uint256 spent, uint256 attempted);
    error RequestAlreadyProcessed(bytes32 requestId);
    error BudgetNotActive(bytes32 agentId);
    error BudgetAlreadyExists(bytes32 agentId);
    error BudgetDoesNotExist(bytes32 agentId);
    error UnauthorizedAgent(address caller, bytes32 agentId);
    error InvalidAmount();
    error InvalidProvider();
    error InsufficientContractBalance(uint256 available, uint256 required);

    // ─── Constructor ────────────────────────────────────────────────────────

    constructor(address _token) Ownable(msg.sender) {
        require(_token != address(0), "SpendGuard: zero token address");
        token = IERC20(_token);
    }

    // ─── Owner-only functions ────────────────────────────────────────────────

    /**
     * @notice Register an agent address for a given agentId.
     *         Only the registered address may call pay() for this agentId.
     */
    function registerAgent(bytes32 agentId, address agentAddress) external onlyOwner {
        require(agentAddress != address(0), "SpendGuard: zero agent address");
        agentAddresses[agentId] = agentAddress;
        emit AgentRegistered(agentId, agentAddress);
    }

    /**
     * @notice Create a new budget for an agent.
     * @param agentId     Unique identifier for the agent.
     * @param budgetLimit Maximum total spend in token base units.
     */
    function createBudget(bytes32 agentId, uint256 budgetLimit) external onlyOwner {
        if (budgets[agentId].active) revert BudgetAlreadyExists(agentId);
        require(budgetLimit > 0, "SpendGuard: zero budget limit");

        budgets[agentId] = Budget({
            limit:  budgetLimit,
            spent:  0,
            active: true
        });

        emit BudgetCreated(agentId, budgetLimit);
    }

    /**
     * @notice Update the spending limit for an existing budget.
     *         The new limit must be >= already spent amount.
     */
    function updateBudgetLimit(bytes32 agentId, uint256 newLimit) external onlyOwner {
        Budget storage b = budgets[agentId];
        if (!b.active) revert BudgetDoesNotExist(agentId);
        require(newLimit >= b.spent, "SpendGuard: new limit below spent");

        uint256 old = b.limit;
        b.limit = newLimit;
        emit BudgetUpdated(agentId, old, newLimit);
    }

    /**
     * @notice Pause an agent's budget (blocks all future payments).
     */
    function pauseBudget(bytes32 agentId) external onlyOwner {
        Budget storage b = budgets[agentId];
        if (!b.active) revert BudgetDoesNotExist(agentId);
        b.active = false;
        emit BudgetPaused(agentId);
    }

    /**
     * @notice Resume a paused budget.
     */
    function resumeBudget(bytes32 agentId) external onlyOwner {
        Budget storage b = budgets[agentId];
        require(!b.active, "SpendGuard: budget already active");
        b.active = true;
        emit BudgetResumed(agentId);
    }

    /**
     * @notice Deposit tokens into the contract so it can fund provider payments.
     */
    function deposit(uint256 amount) external {
        require(amount > 0, "SpendGuard: zero deposit");
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit FundsDeposited(msg.sender, amount);
    }

    /**
     * @notice Withdraw tokens from the contract (owner only).
     */
    function withdraw(address recipient, uint256 amount) external onlyOwner {
        require(recipient != address(0), "SpendGuard: zero recipient");
        uint256 bal = token.balanceOf(address(this));
        if (bal < amount) revert InsufficientContractBalance(bal, amount);
        token.safeTransfer(recipient, amount);
        emit FundsWithdrawn(recipient, amount);
    }

    // ─── Agent-callable function ─────────────────────────────────────────────

    /**
     * @notice Authorize and execute a payment to a provider.
     *
     * Hard invariants enforced here (NOT in the agent):
     *   1. spent + amount <= limit          (BudgetExceeded)
     *   2. requestId not previously used    (RequestAlreadyProcessed)
     *   3. budget must be active            (BudgetNotActive)
     *   4. caller must be registered agent  (UnauthorizedAgent)
     *
     * @param agentId     The agent making the payment.
     * @param requestId   Unique per-request ID (replay protection key).
     * @param provider    Address of the service provider to pay.
     * @param amount      Token amount to transfer to provider.
     * @param serviceHash keccak256 of the service description / delivery proof.
     */
    function pay(
        bytes32 agentId,
        bytes32 requestId,
        address provider,
        uint256 amount,
        bytes32 serviceHash
    ) external nonReentrant {
        // ── Authorization check ──────────────────────────────────────────────
        address registeredAgent = agentAddresses[agentId];
        if (registeredAgent != address(0) && msg.sender != registeredAgent) {
            revert UnauthorizedAgent(msg.sender, agentId);
        }

        // ── Input validation ─────────────────────────────────────────────────
        if (amount == 0) revert InvalidAmount();
        if (provider == address(0)) revert InvalidProvider();

        // ── Budget active check ──────────────────────────────────────────────
        Budget storage b = budgets[agentId];
        if (!b.active) {
            emit PaymentRejected(agentId, requestId, amount, "BudgetNotActive");
            revert BudgetNotActive(agentId);
        }

        // ── Replay protection ────────────────────────────────────────────────
        if (processedRequests[requestId]) {
            emit PaymentRejected(agentId, requestId, amount, "RequestAlreadyProcessed");
            revert RequestAlreadyProcessed(requestId);
        }

        // ── Hard budget enforcement ──────────────────────────────────────────
        uint256 newSpent = b.spent + amount;
        if (newSpent > b.limit) {
            emit PaymentRejected(agentId, requestId, amount, "BudgetExceeded");
            revert BudgetExceeded(agentId, b.limit, b.spent, amount);
        }

        // ── Contract balance check ───────────────────────────────────────────
        uint256 contractBalance = token.balanceOf(address(this));
        if (contractBalance < amount) {
            revert InsufficientContractBalance(contractBalance, amount);
        }

        // ── State updates (checks-effects-interactions) ──────────────────────
        processedRequests[requestId] = true;
        b.spent = newSpent;

        // Record service hash as delivery anchor
        if (serviceHash != bytes32(0)) {
            deliveryHashes[requestId] = serviceHash;
            emit DeliveryRecorded(requestId, serviceHash);
        }

        // ── Transfer to provider ─────────────────────────────────────────────
        token.safeTransfer(provider, amount);

        emit PaymentAuthorized(agentId, requestId, provider, amount);
    }

    // ─── View helpers ────────────────────────────────────────────────────────

    /**
     * @notice Returns remaining budget for an agent.
     */
    function remainingBudget(bytes32 agentId) external view returns (uint256) {
        Budget storage b = budgets[agentId];
        if (!b.active) return 0;
        return b.limit - b.spent;
    }

    /**
     * @notice Returns full budget info for an agent.
     */
    function getBudget(bytes32 agentId) external view returns (
        uint256 limit,
        uint256 spent,
        bool    active
    ) {
        Budget storage b = budgets[agentId];
        return (b.limit, b.spent, b.active);
    }

    /**
     * @notice Check whether a requestId has already been processed.
     */
    function isProcessed(bytes32 requestId) external view returns (bool) {
        return processedRequests[requestId];
    }

    /**
     * @notice Retrieve the delivery hash recorded for a requestId.
     */
    function getDeliveryHash(bytes32 requestId) external view returns (bytes32) {
        return deliveryHashes[requestId];
    }
}
