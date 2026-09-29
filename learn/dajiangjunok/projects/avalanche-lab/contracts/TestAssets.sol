// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Mock asset; this is NOT Circle USDC.
contract MockUSDC is ERC20, Ownable {
    constructor(address admin) ERC20("Bootcamp Mock USD", "mUSD") Ownable(admin) {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external onlyOwner { _mint(to, amount); }
}

/// @notice Whole units simplify the Task7 price/quantity model: one BASE costs price raw mUSD units.
contract BaseAsset is ERC20, Ownable {
    constructor(address admin) ERC20("Mini DEX Base", "BASE") Ownable(admin) {}
    function decimals() public pure override returns (uint8) { return 0; }
    function mint(address to, uint256 amount) external onlyOwner { _mint(to, amount); }
}
