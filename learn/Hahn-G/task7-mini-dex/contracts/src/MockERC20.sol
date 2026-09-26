// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockERC20 —— 课程用测试代币
/// @notice 和普通 ERC20 唯一的区别：小数位可配置 + 任何人都能 mint（水龙头）。
///         课上用它造 USDC(6 位) 和 WAVAX(18 位)，提醒学生：真实 USDC 也是 6 位小数，别按 18 位算。
contract MockERC20 is ERC20 {
    uint8 private immutable _decimals;

    /// @param name_     代币全名，例如 "USD Coin"
    /// @param symbol_   代币符号，例如 "USDC"
    /// @param decimals_ 小数位数，例如 6 或 18
    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _decimals = decimals_;
    }

    /// @notice 覆盖 OpenZeppelin 默认的 18 位小数
    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    /// @notice 水龙头：任何人都可以给任何地址 mint 任意数量（仅测试用，主网绝对不能这样写）
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
