// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Independent educational constant-product DEX, not an official Uniswap deployment.
/// Supports standard ERC20s only (no transfer fees/rebasing); reserves use raw token units.
contract LearningPair is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;
    address public immutable token0;
    address public immutable token1;
    uint112 public reserve0;
    uint112 public reserve1;
    event LiquidityAdded(address indexed provider, uint256 amount0, uint256 amount1, uint256 shares);
    event LiquidityRemoved(address indexed provider, uint256 amount0, uint256 amount1);
    event Swap(address indexed sender, address indexed tokenIn, uint256 amountIn, uint256 amountOut, address to);
    event Sync(uint112 reserve0, uint112 reserve1);

    constructor(address a, address b) ERC20("Learning DEX LP", "LDLP") {
        require(a != b && a != address(0) && b != address(0), "invalid tokens");
        token0 = a;
        token1 = b;
    }

    function _updateReserves() private {
        uint256 a = IERC20(token0).balanceOf(address(this));
        uint256 b = IERC20(token1).balanceOf(address(this));
        require(a <= type(uint112).max && b <= type(uint112).max, "reserve overflow");
        reserve0 = uint112(a);
        reserve1 = uint112(b);
        emit Sync(reserve0, reserve1);
    }

    function addLiquidity(uint256 amount0, uint256 amount1, uint256 minShares, uint256 deadline)
        external nonReentrant returns (uint256 shares)
    {
        require(block.timestamp <= deadline, "expired");
        require(amount0 > 0 && amount1 > 0, "zero liquidity");
        require(amount0 <= type(uint112).max && amount1 <= type(uint112).max, "amount too large");
        uint256 supply = totalSupply();
        if (supply == 0) {
            uint256 root = Math.sqrt(amount0 * amount1);
            require(root > 1000, "initial liquidity too small");
            _mint(address(0xdead), 1000); // Permanently lock minimum liquidity.
            shares = root - 1000;
        } else {
            shares = Math.min(Math.mulDiv(amount0, supply, reserve0), Math.mulDiv(amount1, supply, reserve1));
        }
        require(shares > 0 && shares >= minShares, "LP slippage");
        IERC20(token0).safeTransferFrom(msg.sender, address(this), amount0);
        IERC20(token1).safeTransferFrom(msg.sender, address(this), amount1);
        _mint(msg.sender, shares);
        _updateReserves();
        emit LiquidityAdded(msg.sender, amount0, amount1, shares);
    }

    function removeLiquidity(uint256 shares, uint256 min0, uint256 min1, uint256 deadline)
        external nonReentrant returns (uint256 a, uint256 b)
    {
        require(block.timestamp <= deadline, "expired");
        require(shares > 0, "zero shares");
        a = Math.mulDiv(shares, reserve0, totalSupply());
        b = Math.mulDiv(shares, reserve1, totalSupply());
        require(a > 0 && b > 0 && a >= min0 && b >= min1, "LP slippage");
        _burn(msg.sender, shares);
        IERC20(token0).safeTransfer(msg.sender, a);
        IERC20(token1).safeTransfer(msg.sender, b);
        _updateReserves();
        emit LiquidityRemoved(msg.sender, a, b);
    }

    function getAmountOut(address tokenIn, uint256 amountIn) public view returns (uint256) {
        require(tokenIn == token0 || tokenIn == token1, "unsupported token");
        require(amountIn > 0 && amountIn <= type(uint112).max, "invalid amount");
        (uint256 rIn, uint256 rOut) = tokenIn == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
        require(rIn > 0 && rOut > 0, "no liquidity");
        uint256 amountWithFee = amountIn * 997;
        return Math.mulDiv(amountWithFee, rOut, rIn * 1000 + amountWithFee);
    }

    function swap(address tokenIn, uint256 amountIn, uint256 minOut, address to, uint256 deadline)
        external nonReentrant returns (uint256 amountOut)
    {
        require(block.timestamp <= deadline, "expired");
        require(to != address(0) && to != address(this), "invalid recipient");
        amountOut = getAmountOut(tokenIn, amountIn);
        require(amountOut > 0 && amountOut >= minOut, "slippage");
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn == token0 ? token1 : token0).safeTransfer(to, amountOut);
        _updateReserves();
        emit Swap(msg.sender, tokenIn, amountIn, amountOut, to);
    }
}
