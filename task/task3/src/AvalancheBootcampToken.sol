// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Burnable } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { IPangolinFactory, IPangolinPair, IPangolinRouter } from "./interfaces/IPangolin.sol";

/**
 * @title AvalancheBootcampToken
 * @notice Task 2 ERC-20 extended so mint/redeem amounts come from a live Pangolin pair, not a hardcoded price.
 */
contract AvalancheBootcampToken is ERC20, ERC20Burnable, Ownable, ReentrancyGuard {
    uint256 public constant INITIAL_SUPPLY = 1_000_000 ether;

    address public immutable dexRouter;

    event TokensPurchased(address indexed buyer, uint256 avaxPaid, uint256 tokensMinted);
    event TokensSold(address indexed seller, uint256 tokensBurned, uint256 avaxRefunded);

    constructor(address initialOwner, address _dexRouter) ERC20("Avalanche Bootcamp Token", "ABT") Ownable(initialOwner) {
        require(_dexRouter != address(0), "DEX router required");
        dexRouter = _dexRouter;
        _mint(initialOwner, INITIAL_SUPPLY);
    }

    receive() external payable {}

    function wavax() public view returns (address) {
        return IPangolinRouter(dexRouter).WAVAX();
    }

    function getPairAddress() public view returns (address) {
        return IPangolinFactory(IPangolinRouter(dexRouter).factory()).getPair(address(this), wavax());
    }

    /// @notice Spot price from pair reserves: 1 ABT in WAVAX, 18 decimals.
    function getTokenPriceInAVAX() public view returns (uint256) {
        (uint256 reserveToken, uint256 reserveWAVAX) = getReserves();
        require(reserveToken > 0 && reserveWAVAX > 0, "no liquidity");
        return (reserveWAVAX * 1 ether) / reserveToken;
    }

    function getReserves() public view returns (uint256 reserveToken, uint256 reserveWAVAX) {
        address pair = getPairAddress();
        require(pair != address(0), "pair missing");
        (uint112 r0, uint112 r1,) = IPangolinPair(pair).getReserves();
        if (IPangolinPair(pair).token0() == address(this)) {
            reserveToken = uint256(r0);
            reserveWAVAX = uint256(r1);
        } else {
            reserveToken = uint256(r1);
            reserveWAVAX = uint256(r0);
        }
    }

    /// @notice Router quote: how many ABT `avaxAmount` buys, including the 0.3% AMM fee.
    function getTokenAmountForAVAX(uint256 avaxAmount) public view returns (uint256) {
        require(avaxAmount > 0, "zero AVAX");
        address[] memory path = new address[](2);
        path[0] = wavax();
        path[1] = address(this);
        return IPangolinRouter(dexRouter).getAmountsOut(avaxAmount, path)[1];
    }

    /// @notice Router quote: how much AVAX `tokenAmount` sells for, including the 0.3% AMM fee.
    function getAVAXAmountForToken(uint256 tokenAmount) public view returns (uint256) {
        require(tokenAmount > 0, "zero token");
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = wavax();
        return IPangolinRouter(dexRouter).getAmountsOut(tokenAmount, path)[1];
    }

    /// @notice Mint ABT using the live Pangolin quote as the sale price.
    function buyTokensWithAVAX() external payable nonReentrant returns (uint256 tokensBought) {
        require(msg.value > 0, "send AVAX");
        tokensBought = getTokenAmountForAVAX(msg.value);
        require(tokensBought > 0, "zero output");
        _mint(msg.sender, tokensBought);
        emit TokensPurchased(msg.sender, msg.value, tokensBought);
    }

    /// @notice Burn ABT and refund AVAX using the live Pangolin quote.
    function sellTokensForAVAX(uint256 tokenAmount) external nonReentrant returns (uint256 avaxRefund) {
        require(tokenAmount > 0, "zero token");
        avaxRefund = getAVAXAmountForToken(tokenAmount);
        require(address(this).balance >= avaxRefund, "insufficient AVAX");
        _burn(msg.sender, tokenAmount);
        (bool ok,) = msg.sender.call{ value: avaxRefund }("");
        require(ok, "AVAX transfer failed");
        emit TokensSold(msg.sender, tokenAmount, avaxRefund);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
