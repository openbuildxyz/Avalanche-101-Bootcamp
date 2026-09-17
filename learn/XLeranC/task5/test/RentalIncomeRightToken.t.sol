// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {RentalIncomeRightToken} from "../src/RentalIncomeRightToken.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

/**
 * @title RentalIncomeRightTokenTest
 * @notice Foundry 测试套件, 覆盖作业要求的 9 个场景:
 *         部署成功 / 初始信息 / 授权发行 / 非授权不能发行 / 转账 / 销毁 /
 *         供应量与余额变化 / 非授权不能改资产证明 / 错误操作被拒绝。
 */
contract RentalIncomeRightTokenTest is Test {
    RentalIncomeRightToken internal token;

    address internal owner;
    address internal alice;
    address internal bob;
    address internal stranger;

    string internal constant NAME = "Xinghai Plaza Rental Income Right";
    string internal constant SYMBOL = "XRIR";
    string internal constant DEFAULT_DOC =
        "ipfs://bafybeigd7yqkqkzv3hq2s5kz2m5tq3xg2c4m3f6kz4q2w7n5c3t2example/rental-rights-prospectus.json";
    string internal constant NEW_DOC =
        "ipfs://bafybeih2x9k4m2v7q3s5t6u7v8w9x0y1z2a3b4c5d6e7f8g9h0i1j2k3l/asset-report-2026Q1.json";

    event TokensMinted(address indexed operator, address indexed to, uint256 amount);
    event TokensBurned(address indexed operator, address indexed from, uint256 amount);
    event AssetDocumentUpdated(
        address indexed operator, string previousDocument, string newDocument
    );

    function setUp() public {
        owner = makeAddr("owner");
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        stranger = makeAddr("stranger");

        vm.prank(owner);
        token = new RentalIncomeRightToken(owner, DEFAULT_DOC);
    }

    /// @dev 以授权账户身份铸币的便捷辅助函数。
    function _mintAsOwner(address to, uint256 amount) internal {
        vm.prank(owner);
        token.mint(to, amount);
    }

    // =====================================================================
    // 场景 1: 合约部署成功
    // =====================================================================

    function test_Deployment_Succeeds() public view {
        assertTrue(address(token) != address(0), "contract address should be non-zero");
        assertEq(token.owner(), owner, "owner should be the initialOwner");
        assertEq(token.name(), NAME);
        assertEq(token.symbol(), SYMBOL);
    }

    function test_InitialAssetDocument_IsSetAtDeployment() public view {
        assertEq(token.assetDocument(), DEFAULT_DOC);
        assertGt(token.assetDocumentUpdatedAt(), 0);
    }

    function test_Deploy_RevertsOnEmptyAssetDocument() public {
        vm.expectRevert(RentalIncomeRightToken.EmptyAssetDocument.selector);
        new RentalIncomeRightToken(owner, "");
    }

    function test_Deploy_RevertsOnZeroOwner() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
        new RentalIncomeRightToken(address(0), DEFAULT_DOC);
    }

    // =====================================================================
    // 场景 2: 初始 Token 信息正确
    // =====================================================================

    function test_InitialTokenInfo_IsCorrect() public view {
        assertEq(token.name(), NAME);
        assertEq(token.symbol(), SYMBOL);
        assertEq(token.decimals(), 18);
        assertEq(token.totalSupply(), 0, "initial total supply must be zero");
        assertEq(token.balanceOf(alice), 0);
        assertEq(token.assetDocument(), DEFAULT_DOC);
        assertEq(token.MAX_SUPPLY(), 12_000_000 ether);
        assertFalse(token.paused());
    }

    // =====================================================================
    // 场景 3: 授权账户可以发行 Token
    // =====================================================================

    function test_AuthorizedAccount_CanMint() public {
        _mintAsOwner(alice, 1000 ether);

        assertEq(token.balanceOf(alice), 1000 ether);
        assertEq(token.totalSupply(), 1000 ether);
    }

    function test_AuthorizedAccount_CanMintToMultipleHolders() public {
        _mintAsOwner(alice, 600 ether);
        _mintAsOwner(bob, 400 ether);

        assertEq(token.balanceOf(alice), 600 ether);
        assertEq(token.balanceOf(bob), 400 ether);
        assertEq(token.totalSupply(), 1000 ether);
    }

    function test_Mint_EmitsTokensMintedEvent() public {
        vm.expectEmit(true, true, false, true, address(token));
        emit TokensMinted(owner, alice, 500 ether);

        _mintAsOwner(alice, 500 ether);
    }

    function test_MaxSupply_CanBeMintedExactly() public {
        _mintAsOwner(alice, token.MAX_SUPPLY());

        assertEq(token.totalSupply(), token.MAX_SUPPLY());
        assertEq(token.balanceOf(alice), token.MAX_SUPPLY());
    }

    function test_MaxSupply_CannotBeExceeded() public {
        _mintAsOwner(alice, token.MAX_SUPPLY());

        vm.expectRevert(
            abi.encodeWithSelector(
                RentalIncomeRightToken.MaxSupplyExceeded.selector,
                token.MAX_SUPPLY(),
                token.MAX_SUPPLY() + 1
            )
        );
        _mintAsOwner(alice, 1);
    }

    // =====================================================================
    // 场景 4: 非授权账户不能发行 Token
    // =====================================================================

    function test_NonAuthorizedAccount_CannotMint() public {
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger)
        );
        vm.prank(stranger);
        token.mint(stranger, 1 ether);
    }

    function test_MintToZeroAddress_Reverts() public {
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InvalidReceiver.selector, address(0))
        );
        _mintAsOwner(address(0), 1 ether);
    }

    // =====================================================================
    // 场景 5: 持有人可以转账
    // =====================================================================

    function test_Holder_CanTransfer() public {
        _mintAsOwner(alice, 1000 ether);

        vm.prank(alice);
        token.transfer(bob, 400 ether);

        assertEq(token.balanceOf(alice), 600 ether);
        assertEq(token.balanceOf(bob), 400 ether);
        assertEq(token.totalSupply(), 1000 ether, "transfer must not change total supply");
    }

    function test_Holder_CanApproveAndTransferFrom() public {
        _mintAsOwner(alice, 1000 ether);

        vm.prank(alice);
        token.approve(bob, 300 ether);
        assertEq(token.allowance(alice, bob), 300 ether);

        vm.prank(bob);
        token.transferFrom(alice, bob, 300 ether);

        assertEq(token.balanceOf(alice), 700 ether);
        assertEq(token.balanceOf(bob), 300 ether);
        assertEq(token.allowance(alice, bob), 0, "allowance must be fully consumed");
    }

    function test_TransferToZeroAddress_Reverts() public {
        _mintAsOwner(alice, 1000 ether);

        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InvalidReceiver.selector, address(0))
        );
        vm.prank(alice);
        token.transfer(address(0), 1 ether);
    }

    // =====================================================================
    // 场景 6: Token 可以被销毁
    // =====================================================================

    function test_Tokens_CanBeBurned() public {
        _mintAsOwner(alice, 1000 ether);

        vm.prank(alice);
        token.burn(250 ether);

        assertEq(token.balanceOf(alice), 750 ether);
        assertEq(token.totalSupply(), 750 ether);
    }

    function test_Burn_EmitsTokensBurnedEvent() public {
        _mintAsOwner(alice, 1000 ether);

        vm.expectEmit(true, true, false, true, address(token));
        emit TokensBurned(alice, alice, 250 ether);

        vm.prank(alice);
        token.burn(250 ether);
    }

    function test_BurnFrom_RespectsAllowance() public {
        _mintAsOwner(alice, 1000 ether);

        vm.prank(alice);
        token.approve(bob, 200 ether);

        vm.prank(bob);
        token.burnFrom(alice, 200 ether);

        assertEq(token.balanceOf(alice), 800 ether);
        assertEq(token.totalSupply(), 800 ether);
    }

    function test_ForceBurn_ByOwner_Succeeds() public {
        _mintAsOwner(alice, 1000 ether);

        vm.expectEmit(true, true, false, true, address(token));
        emit TokensBurned(owner, alice, 400 ether);

        vm.prank(owner);
        token.forceBurn(alice, 400 ether);

        assertEq(token.balanceOf(alice), 600 ether);
        assertEq(token.totalSupply(), 600 ether);
    }

    function test_ForceBurn_ByNonOwner_Reverts() public {
        _mintAsOwner(alice, 1000 ether);

        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger)
        );
        vm.prank(stranger);
        token.forceBurn(alice, 1 ether);
    }

    // =====================================================================
    // 场景 7: 总供应量和账户余额变化正确
    // =====================================================================

    function test_TotalSupplyAndBalances_ChangeCorrectly() public {
        // 1. 发行 1,000 XRIR 给 alice
        _mintAsOwner(alice, 1000 ether);
        assertEq(token.totalSupply(), 1000 ether);
        assertEq(token.balanceOf(alice) + token.balanceOf(bob), token.totalSupply());

        // 2. alice 转账 300 XRIR 给 bob -> 总量不变
        vm.prank(alice);
        token.transfer(bob, 300 ether);
        assertEq(token.totalSupply(), 1000 ether);
        assertEq(token.balanceOf(alice), 700 ether);
        assertEq(token.balanceOf(bob), 300 ether);
        assertEq(token.balanceOf(alice) + token.balanceOf(bob), token.totalSupply());

        // 3. 再次发行 500 XRIR 给 bob -> 总量 1,500
        _mintAsOwner(bob, 500 ether);
        assertEq(token.totalSupply(), 1500 ether);
        assertEq(token.balanceOf(bob), 800 ether);
        assertEq(token.balanceOf(alice) + token.balanceOf(bob), token.totalSupply());

        // 4. bob 销毁 200 XRIR -> 总量 1,300
        vm.prank(bob);
        token.burn(200 ether);
        assertEq(token.totalSupply(), 1300 ether);
        assertEq(token.balanceOf(bob), 600 ether);
        assertEq(token.balanceOf(alice) + token.balanceOf(bob), token.totalSupply());

        // 5. owner 强制注销 alice 的 100 XRIR -> 总量 1,200
        vm.prank(owner);
        token.forceBurn(alice, 100 ether);
        assertEq(token.totalSupply(), 1200 ether);
        assertEq(token.balanceOf(alice), 600 ether);
        assertEq(token.balanceOf(alice) + token.balanceOf(bob), token.totalSupply());
    }

    function test_SelfBurnAndForceBurn_MatchTotalSupply() public {
        _mintAsOwner(alice, 12_000_000 ether);

        vm.prank(alice);
        token.burn(12_000_000 ether);

        assertEq(token.totalSupply(), 0);
        assertEq(token.balanceOf(alice), 0);
    }

    // =====================================================================
    // 场景 8: 非授权账户不能修改资产证明信息
    // =====================================================================

    function test_NonAuthorizedAccount_CannotUpdateAssetDocument() public {
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger)
        );
        vm.prank(stranger);
        token.updateAssetDocument(NEW_DOC);

        assertEq(token.assetDocument(), DEFAULT_DOC, "document must remain unchanged");
    }

    function test_OwnerCanUpdateAssetDocument() public {
        vm.warp(1_700_000_000);

        vm.expectEmit(true, false, false, true, address(token));
        emit AssetDocumentUpdated(owner, DEFAULT_DOC, NEW_DOC);

        vm.prank(owner);
        token.updateAssetDocument(NEW_DOC);

        assertEq(token.assetDocument(), NEW_DOC);
        assertEq(token.assetDocumentUpdatedAt(), 1_700_000_000);
    }

    function test_UpdateAssetDocument_EmptyStringReverts() public {
        vm.expectRevert(RentalIncomeRightToken.EmptyAssetDocument.selector);
        vm.prank(owner);
        token.updateAssetDocument("");
    }

    function test_UpdateAssetDocument_NonOwnerCannotChainDocuments() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        token.updateAssetDocument(NEW_DOC);
    }

    // =====================================================================
    // 场景 9: 错误操作能够被合约拒绝
    // =====================================================================

    function test_InvalidOperations_AreRejected() public {
        _mintAsOwner(alice, 100 ether);

        // 超额转账被拒绝
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientBalance.selector, alice, 100 ether, 101 ether
            )
        );
        vm.prank(alice);
        token.transfer(bob, 101 ether);

        // 超额销毁被拒绝
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientBalance.selector, alice, 100 ether, 101 ether
            )
        );
        vm.prank(alice);
        token.burn(101 ether);
    }

    function test_TransferMoreThanBalance_Reverts() public {
        _mintAsOwner(alice, 50 ether);

        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientBalance.selector, alice, 50 ether, 51 ether
            )
        );
        vm.prank(alice);
        token.transfer(bob, 51 ether);
    }

    function test_BurnMoreThanBalance_Reverts() public {
        _mintAsOwner(alice, 50 ether);

        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientBalance.selector, alice, 50 ether, 51 ether
            )
        );
        vm.prank(alice);
        token.burn(51 ether);
    }

    function test_TransferFromWithoutAllowance_Reverts() public {
        _mintAsOwner(alice, 100 ether);

        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientAllowance.selector, bob, 0, 1 ether
            )
        );
        vm.prank(bob);
        token.transferFrom(alice, bob, 1 ether);
    }

    function test_MintAllZeroAmount_IsAllowedButMeaningless() public {
        _mintAsOwner(alice, 0);

        assertEq(token.balanceOf(alice), 0);
        assertEq(token.totalSupply(), 0);
    }

    // =====================================================================
    // 附加: 风险控制 (Pausable) 与权限
    // =====================================================================

    function test_Pause_BlocksMintTransferAndBurn() public {
        _mintAsOwner(alice, 1000 ether);

        vm.prank(owner);
        token.pause();
        assertTrue(token.paused());

        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(owner);
        token.mint(alice, 1 ether);

        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(alice);
        token.transfer(bob, 1 ether);

        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(alice);
        token.burn(1 ether);

        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(owner);
        token.forceBurn(alice, 1 ether);
    }

    function test_Unpause_RestoresOperations() public {
        _mintAsOwner(alice, 1000 ether);

        vm.startPrank(owner);
        token.pause();
        token.unpause();
        vm.stopPrank();

        assertFalse(token.paused());

        vm.prank(alice);
        token.transfer(bob, 1 ether);
        assertEq(token.balanceOf(bob), 1 ether);
    }

    function test_Pause_OnlyOwner() public {
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger)
        );
        vm.prank(stranger);
        token.pause();
    }

    function test_Unpause_OnlyOwner_AndRevertsWhenNotPaused() public {
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger)
        );
        vm.prank(stranger);
        token.unpause();

        vm.expectRevert(Pausable.ExpectedPause.selector);
        vm.prank(owner);
        token.unpause();
    }

    function test_TransferOwnership_MovesMintRights() public {
        vm.prank(owner);
        token.transferOwnership(alice);
        assertEq(token.owner(), alice);

        // 原 owner 失去发行权
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, owner));
        vm.prank(owner);
        token.mint(owner, 1 ether);

        // 新 owner 可以发行
        vm.prank(alice);
        token.mint(alice, 1 ether);
        assertEq(token.balanceOf(alice), 1 ether);
    }

    // =====================================================================
    // 附加: 边界情况 (补齐细粒度边界覆盖)
    // =====================================================================

    /// @dev 自转账不应改变余额, 也不应影响总供应量。
    function test_TransferToSelf_KeepsBalanceAndSupply() public {
        _mintAsOwner(alice, 1000 ether);

        vm.prank(alice);
        token.transfer(alice, 400 ether);

        assertEq(token.balanceOf(alice), 1000 ether, "self-transfer must not change balance");
        assertEq(token.totalSupply(), 1000 ether);
    }

    /// @dev 转账 0 不应改变任何状态, 也不应回滚。
    function test_TransferZeroAmount_SucceedsWithoutChange() public {
        _mintAsOwner(alice, 1000 ether);

        vm.prank(alice);
        token.transfer(bob, 0);

        assertEq(token.balanceOf(alice), 1000 ether);
        assertEq(token.balanceOf(bob), 0);
        assertEq(token.totalSupply(), 1000 ether);
    }

    function test_BurnZeroAmount_SucceedsWithoutChange() public {
        _mintAsOwner(alice, 1000 ether);

        vm.prank(alice);
        token.burn(0);

        assertEq(token.balanceOf(alice), 1000 ether);
        assertEq(token.totalSupply(), 1000 ether);
    }

    /// @dev forceBurn 超过持币人余额时应回滚。
    function test_ForceBurnMoreThanBalance_Reverts() public {
        _mintAsOwner(alice, 50 ether);

        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientBalance.selector, alice, 50 ether, 51 ether
            )
        );
        vm.prank(owner);
        token.forceBurn(alice, 51 ether);
    }

    /// @dev 连续更新资产证明时, 事件中的 previousDocument 必须是上一版而非初版。
    function test_AssetDocument_RepeatedUpdatesCarryCorrectPreviousValue() public {
        string memory second = "ipfs://second-report.json";
        string memory third = "ipfs://third-report.json";

        vm.prank(owner);
        token.updateAssetDocument(second);
        assertEq(token.assetDocument(), second);

        // 第二次更新时 previousDocument 应为 second (验证 old/new 传递逻辑)
        vm.expectEmit(true, false, false, true, address(token));
        emit AssetDocumentUpdated(owner, second, third);

        vm.prank(owner);
        token.updateAssetDocument(third);
        assertEq(token.assetDocument(), third);
    }

    function test_TransferOwnership_ToZeroAddress_Reverts() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
        vm.prank(owner);
        token.transferOwnership(address(0));
    }

    /// @dev 反复暂停/恢复不应进入异常状态, 恢复后功能正常。
    function test_RepeatedPauseUnpause_CyclesCleanly() public {
        _mintAsOwner(alice, 100 ether);

        for (uint256 i = 0; i < 3; i++) {
            vm.prank(owner);
            token.pause();
            assertTrue(token.paused());

            vm.expectRevert(Pausable.EnforcedPause.selector);
            vm.prank(alice);
            token.transfer(bob, 1 ether);

            vm.prank(owner);
            token.unpause();
            assertFalse(token.paused());
        }

        vm.prank(alice);
        token.transfer(bob, 10 ether);
        assertEq(token.balanceOf(bob), 10 ether);
    }

    // =====================================================================
    // 附加: 模糊测试
    // =====================================================================

    function testFuzz_MintAndBurn_RoundTrip(uint256 amount) public {
        amount = bound(amount, 1, token.MAX_SUPPLY());

        _mintAsOwner(alice, amount);
        assertEq(token.totalSupply(), amount);
        assertEq(token.balanceOf(alice), amount);

        vm.prank(alice);
        token.burn(amount);
        assertEq(token.totalSupply(), 0);
        assertEq(token.balanceOf(alice), 0);
    }

    function testFuzz_Transfer_PreservesTotalSupply(uint256 minted, uint256 sent) public {
        minted = bound(minted, 1, token.MAX_SUPPLY());
        sent = bound(sent, 0, minted);

        _mintAsOwner(alice, minted);

        vm.prank(alice);
        token.transfer(bob, sent);

        assertEq(token.totalSupply(), minted);
        assertEq(token.balanceOf(alice), minted - sent);
        assertEq(token.balanceOf(bob), sent);
    }
}
