// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title SpendGuard
 * @notice Enforces hard spending budgets for AI agents via EIP-712 signatures.
 */
contract SpendGuard is Ownable, ReentrancyGuard, EIP712 {
    struct Budget {
        uint256 limit;
        uint256 spent;
        bool active;
    }

    mapping(bytes32 => Budget) public budgets;
    mapping(bytes32 => address) public agentAddresses;
    mapping(bytes32 => address) public agentOwners;
    mapping(address => uint256) public userBalances;
    mapping(bytes32 => bool) public processedRequests;
    mapping(bytes32 => bytes32) public deliveryHashes;

    bytes32 public constant PAYMENT_TYPEHASH = keccak256("Payment(bytes32 agentId,bytes32 requestId,address provider,uint256 amount,bytes32 serviceHash)");

    event BudgetCreated(bytes32 indexed agentId, uint256 limit);
    event BudgetUpdated(bytes32 indexed agentId, uint256 oldLimit, uint256 newLimit);
    event AgentRegistered(bytes32 indexed agentId, address indexed agentAddress);
    event PaymentAuthorized(bytes32 indexed agentId, bytes32 indexed requestId, address indexed provider, uint256 amount);
    event PaymentRejected(bytes32 indexed agentId, bytes32 indexed requestId, uint256 amount, string reason);
    event DeliveryRecorded(bytes32 indexed requestId, bytes32 contentHash);
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

    constructor() Ownable(msg.sender) EIP712("SpendGuard", "1") {}

    // ─── User-managed functions ─────────────────────────────────────────────

    /**
     * @notice Batch function to register an agent, set its budget, and fund the vault in a single transaction.
     */
    function setupAgent(bytes32 agentId, address agentAddress, uint256 budgetLimit) external payable {
        address owner = agentOwners[agentId];
        require(owner == address(0) || owner == msg.sender, "NotAgentOwner");
        if (owner == address(0)) {
            agentOwners[agentId] = msg.sender;
        }
        
        require(agentAddress != address(0), "Zero agent address");
        agentAddresses[agentId] = agentAddress;
        emit AgentRegistered(agentId, agentAddress);

        require(!budgets[agentId].active, "BudgetAlreadyExists");
        require(budgetLimit > 0, "Zero limit");

        budgets[agentId] = Budget({ limit: budgetLimit, spent: 0, active: true });
        emit BudgetCreated(agentId, budgetLimit);

        if (msg.value > 0) {
            userBalances[msg.sender] += msg.value;
            emit FundsDeposited(msg.sender, msg.value);
        }
    }

    function registerAgent(bytes32 agentId, address agentAddress) external {
        address owner = agentOwners[agentId];
        require(owner == address(0) || owner == msg.sender, "NotAgentOwner");
        if (owner == address(0)) agentOwners[agentId] = msg.sender;
        
        require(agentAddress != address(0), "Zero agent address");
        agentAddresses[agentId] = agentAddress;
        emit AgentRegistered(agentId, agentAddress);
    }

    function createBudget(bytes32 agentId, uint256 budgetLimit) external {
        address owner = agentOwners[agentId];
        require(owner == address(0) || owner == msg.sender, "NotAgentOwner");
        if (owner == address(0)) agentOwners[agentId] = msg.sender;
        require(!budgets[agentId].active, "BudgetAlreadyExists");
        require(budgetLimit > 0, "Zero limit");

        budgets[agentId] = Budget({ limit: budgetLimit, spent: 0, active: true });
        emit BudgetCreated(agentId, budgetLimit);
    }

    function updateBudgetLimit(bytes32 agentId, uint256 newLimit) external {
        if (agentOwners[agentId] != msg.sender) revert NotAgentOwner(msg.sender, agentId);
        
        Budget storage b = budgets[agentId];
        if (!b.active) revert BudgetDoesNotExist(agentId);
        require(newLimit >= b.spent, "SpendGuard: new limit below spent");

        uint256 old = b.limit;
        b.limit = newLimit;
        emit BudgetUpdated(agentId, old, newLimit);
    }

    function pauseBudget(bytes32 agentId) external {
        if (agentOwners[agentId] != msg.sender) revert NotAgentOwner(msg.sender, agentId);
        
        Budget storage b = budgets[agentId];
        if (!b.active) revert BudgetDoesNotExist(agentId);
        b.active = false;
        emit BudgetPaused(agentId);
    }

    function resumeBudget(bytes32 agentId) external {
        if (agentOwners[agentId] != msg.sender) revert NotAgentOwner(msg.sender, agentId);
        
        Budget storage b = budgets[agentId];
        require(!b.active, "SpendGuard: budget already active");
        b.active = true;
        emit BudgetResumed(agentId);
    }

    function deposit() external payable {
        require(msg.value > 0, "Zero deposit");
        userBalances[msg.sender] += msg.value;
        emit FundsDeposited(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external {
        require(userBalances[msg.sender] >= amount, "Insufficient balance");
        userBalances[msg.sender] -= amount;
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        emit FundsWithdrawn(msg.sender, amount);
    }

    // ─── Provider Claim (EIP-712) ──────────────────────────────────────────

    function claimPayment(
        bytes32 agentId,
        bytes32 requestId,
        address provider,
        uint256 amount,
        bytes32 serviceHash,
        bytes calldata signature
    ) external nonReentrant {
        require(amount > 0 && provider != address(0), "Invalid input");
        require(!processedRequests[requestId], "RequestAlreadyProcessed");

        bytes32 structHash = keccak256(abi.encode(PAYMENT_TYPEHASH, agentId, requestId, provider, amount, serviceHash));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        require(signer == agentAddresses[agentId], "Invalid signature or unauthorized agent");

        Budget storage b = budgets[agentId];
        require(b.active, "BudgetNotActive");
        
        uint256 newSpent = b.spent + amount;
        require(newSpent <= b.limit, "BudgetExceeded");

        address owner = agentOwners[agentId];
        require(userBalances[owner] >= amount, "InsufficientUserBalance");

        processedRequests[requestId] = true;
        b.spent = newSpent;
        userBalances[owner] -= amount;
        if (serviceHash != bytes32(0)) {
            deliveryHashes[requestId] = serviceHash;
            emit DeliveryRecorded(requestId, serviceHash);
        }

        (bool success, ) = provider.call{value: amount}("");
        require(success, "Transfer failed");

        emit PaymentAuthorized(agentId, requestId, provider, amount);
    }

    // ─── View Helpers ──────────────────────────────────────────────────────

    function getBudget(bytes32 agentId) external view returns (uint256 limit, uint256 spent, bool active) {
        Budget storage b = budgets[agentId];
        return (b.limit, b.spent, b.active);
    }

    function remainingBudget(bytes32 agentId) external view returns (uint256) {
        Budget storage b = budgets[agentId];
        if (!b.active) return 0;
        return b.limit - b.spent;
    }

    function isProcessed(bytes32 requestId) external view returns (bool) {
        return processedRequests[requestId];
    }

    function getDeliveryHash(bytes32 requestId) external view returns (bytes32) {
        return deliveryHashes[requestId];
    }
}