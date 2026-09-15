// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {ILFJFactory, ILFJPair, ILFJRouter} from "./interfaces/ILFJ.sol";

/**
 * @title AvalancheBuilderTokenV2
 * @notice Task 2 token extended with a token sale priced by a live LFJ V1 liquidity pair.
 */
contract AvalancheBuilderTokenV2 is ERC20, ERC20Burnable, Ownable, ReentrancyGuard {
    uint256 public constant INITIAL_SUPPLY = 1_000_000 ether;

    address public immutable dexRouter;

    error InvalidAddress();
    error PairUnavailable();
    error ZeroInput();
    error InsufficientOutput(uint256 minimum, uint256 actual);
    error InsufficientInventory(uint256 available, uint256 required);
    error TransferFailed();

    event TokensPurchased(address indexed buyer, uint256 avaxPaid, uint256 tokensReceived);
    event AVAXWithdrawn(address indexed recipient, uint256 amount);

    constructor(address initialOwner, address router)
        ERC20("Avalanche Builder Token V2", "ABTv2")
        Ownable(initialOwner)
    {
        if (router == address(0)) revert InvalidAddress();
        dexRouter = router;
        _mint(initialOwner, INITIAL_SUPPLY);
    }

    function wavax() public view returns (address) {
        return ILFJRouter(dexRouter).WAVAX();
    }

    function pair() public view returns (address) {
        return ILFJFactory(ILFJRouter(dexRouter).factory()).getPair(address(this), wavax());
    }

    /// @notice Returns the current LFJ swap quote, including pool fee and price impact.
    function quoteTokensForAVAX(uint256 avaxAmount) public view returns (uint256 tokenAmount) {
        if (avaxAmount == 0) revert ZeroInput();
        if (pair() == address(0)) revert PairUnavailable();

        address[] memory path = new address[](2);
        path[0] = wavax();
        path[1] = address(this);
        tokenAmount = ILFJRouter(dexRouter).getAmountsOut(avaxAmount, path)[1];
    }

    /// @notice Returns the reserve-based spot price of one ABTv2, denominated in AVAX with 18 decimals.
    function tokenPriceInAVAX() external view returns (uint256) {
        address pairAddress = pair();
        if (pairAddress == address(0)) revert PairUnavailable();

        (uint112 reserve0, uint112 reserve1,) = ILFJPair(pairAddress).getReserves();
        (uint256 tokenReserve, uint256 avaxReserve) = ILFJPair(pairAddress).token0() == address(this)
            ? (uint256(reserve0), uint256(reserve1))
            : (uint256(reserve1), uint256(reserve0));
        if (tokenReserve == 0 || avaxReserve == 0) revert PairUnavailable();

        return avaxReserve * 1 ether / tokenReserve;
    }

    /// @notice Purchases inventory tokens using the live LFJ quote as the sale price.
    function buyWithAVAX(uint256 minTokensOut) external payable nonReentrant returns (uint256 tokensOut) {
        tokensOut = quoteTokensForAVAX(msg.value);
        if (tokensOut < minTokensOut) revert InsufficientOutput(minTokensOut, tokensOut);

        uint256 inventory = balanceOf(address(this));
        if (inventory < tokensOut) revert InsufficientInventory(inventory, tokensOut);

        _transfer(address(this), msg.sender, tokensOut);
        emit TokensPurchased(msg.sender, msg.value, tokensOut);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function withdrawAVAX(address payable recipient) external onlyOwner nonReentrant {
        if (recipient == address(0)) revert InvalidAddress();
        uint256 amount = address(this).balance;
        (bool success,) = recipient.call{value: amount}("");
        if (!success) revert TransferFailed();
        emit AVAXWithdrawn(recipient, amount);
    }
}
