// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";

import {GPURentalReceivableToken} from "../src/GPURentalReceivableToken.sol";

contract DeployAndDemonstrate is Script {
    address internal constant RECIPIENT = 0x119B4976Ca5d34a7ED501B8Fba9f629aD58a4435;
    uint256 internal constant ISSUED_AMOUNT = 10_000e6;
    uint256 internal constant TRANSFER_AMOUNT = 1_250e6;
    uint256 internal constant BURN_AMOUNT = 500e6;

    string internal constant INITIAL_DOCUMENT = "urn:grrt:GPU-LEASE-2026-09:v1";
    string internal constant UPDATED_DOCUMENT =
        "sha256:3fba4da68c8587e569f67fd643ffb8a4fb655d16712be5e00249cb3cadd6a3a1";

    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(privateKey);

        vm.startBroadcast(privateKey);

        GPURentalReceivableToken token = new GPURentalReceivableToken(deployer, INITIAL_DOCUMENT);
        token.mint(deployer, ISSUED_AMOUNT);
        token.transfer(RECIPIENT, TRANSFER_AMOUNT);
        token.burn(BURN_AMOUNT);
        token.updateAssetDocument(UPDATED_DOCUMENT);

        vm.stopBroadcast();

        console.log("GRRT contract", address(token));
        console.log("Admin", deployer);
        console.log("Recipient", RECIPIENT);
        console.log("Total supply", token.totalSupply());
        console.log("Admin balance", token.balanceOf(deployer));
        console.log("Recipient balance", token.balanceOf(RECIPIENT));
        console.log("Asset document", token.assetDocument());
    }
}
