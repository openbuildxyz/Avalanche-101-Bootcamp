// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";

import {AvalancheBuilderTokenV2} from "../src/AvalancheBuilderTokenV2.sol";
import {ILFJFactory, ILFJRouter} from "../src/interfaces/ILFJ.sol";

contract DeployAndSetup is Script {
    address internal constant LFJ_ROUTER = 0xd7f655E3376cE2D7A2b08fF01Eb3B1023191A901;
    uint256 internal constant TOKEN_LIQUIDITY = 10_000 ether;
    uint256 internal constant AVAX_LIQUIDITY = 0.02 ether;
    uint256 internal constant SALE_INVENTORY = 100_000 ether;
    uint256 internal constant DEMO_PURCHASE = 0.001 ether;

    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(privateKey);

        vm.startBroadcast(privateKey);

        AvalancheBuilderTokenV2 token = new AvalancheBuilderTokenV2(deployer, LFJ_ROUTER);
        token.approve(LFJ_ROUTER, TOKEN_LIQUIDITY);
        ILFJRouter(LFJ_ROUTER).addLiquidityAVAX{value: AVAX_LIQUIDITY}(
            address(token), TOKEN_LIQUIDITY, 0, 0, deployer, block.timestamp + 1 hours
        );
        token.transfer(address(token), SALE_INVENTORY);

        address pairAddress = ILFJFactory(ILFJRouter(LFJ_ROUTER).factory()).getPair(address(token), token.wavax());
        uint256 quotedTokens = token.quoteTokensForAVAX(DEMO_PURCHASE);
        token.buyWithAVAX{value: DEMO_PURCHASE}(quotedTokens * 99 / 100);

        vm.stopBroadcast();

        console.log("ABTv2", address(token));
        console.log("ABTv2/WAVAX pair", pairAddress);
        console.log("0.001 AVAX quote", quotedTokens);
        console.log("1 ABTv2 price in AVAX wei", token.tokenPriceInAVAX());
    }
}
