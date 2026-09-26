// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Vault} from "../src/Vault.sol";

/// @notice Performs a real Fuji approve, deposit and EIP-712-authorized withdraw.
contract DepositWithdraw is Script {
    address private constant VAULT = 0xBc89A17E407A95b02b1DeE3347B6346dDF988dff;
    address private constant USDC = 0x0925646D3497B14462723FDc2Fd91b617fd1E7bA;
    uint256 private constant DEPOSIT_AMOUNT = 100 * 1e6;
    uint256 private constant WITHDRAW_AMOUNT = 25 * 1e6;
    uint256 private constant NONCE = 2026092601;

    function run() external {
        require(block.chainid == 43113, "DepositWithdraw: Fuji only");
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(privateKey);
        Vault vault = Vault(VAULT);

        vm.startBroadcast(privateKey);
        IERC20(USDC).approve(VAULT, DEPOSIT_AMOUNT);
        vault.deposit(USDC, DEPOSIT_AMOUNT);
        vm.stopBroadcast();

        uint256 deadline = block.timestamp + 1 days;
        bytes32 digest = vault.hashWithdraw(user, USDC, WITHDRAW_AMOUNT, NONCE, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.startBroadcast(privateKey);
        vault.withdraw(USDC, WITHDRAW_AMOUNT, NONCE, deadline, signature);
        vm.stopBroadcast();

        console.log("user", user);
        console.log("vault USDC balance after withdraw", IERC20(USDC).balanceOf(VAULT));
        console.log("user tracked deposit balance", vault.balances(user, USDC));
    }
}
