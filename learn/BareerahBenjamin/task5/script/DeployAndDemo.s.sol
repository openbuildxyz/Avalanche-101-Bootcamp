// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {CoffeeWarehouseToken} from "../src/CoffeeWarehouseToken.sol";

interface VmScript {
    function envUint(string calldata name) external returns (uint256);
    function addr(uint256 privateKey) external returns (address);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
    function readFileBinary(string calldata path) external view returns (bytes memory);
    function toString(bytes32 value) external pure returns (string memory);
}

contract DeployAndDemo {
    VmScript private constant vm =
        VmScript(address(uint160(uint256(keccak256("hevm cheat code")))));
    // Recipient from the student profile; only receives simulated tokens.
    address public constant RECIPIENT = 0xE83B1DCF8F9F3765DAbd34555f39240a14f5AcE9;

    function run() external returns (CoffeeWarehouseToken token) {
        require(block.chainid == 43113, "Fuji only (chain ID 43113)");
        uint256 key = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(key);
        string memory proof1 = string.concat(
            "sha256:", vm.toString(sha256(vm.readFileBinary("docs/asset-proof-v1.json")))
        );
        string memory proof2 = string.concat(
            "sha256:", vm.toString(sha256(vm.readFileBinary("docs/asset-proof-v2.json")))
        );
        vm.startBroadcast(key);
        token = new CoffeeWarehouseToken(deployer, proof1);
        token.mint(deployer, 1_000 * 1_000);
        require(token.transfer(RECIPIENT, 200 * 1_000), "Transfer failed");
        token.burn(50 * 1_000);
        token.updateAssetDocument(proof2);
        vm.stopBroadcast();
        require(token.totalSupply() == 950 * 1_000, "Supply mismatch");
        require(token.balanceOf(deployer) == 750 * 1_000, "Deployer balance mismatch");
        require(token.balanceOf(RECIPIENT) == 200 * 1_000, "Recipient balance mismatch");
        require(token.totalIssued() == 1_000 * 1_000, "Lifetime issuance mismatch");
        require(token.documentVersion() == 2, "Document version mismatch");
    }
}
