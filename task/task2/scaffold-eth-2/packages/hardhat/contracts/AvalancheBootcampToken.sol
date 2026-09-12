// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Burnable } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AvalancheBootcampToken
 * @notice ERC-20 for Avalanche 101 Bootcamp Task 2, deployed with Scaffold-ETH 2.
 */
contract AvalancheBootcampToken is ERC20, ERC20Burnable, Ownable {
    uint256 public constant INITIAL_SUPPLY = 1_000_000 ether;

    constructor(address initialOwner) ERC20("Avalanche Bootcamp Token", "ABT") Ownable(initialOwner) {
        _mint(initialOwner, INITIAL_SUPPLY);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
