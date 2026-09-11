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
 *   - Any user can register their own agents and create/modify their own budgets.
 *   - Users deposit funds into isolated user balances; agents can only spend from their owner's balance.
 *   - The agent can only call pay(), which is gated by budget + balance + replay checks.
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

    /// @notice agentId => owner/manager of the agent budget
    mapping(bytes32 => address) public agentOwners;

    /// @notice userAddress => isolated MockUSDC balance deposited
    mapping(address => uint256) public userBalances;

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
    event FundsDeposited(address indexed user, uint256 amount);
    event FundsWithdrawn(address indexed user, uint256 amount);

    // ─── Errors ─────────────────────────────────────────────────────────────

    error BudgetExceeded(bytes32 agentId, uint256 limit, uint256 spent, uint256 attempted);
    error RequestAlreadyProcessed(bytes32 requestId);
    error BudgetNotActive(bytes32 agentId);
    error BudgetAlreadyExists(bytes32 agentId);
    error BudgetDoesNotExist(bytes32 agentId);
    error UnauthorizedAgent(address caller, bytes32 agentId);
    error NotAgentOwner(address caller, bytes32 agentId);
    error InvalidAmount();
    error InvalidProvider();
    error InsufficientUserBalance(address user, uint256 available, uint256 required);

    // ─── Constructor ────────────────────────────────────────────────────────

    constructor(address _token) Ownable(msg.sender) {
        require(_token != address(0), "SpendGuard: zero token address");
        token = IERC20(_token);
    }

    // ─── User-managed functions (Self-Serve) ─────────────────────────────────

    /**
     * @notice Register an agent address for a given agentId.
     */
    function registerAgent(bytes32 agentId, address agentAddress) external {
        address owner = agentOwners[agentId];
        if (owner != address(0) && owner != msg.sender) {
            revert NotAgentOwner(msg.sender, agentId);
        }
        if (owner == address(0)) {
            agentOwners[agentId] = msg.sender;
        }

        require(agentAddress != address(0), "SpendGuard: zero agent address");
        agentAddresses[agentId] = agentAddress;
        emit AgentRegistered(agentId, agentAddress);
    }

    /**
     * @notice Create a new budget for an agent.
     */
    function createBudget(bytes32 agentId, uint256 budgetLimit) external {
        address owner = agentOwners[agentId];
        if (owner != address(0) && owner != msg.sender) {
            revert NotAgentOwner(msg.sender, agentId);
        }
        if (owner == address(0)) {
            agentOwners[agentId] = msg.sender;
        }

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
     * @notice Update spending limit for an existing budget.
     */
    function updateBudgetLimit(bytes32 agentId, uint256 newLimit) external {
        if (agentOwners[agentId] != msg.sender) revert NotAgentOwner(msg.sender, agentId);
        
        Budget storage b = budgets[agentId];
        if (!b.active) revert BudgetDoesNotExist(agentId);
        require(newLimit >= b.spent, "SpendGuard: new limit below spent");

        uint256 old = b.limit;
        b.limit = newLimit;
        emit BudgetUpdated(agentId, old, newLimit);
    }

    /**
     * @notice Pause an agent's budget.
     */
    function pauseBudget(bytes32 agentId) external {
        if (agentOwners[agentId] != msg.sender) revert NotAgentOwner(msg.sender, agentId);
        
        Budget storage b = budgets[agentId];
        if (!b.active) revert BudgetDoesNotExist(agentId);
        b.active = false;
        emit BudgetPaused(agentId);
    }

    /**
     * @notice Resume a paused budget.
     */
    function resumeBudget(bytes32 agentId) external {
        if (agentOwners[agentId] != msg.sender) revert NotAgentOwner(msg.sender, agentId);
        
        Budget storage b = budgets[agentId];
        require(!b.active, "SpendGuard: budget already active");
        b.active = true;
        emit BudgetResumed(agentId);
    }

    /**
     * @notice Deposit tokens into your isolated user vault.
     */
    function deposit(uint256 amount) external {
        require(amount > 0, "SpendGuard: zero deposit");
        token.safeTransferFrom(msg.sender, address(this), amount);
        userBalances[msg.sender] += amount;
        emit FundsDeposited(msg.sender, amount);
    }

    /**
     * @notice Withdraw tokens from your isolated user vault.
     */
    function withdraw(uint256 amount) external {
        require(amount > 0, "SpendGuard: zero withdraw");
        uint256 bal = userBalances[msg.sender];
        if (bal < amount) revert InsufficientUserBalance(msg.sender, bal, amount);
        userBalances[msg.sender] -= amount;
        token.safeTransfer(msg.sender, amount);
        emit FundsWithdrawn(msg.sender, amount);
    }

    // ─── Agent-callable function ─────────────────────────────────────────────

    /**
     * @notice Authorize and execute a payment to a provider.
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

        // ── User isolation balance check ─────────────────────────────────────
        address owner = agentOwners[agentId];
        uint256 userBal = userBalances[owner];
        if (userBal < amount) {
            emit PaymentRejected(agentId, requestId, amount, "InsufficientUserBalance");
            revert InsufficientUserBalance(owner, userBal, amount);
        }

        // ── State updates (checks-effects-interactions) ──────────────────────
        processedRequests[requestId] = true;
        b.spent = newSpent;
        userBalances[owner] -= amount; // Deduct strictly from agent owner's balance

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

    function remainingBudget(bytes32 agentId) external view returns (uint256) {
        Budget storage b = budgets[agentId];
        if (!b.active) return 0;
        return b.limit - b.spent;
    }

    function getBudget(bytes32 agentId) external view returns (
        uint256 limit,
        uint256 spent,
        bool    active
    ) {
        Budget storage b = budgets[agentId];
        return (b.limit, b.spent, b.active);
    }

    function isProcessed(bytes32 requestId) external view returns (bool) {
        return processedRequests[requestId];
    }

    function getDeliveryHash(bytes32 requestId) external view returns (bytes32) {
        return deliveryHashes[requestId];
    }
}