// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console2} from "forge-std/Script.sol";

import {IERC20Minimal, IPangolinFactory, IPangolinRouter} from "../src/interfaces/IPangolinV2.sol";

/// @notice Creates the HAHN/WAVAX Pangolin V2 pair when needed and seeds liquidity.
contract SetupHahnLiquidity is Script {
    address private constant HAHN = 0xEF55c8d97a7e35FfAbbd141bD5F8302B98175095;
    address private constant PANGOLIN_ROUTER = 0x2D99ABD9008Dc933ff5c0CD271B88309593aB921;

    uint256 private constant TOKEN_LIQUIDITY = 10_000 ether;
    uint256 private constant AVAX_LIQUIDITY = 0.1 ether;

    function run() external returns (address pairAddress) {
        require(block.chainid == 43113, "SetupHahnLiquidity: Fuji only");

        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address provider = vm.addr(privateKey);
        IPangolinRouter router = IPangolinRouter(PANGOLIN_ROUTER);

        require(IERC20Minimal(HAHN).balanceOf(provider) >= TOKEN_LIQUIDITY, "insufficient HAHN");
        require(provider.balance > AVAX_LIQUIDITY, "insufficient AVAX plus gas");

        console2.log("liquidity provider", provider);
        console2.log("HAHN desired", TOKEN_LIQUIDITY);
        console2.log("AVAX desired", AVAX_LIQUIDITY);

        vm.startBroadcast(privateKey);

        require(IERC20Minimal(HAHN).approve(PANGOLIN_ROUTER, TOKEN_LIQUIDITY), "HAHN approve failed");

        (uint256 tokenUsed, uint256 avaxUsed, uint256 liquidity) = router.addLiquidityAVAX{value: AVAX_LIQUIDITY}(
            HAHN,
            TOKEN_LIQUIDITY,
            TOKEN_LIQUIDITY * 99 / 100,
            AVAX_LIQUIDITY * 99 / 100,
            provider,
            block.timestamp + 20 minutes
        );

        vm.stopBroadcast();

        address wavax = router.WAVAX();
        pairAddress = IPangolinFactory(router.factory()).getPair(HAHN, wavax);
        require(pairAddress != address(0), "pair creation failed");

        console2.log("WAVAX", wavax);
        console2.log("HAHN/WAVAX pair", pairAddress);
        console2.log("HAHN used", tokenUsed);
        console2.log("AVAX used", avaxUsed);
        console2.log("LP tokens minted", liquidity);
    }
}

