// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IDexPair {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getAmountOut(address tokenIn, uint256 amountIn) external view returns (uint256);
    function swap(address tokenIn, uint256 amountIn, uint256 minOut, address to, uint256 deadline)
        external returns (uint256);
}

/// @notice Task2 ERC20, extended in Task3 with an actual DEX-backed purchase.
contract BootcampToken is ERC20, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    IDexPair public dexPair;
    IERC20 public quoteToken;
    event PairConfigured(address indexed pair, address indexed quote);
    event Purchased(address indexed buyer, uint256 quotePaid, uint256 tokensReceived);

    constructor(address admin) ERC20("Dajiangjun Bootcamp Token", "DJJ") Ownable(admin) {
        _mint(admin, 1_000_000 ether);
    }

    function setDexPair(address pair) external onlyOwner {
        require(address(dexPair) == address(0), "pair already set");
        address a = IDexPair(pair).token0();
        address b = IDexPair(pair).token1();
        require(a == address(this) || b == address(this), "wrong pair");
        dexPair = IDexPair(pair);
        quoteToken = IERC20(a == address(this) ? b : a);
        emit PairConfigured(pair, address(quoteToken));
    }

    function quotePurchase(uint256 quoteAmount) public view returns (uint256) {
        require(address(dexPair) != address(0), "pair not set");
        return dexPair.getAmountOut(address(quoteToken), quoteAmount);
    }

    function buyWithQuote(uint256 quoteAmount, uint256 minTokens, uint256 deadline)
        external nonReentrant returns (uint256 received)
    {
        require(address(dexPair) != address(0), "pair not set");
        quoteToken.safeTransferFrom(msg.sender, address(this), quoteAmount);
        quoteToken.forceApprove(address(dexPair), quoteAmount);
        received = dexPair.swap(address(quoteToken), quoteAmount, minTokens, msg.sender, deadline);
        emit Purchased(msg.sender, quoteAmount, received);
    }
}
