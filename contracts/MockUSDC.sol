// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDC
 * @notice A simple ERC-20 test token that mimics USDC (6 decimals).
 *         Used exclusively in tests and local demos — NOT real money.
 */
contract MockUSDC is ERC20, Ownable {
    uint8 private constant _DECIMALS = 6;

    constructor() ERC20("Mock USD Coin", "USDC") Ownable(msg.sender) {}

    /**
     * @notice Mint tokens to any address (owner only in production,
     *         but open in tests via the faucet helper).
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @notice Public faucet — anyone can mint up to 10,000 USDC for testing.
     */
    function faucet(uint256 amount) external {
        require(amount <= 10_000 * 10 ** _DECIMALS, "MockUSDC: faucet limit 10000");
        _mint(msg.sender, amount);
    }

    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }
}
