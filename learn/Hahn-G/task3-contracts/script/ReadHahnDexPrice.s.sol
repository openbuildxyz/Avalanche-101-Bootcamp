// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console2} from "forge-std/Script.sol";

import {HahnDexPriceReader} from "../src/HahnDexPriceReader.sol";

/// @notice Read-only report for screenshots after HAHN/WAVAX liquidity exists.
contract ReadHahnDexPrice is Script {
    address private constant HAHN = 0xef55c8d97a7e35ffabbd141bd5f8302b98175095;
    address private constant PANGOLIN_ROUTER = 0x2D99ABD9008Dc933ff5c0CD271B88309593aB921;

    function run() external {
        require(block.chainid == 43113, "ReadHahnDexPrice: Fuji only");

        HahnDexPriceReader reader = new HahnDexPriceReader(HAHN, PANGOLIN_ROUTER);
        address pairAddress = reader.getPairAddress();
        require(pairAddress != address(0), "ReadHahnDexPrice: create pair first");

        (uint256 reserveHAHN, uint256 reserveWAVAX) = reader.getReserves();

        console2.log("HAHN/WAVAX pair", pairAddress);
        console2.log("HAHN reserve", reserveHAHN);
        console2.log("WAVAX reserve", reserveWAVAX);
        console2.log("spot: AVAX wei per 1 HAHN", reader.getSpotPriceInAVAX());
        console2.log("quote: HAHN for 0.01 AVAX", reader.quoteHAHNForAVAX(0.01 ether));
        console2.log("quote: AVAX wei for 100 HAHN", reader.quoteAVAXForHAHN(100 ether));
    }
}
