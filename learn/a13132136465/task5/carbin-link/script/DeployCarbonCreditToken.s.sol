// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CarbonCreditToken} from "../src/CarbonCreditToken.sol";

interface Vm {
    function envUint(string calldata name) external returns (uint256 value);
    function envString(string calldata name) external returns (string memory value);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract DeployCarbonCreditToken {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (CarbonCreditToken token) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        string memory initialAssetDocument = vm.envString("INITIAL_ASSET_DOCUMENT");

        vm.startBroadcast(deployerPrivateKey);
        token = new CarbonCreditToken(initialAssetDocument);
        vm.stopBroadcast();
    }
}

