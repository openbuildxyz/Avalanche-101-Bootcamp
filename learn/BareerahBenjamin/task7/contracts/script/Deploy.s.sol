// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {Vault} from "../src/Vault.sol";

/// @title Deploy —— 一键部署 mini-dex 合约
/// @notice 环境变量：
///         PRIVATE_KEY     部署者私钥（anvil 模式用账户 #0）
///         SIGNER_ADDRESS  后端签名地址（anvil 模式用账户 #1；server 用对应私钥签 Withdraw）
///
///         anvil: PRIVATE_KEY=... SIGNER_ADDRESS=... forge script script/Deploy.s.sol --rpc-url anvil --broadcast
///         fuji : PRIVATE_KEY=... SIGNER_ADDRESS=... forge script script/Deploy.s.sol --rpc-url fuji  --broadcast
contract Deploy is Script {
    function run() external {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address signer = vm.envAddress("SIGNER_ADDRESS");
        address deployer = vm.addr(deployerPk);

        vm.startBroadcast(deployerPk);

        // 1. 两个测试代币
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        MockERC20 wavax = new MockERC20("Wrapped AVAX", "WAVAX", 18);

        // 2. 金库，signer = 后端签名地址
        Vault vault = new Vault(signer);
        vault.setAllowedToken(address(usdc), true);
        vault.setAllowedToken(address(wavax), true);

        // 3. 给部署者发点启动资金：1,000,000 USDC + 10,000 WAVAX（学生自己用 mint 水龙头也行）
        usdc.mint(deployer, 1_000_000 * 10 ** 6);
        wavax.mint(deployer, 10_000 * 10 ** 18);

        vm.stopBroadcast();

        // 4. 直接复制到 server/.env 和 web/.env
        console.log("");
        console.log("# ---- mini-dex deployed: copy the lines below into server/.env and web/.env ----");
        console.log("CHAIN_ID=%s", block.chainid);
        console.log("VAULT_ADDRESS=%s", address(vault));
        console.log("USDC_ADDRESS=%s", address(usdc));
        console.log("WAVAX_ADDRESS=%s", address(wavax));
        console.log("SIGNER_ADDRESS=%s", signer);
        console.log("# deployer=%s", deployer);
    }
}
