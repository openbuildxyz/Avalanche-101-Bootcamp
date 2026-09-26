// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { Script, console } from "forge-std/Script.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { AvalancheBootcampToken } from "../src/AvalancheBootcampToken.sol";
import { IPangolinFactory, IPangolinRouter } from "../src/interfaces/IPangolin.sol";

contract DeployAndSetup is Script {
    address constant PANGOLIN_ROUTER = 0x2D99ABD9008Dc933ff5c0CD271B88309593aB921;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        uint256 tokenLiquidity = 20_000 ether;
        uint256 avaxLiquidity = 0.001 ether;

        vm.startBroadcast(pk);

        AvalancheBootcampToken token = new AvalancheBootcampToken(deployer, PANGOLIN_ROUTER);
        console.log("token", address(token));

        token.approve(PANGOLIN_ROUTER, tokenLiquidity);
        IPangolinRouter(PANGOLIN_ROUTER).addLiquidityAVAX{ value: avaxLiquidity }(
            address(token), tokenLiquidity, 0, 0, deployer, block.timestamp + 1 hours
        );

        address pair =
            IPangolinFactory(IPangolinRouter(PANGOLIN_ROUTER).factory()).getPair(address(token), token.wavax());
        console.log("pair", pair);

        uint256 quote = token.getTokenAmountForAVAX(0.0002 ether);
        console.log("quote 0.0002 AVAX -> ABT", quote);

        token.buyTokensWithAVAX{ value: 0.0002 ether }();
        console.log("buyer ABT balance", token.balanceOf(deployer));
        console.log("spot 1 ABT in AVAX wei", token.getTokenPriceInAVAX());

        vm.stopBroadcast();

        IERC20(address(token));
    }
}
