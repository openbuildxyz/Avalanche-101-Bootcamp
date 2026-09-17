// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {RentalIncomeRightToken} from "../src/RentalIncomeRightToken.sol";

/**
 * @title TokenActions
 * @notice 部署后用于在测试网上演示发行 / 转账 / 销毁 / 更新资产证明的交互脚本,
 *         便于生成作业要求的功能截图。
 *
 * @dev 签名者由 Forge CLI 的 --private-key 决定 (脚本内部使用无参 vm.startBroadcast()),
 *      因此同一条命令换一个 --private-key 就能以不同身份操作, 脚本本身不读取环境变量。
 *
 * 用法 / Usage (每个动作独立一条命令, 可单独截图):
 *
 *   # 只读查询, 不需要私钥
 *   forge script script/TokenActions.s.sol:TokenActions \
 *     --sig "runRead(address)" $TOKEN --rpc-url $FUJI_RPC_URL
 *
 *   # 发行: owner 向 investor 发行 1000 XRIR
 *   forge script script/TokenActions.s.sol:TokenActions \
 *     --sig "runMint(address,address,uint256)" $TOKEN $INVESTOR 1000000000000000000000 \
 *     --rpc-url $FUJI_RPC_URL --broadcast --private-key $OWNER_KEY
 *
 *   # 转账: investor 向 receiver 转 400 XRIR
 *   forge script script/TokenActions.s.sol:TokenActions \
 *     --sig "runTransfer(address,address,address,uint256)" $TOKEN $INVESTOR $RECEIVER 400000000000000000000 \
 *     --rpc-url $FUJI_RPC_URL --broadcast --private-key $INVESTOR_KEY
 *
 *   # 销毁: investor 销毁 250 XRIR
 *   forge script script/TokenActions.s.sol:TokenActions \
 *     --sig "runBurn(address,address,uint256)" $TOKEN $INVESTOR 250000000000000000000 \
 *     --rpc-url $FUJI_RPC_URL --broadcast --private-key $INVESTOR_KEY
 *
 *   # 更新资产证明 (必须用 owner 的私钥)
 *   forge script script/TokenActions.s.sol:TokenActions \
 *     --sig "runUpdateDocument(address,string)" $TOKEN "ipfs://..." \
 *     --rpc-url $FUJI_RPC_URL --broadcast --private-key $OWNER_KEY
 */
contract TokenActions is Script {
    /// @notice 发行新的租金收益权份额。签名者必须是 owner, 否则回滚 OwnableUnauthorizedAccount。
    function runMint(address tokenAddress, address to, uint256 amount) external {
        RentalIncomeRightToken token = RentalIncomeRightToken(tokenAddress);

        console2.log("=== mint (issuance) ===");
        console2.log("Token :", tokenAddress);
        console2.log("To    :", to);
        console2.log("Amount:", amount);

        vm.startBroadcast();
        token.mint(to, amount);
        vm.stopBroadcast();

        console2.log("recipient balance:", token.balanceOf(to));
        console2.log("totalSupply      :", token.totalSupply());
    }

    /// @notice 持币人向他人转让收益权份额。签名者必须是 `from`。
    function runTransfer(address tokenAddress, address from, address to, uint256 amount) external {
        RentalIncomeRightToken token = RentalIncomeRightToken(tokenAddress);

        console2.log("=== transfer (secondary transfer) ===");
        console2.log("Token :", tokenAddress);
        console2.log("From  :", from);
        console2.log("To    :", to);
        console2.log("Amount:", amount);

        vm.startBroadcast();
        token.transfer(to, amount);
        vm.stopBroadcast();

        console2.log("sender balance  :", token.balanceOf(from));
        console2.log("receiver balance:", token.balanceOf(to));
        console2.log("totalSupply     :", token.totalSupply());
    }

    /// @notice 持币人销毁自己的收益权份额 (赎回 / 到期注销)。签名者必须是 `holder`。
    function runBurn(address tokenAddress, address holder, uint256 amount) external {
        RentalIncomeRightToken token = RentalIncomeRightToken(tokenAddress);

        console2.log("=== burn (redemption) ===");
        console2.log("Token :", tokenAddress);
        console2.log("Holder:", holder);
        console2.log("Amount:", amount);

        vm.startBroadcast();
        token.burn(amount);
        vm.stopBroadcast();

        console2.log("holder balance:", token.balanceOf(holder));
        console2.log("totalSupply   :", token.totalSupply());
    }

    /// @notice 更新链上资产证明信息。签名者必须是 owner。
    function runUpdateDocument(address tokenAddress, string calldata newDocument) external {
        RentalIncomeRightToken token = RentalIncomeRightToken(tokenAddress);

        console2.log("=== updateAssetDocument ===");
        console2.log("Token       :", tokenAddress);
        console2.log("New document:", newDocument);

        vm.startBroadcast();
        token.updateAssetDocument(newDocument);
        vm.stopBroadcast();

        console2.log("assetDocument is now:", token.assetDocument());
        console2.log("updatedAt           :", token.assetDocumentUpdatedAt());
    }

    /// @notice 只读查询合约状态, 用于截图证明部署结果。不需要私钥。
    function runRead(address tokenAddress) external view {
        RentalIncomeRightToken token = RentalIncomeRightToken(tokenAddress);

        console2.log("=== XRIR on-chain state ===");
        console2.log("Token address :", tokenAddress);
        console2.log("name          :", token.name());
        console2.log("symbol        :", token.symbol());
        console2.log("decimals      :", token.decimals());
        console2.log("totalSupply   :", token.totalSupply());
        console2.log("MAX_SUPPLY    :", token.MAX_SUPPLY());
        console2.log("owner         :", token.owner());
        console2.log("paused        :", token.paused());
        console2.log("documentUpdatedAt:", token.assetDocumentUpdatedAt());
        console2.log("assetDocument :", token.assetDocument());
    }
}
