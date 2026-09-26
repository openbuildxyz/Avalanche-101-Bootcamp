// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console2} from "forge-std/Script.sol";
import {HahnSolarRWA} from "../src/HahnSolarRWA.sol";

contract DeployAndDemo is Script {
    address private constant DEMO_RECIPIENT = 0x1111111111111111111111111111111111111111;
    string private constant DOCUMENT = "ipfs://bafy-hahn-community-solar-audit-2026-09";

    function run() external returns (HahnSolarRWA token) {
        require(block.chainid == 43113, "DeployAndDemo: Fuji only");
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(privateKey);

        vm.startBroadcast(privateKey);
        token = new HahnSolarRWA(deployer, DOCUMENT);
        token.mint(deployer, 100_000 ether);
        token.transfer(DEMO_RECIPIENT, 1_000 ether);
        token.burn(500 ether);
        vm.stopBroadcast();

        console2.log("HSRT contract", address(token));
        console2.log("issuer balance", token.balanceOf(deployer));
        console2.log("recipient balance", token.balanceOf(DEMO_RECIPIENT));
        console2.log("total supply", token.totalSupply());
        console2.log("asset document", token.assetDocument());
    }
}

