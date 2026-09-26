// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20Minimal} from "./interfaces/IPangolinV2.sol";

interface IHahnDexPriceReader {
    function HAHN() external view returns (address);
    function quoteHAHNForAVAX(uint256 avaxIn) external view returns (uint256 hahnOut);
}

/// @title HahnDexSale
/// @notice Sells inventory at the live HAHN/WAVAX price quoted by Pangolin V2.
/// @dev Demonstration contract: a production sale should use a manipulation-resistant TWAP/oracle.
contract HahnDexSale {
    IHahnDexPriceReader public immutable priceReader;
    IERC20Minimal public immutable hahn;
    address public immutable owner;

    error HahnDexSale__NotOwner();
    error HahnDexSale__ZeroPayment();
    error HahnDexSale__Slippage(uint256 quoted, uint256 minimum);
    error HahnDexSale__InsufficientInventory(uint256 available, uint256 required);
    error HahnDexSale__TransferFailed();
    error HahnDexSale__WithdrawFailed();

    event Purchased(address indexed buyer, uint256 avaxPaid, uint256 hahnReceived);
    event ProceedsWithdrawn(address indexed recipient, uint256 amount);

    constructor(address reader) {
        require(reader != address(0), "HahnDexSale: zero reader");
        priceReader = IHahnDexPriceReader(reader);
        hahn = IERC20Minimal(priceReader.HAHN());
        owner = msg.sender;
    }

    function previewPurchase(uint256 avaxIn) external view returns (uint256) {
        return priceReader.quoteHAHNForAVAX(avaxIn);
    }

    function buyWithAVAX(uint256 minHahnOut) external payable returns (uint256 hahnOut) {
        if (msg.value == 0) revert HahnDexSale__ZeroPayment();

        hahnOut = priceReader.quoteHAHNForAVAX(msg.value);
        if (hahnOut < minHahnOut) revert HahnDexSale__Slippage(hahnOut, minHahnOut);

        uint256 inventory = hahn.balanceOf(address(this));
        if (inventory < hahnOut) revert HahnDexSale__InsufficientInventory(inventory, hahnOut);
        if (!hahn.transfer(msg.sender, hahnOut)) revert HahnDexSale__TransferFailed();

        emit Purchased(msg.sender, msg.value, hahnOut);
    }

    function withdrawProceeds(address payable recipient) external {
        if (msg.sender != owner) revert HahnDexSale__NotOwner();
        require(recipient != address(0), "HahnDexSale: zero recipient");

        uint256 amount = address(this).balance;
        (bool success,) = recipient.call{value: amount}("");
        if (!success) revert HahnDexSale__WithdrawFailed();
        emit ProceedsWithdrawn(recipient, amount);
    }
}
