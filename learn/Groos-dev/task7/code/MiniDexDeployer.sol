// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {MockERC20} from "./MockERC20.sol";
import {Vault} from "./Vault.sol";

/// 一次交易部署 USDC、WAVAX 和 Vault。调用者用钱包签名即可，不需要把私钥交给命令行。
/// 金库的管理员是本合约；两个代币的充值白名单在构造里设置完成。
contract MiniDexDeployer {
    event Deployed(address indexed usdc, address indexed wavax, address indexed vault);

    constructor(address signer) {
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        MockERC20 wavax = new MockERC20("Wrapped AVAX", "WAVAX", 18);
        Vault vault = new Vault(signer);
        vault.setAllowedToken(address(usdc), true);
        vault.setAllowedToken(address(wavax), true);
        usdc.mint(msg.sender, 1_000_000 * 10 ** 6);
        wavax.mint(msg.sender, 10_000 * 10 ** 18);
        emit Deployed(address(usdc), address(wavax), address(vault));
    }
}
