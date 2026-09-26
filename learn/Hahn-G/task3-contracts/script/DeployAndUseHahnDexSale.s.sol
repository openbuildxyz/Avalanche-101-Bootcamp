// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console2} from "forge-std/Script.sol";

import {HahnDexPriceReader} from "../src/HahnDexPriceReader.sol";
import {HahnDexSale} from "../src/HahnDexSale.sol";
import {IERC20Minimal} from "../src/interfaces/IPangolinV2.sol";

contract DeployAndUseHahnDexSale is Script {
    address private constant HAHN = 0xEF55c8d97a7e35FfAbbd141bD5F8302B98175095;
    address private constant PANGOLIN_ROUTER = 0x2D99ABD9008Dc933ff5c0CD271B88309593aB921;

    uint256 private constant SALE_INVENTORY = 5_000 ether;
    uint256 private constant DEMO_PAYMENT = 0.005 ether;

    function run() external returns (HahnDexPriceReader reader, HahnDexSale sale) {
        require(block.chainid == 43113, "DeployAndUseHahnDexSale: Fuji only");

        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(privateKey);

        vm.startBroadcast(privateKey);

        reader = new HahnDexPriceReader(HAHN, PANGOLIN_ROUTER);
        sale = new HahnDexSale(address(reader));
        require(IERC20Minimal(HAHN).transfer(address(sale), SALE_INVENTORY), "inventory transfer failed");

        uint256 quoted = sale.previewPurchase(DEMO_PAYMENT);
        uint256 received = sale.buyWithAVAX{value: DEMO_PAYMENT}(quoted * 99 / 100);

        vm.stopBroadcast();

        console2.log("price reader", address(reader));
        console2.log("DEX-priced sale", address(sale));
        console2.log("buyer", deployer);
        console2.log("AVAX paid", DEMO_PAYMENT);
        console2.log("HAHN received", received);
        console2.log("sale HAHN inventory remaining", IERC20Minimal(HAHN).balanceOf(address(sale)));
    }
}
