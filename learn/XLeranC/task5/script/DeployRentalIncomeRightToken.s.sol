// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {RentalIncomeRightToken} from "../src/RentalIncomeRightToken.sol";

/**
 * @title DeployRentalIncomeRightToken
 * @notice 将 XRIR (星海广场租金收益权) 部署到 Avalanche Fuji Testnet。
 *
 * 用法 / Usage:
 *   forge script script/DeployRentalIncomeRightToken.s.sol:DeployRentalIncomeRightToken \
 *     --rpc-url $FUJI_RPC_URL --broadcast --private-key $PRIVATE_KEY
 *
 * 必需环境变量:
 *   PRIVATE_KEY      部署者私钥 (仅用于测试网, 不要使用主网有资产的私钥)
 * 可选环境变量:
 *   TOKEN_OWNER      授权账户地址, 默认 = 部署者
 *   ASSET_DOCUMENT   初始资产证明信息, 默认见 DEFAULT_ASSET_DOCUMENT
 */
contract DeployRentalIncomeRightToken is Script {
    /// @dev 模拟的资产证明: 真实项目中应为 IPFS CID / 文档哈希 / 线下登记编号。
    string internal constant DEFAULT_ASSET_DOCUMENT =
        "ipfs://bafybeigd7yqkqkzv3hq2s5kz2m5tq3xg2c4m3f6kz4q2w7n5c3t2example/rental-rights-prospectus.json";

    /**
     * @notice 广播部署到当前 RPC 对应的网络。
     * @return token 已部署的合约实例。
     */
    function run() external returns (RentalIncomeRightToken token) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address initialOwner = vm.envOr("TOKEN_OWNER", deployer);
        string memory assetDoc = vm.envOr("ASSET_DOCUMENT", DEFAULT_ASSET_DOCUMENT);

        console2.log("=== RentalIncomeRightToken (XRIR) deployment ===");
        console2.log("Chain ID      :", block.chainid);
        console2.log("Deployer      :", deployer);
        console2.log("Initial owner :", initialOwner);
        console2.log("Asset document:", assetDoc);
        console2.log("Max supply    :", uint256(12_000_000 ether));

        vm.startBroadcast(deployerPrivateKey);
        token = new RentalIncomeRightToken(initialOwner, assetDoc);
        vm.stopBroadcast();

        console2.log("--------------------------------------------------");
        console2.log("RentalIncomeRightToken deployed at:", address(token));
        console2.log("--------------------------------------------------");
    }

    /**
     * @notice 非广播版本, 供测试或本地 anvil 环境复用。
     */
    function runWithOwner(address initialOwner) external returns (RentalIncomeRightToken token) {
        token = new RentalIncomeRightToken(initialOwner, DEFAULT_ASSET_DOCUMENT);
    }
}
