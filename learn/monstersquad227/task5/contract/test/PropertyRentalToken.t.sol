// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {PropertyRentalToken} from "../src/PropertyRentalToken.sol";

/// @title Task 5 测试 — PropertyRentalToken (PRRT) RWA Token
/// @notice 覆盖作业要求的所有测试场景
contract PropertyRentalTokenTest is Test {
    PropertyRentalToken public prrt;

    address public admin;
    address public minter;
    address public investor1;
    address public investor2;
    address public stranger;

    string constant INITIAL_DOC =
        "ipfs://QmAssetProof/CommercialOfficeBuilding/LeaseAgreement/2024";
    string constant UPDATED_DOC =
        "ipfs://QmAssetProof/CommercialOfficeBuilding/RenewedLease/2025";

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;

    /// @dev 部署前设置测试账户
    function setUp() public {
        admin = makeAddr("admin");
        minter = makeAddr("minter");
        investor1 = makeAddr("investor1");
        investor2 = makeAddr("investor2");
        stranger = makeAddr("stranger");

        vm.startPrank(admin);
        prrt = new PropertyRentalToken(admin, minter, INITIAL_DOC);
        vm.stopPrank();
    }

    // ================================================================
    // 测试 1：合约部署成功 & 初始 Token 信息正确
    // ================================================================

    function test_Deployment_Success() public view {
        // Token 基本信息
        assertEq(prrt.name(), "Property Rental Rights Token");
        assertEq(prrt.symbol(), "PRRT");
        assertEq(prrt.decimals(), 18);
        assertEq(prrt.totalSupply(), 0);
    }

    function test_InitialRoles() public view {
        // admin 拥有 DEFAULT_ADMIN_ROLE
        assertTrue(prrt.hasRole(DEFAULT_ADMIN_ROLE, admin));
        assertTrue(prrt.isAdmin(admin));

        // minter 拥有 MINTER_ROLE
        assertTrue(prrt.hasRole(MINTER_ROLE, minter));
        assertTrue(prrt.isMinter(minter));

        // admin 不自动拥有 MINTER_ROLE（除非构造函数中授予）
        // 这里 admin != minter，所以 admin 不应有 MINTER_ROLE
        assertFalse(prrt.hasRole(MINTER_ROLE, admin));
    }

    function test_InitialAssetDocument() public view {
        assertEq(prrt.assetDocument(), INITIAL_DOC);
    }

    // ================================================================
    // 测试 2：授权账户可以发行 Token
    // ================================================================

    function test_Mint_ByMinter() public {
        uint256 amount = 1000 * 1e18;

        vm.prank(minter);
        prrt.mint(investor1, amount);

        assertEq(prrt.totalSupply(), amount);
        assertEq(prrt.balanceOf(investor1), amount);
    }

    function test_Mint_MultipleRecipients() public {
        uint256 amount1 = 500 * 1e18;
        uint256 amount2 = 300 * 1e18;

        vm.startPrank(minter);
        prrt.mint(investor1, amount1);
        prrt.mint(investor2, amount2);
        vm.stopPrank();

        assertEq(prrt.totalSupply(), amount1 + amount2);
        assertEq(prrt.balanceOf(investor1), amount1);
        assertEq(prrt.balanceOf(investor2), amount2);
    }

    // ================================================================
    // 测试 3：非授权账户不能发行 Token
    // ================================================================

    function test_Revert_Mint_ByStranger() public {
        uint256 amount = 100 * 1e18;

        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSignature(
                "AccessControlUnauthorizedAccount(address,bytes32)",
                stranger,
                MINTER_ROLE
            )
        );
        prrt.mint(investor1, amount);
    }

    function test_Revert_Mint_ByInvestor() public {
        uint256 amount = 100 * 1e18;

        vm.prank(investor1);
        vm.expectRevert();
        prrt.mint(investor2, amount);
    }

    // ================================================================
    // 测试 4：持有人可以转账
    // ================================================================

    function test_Transfer_BetweenHolders() public {
        uint256 mintAmount = 1000 * 1e18;
        uint256 transferAmount = 300 * 1e18;

        // minter 发行给 investor1
        vm.prank(minter);
        prrt.mint(investor1, mintAmount);

        // investor1 转账给 investor2
        vm.prank(investor1);
        prrt.transfer(investor2, transferAmount);

        assertEq(prrt.balanceOf(investor1), mintAmount - transferAmount);
        assertEq(prrt.balanceOf(investor2), transferAmount);
        assertEq(prrt.totalSupply(), mintAmount); // 总量不变
    }

    function test_Revert_Transfer_InsufficientBalance() public {
        uint256 mintAmount = 100 * 1e18;

        vm.prank(minter);
        prrt.mint(investor1, mintAmount);

        vm.prank(investor1);
        vm.expectRevert();
        prrt.transfer(investor2, mintAmount + 1);
    }

    // ================================================================
    // 测试 5：Token 可以被销毁
    // ================================================================

    function test_Burn_ByHolder() public {
        uint256 mintAmount = 1000 * 1e18;
        uint256 burnAmount = 200 * 1e18;

        vm.prank(minter);
        prrt.mint(investor1, mintAmount);

        vm.prank(investor1);
        prrt.burn(burnAmount);

        assertEq(prrt.balanceOf(investor1), mintAmount - burnAmount);
        assertEq(prrt.totalSupply(), mintAmount - burnAmount);
    }

    function test_Burn_EntireBalance() public {
        uint256 amount = 500 * 1e18;

        vm.prank(minter);
        prrt.mint(investor1, amount);

        vm.prank(investor1);
        prrt.burn(amount);

        assertEq(prrt.balanceOf(investor1), 0);
        assertEq(prrt.totalSupply(), 0);
    }

    function test_Revert_Burn_ExceedsBalance() public {
        uint256 mintAmount = 100 * 1e18;

        vm.prank(minter);
        prrt.mint(investor1, mintAmount);

        vm.prank(investor1);
        vm.expectRevert();
        prrt.burn(mintAmount + 1);
    }

    // ================================================================
    // 测试 6：总供应量和账户余额变化正确
    // ================================================================

    function test_TotalSupply_TracksMintAndBurn() public {
        vm.prank(minter);
        prrt.mint(investor1, 1000 * 1e18);
        assertEq(prrt.totalSupply(), 1000 * 1e18);

        vm.prank(minter);
        prrt.mint(investor2, 500 * 1e18);
        assertEq(prrt.totalSupply(), 1500 * 1e18);

        vm.prank(investor1);
        prrt.burn(300 * 1e18);
        assertEq(prrt.totalSupply(), 1200 * 1e18);
    }

    function test_Balance_TracksTransfers() public {
        vm.prank(minter);
        prrt.mint(investor1, 1000 * 1e18);

        vm.prank(investor1);
        prrt.transfer(investor2, 400 * 1e18);

        assertEq(prrt.balanceOf(investor1), 600 * 1e18);
        assertEq(prrt.balanceOf(investor2), 400 * 1e18);
    }

    // ================================================================
    // 测试 7：非授权账户不能修改资产证明信息
    // ================================================================

    function test_UpdateAssetDocument_ByAdmin() public {
        vm.prank(admin);
        prrt.updateAssetDocument(UPDATED_DOC);

        assertEq(prrt.assetDocument(), UPDATED_DOC);
    }

    function test_Revert_UpdateAssetDocument_ByStranger() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSignature(
                "AccessControlUnauthorizedAccount(address,bytes32)",
                stranger,
                DEFAULT_ADMIN_ROLE
            )
        );
        prrt.updateAssetDocument(UPDATED_DOC);
    }

    function test_Revert_UpdateAssetDocument_ByInvestor() public {
        vm.prank(investor1);
        vm.expectRevert();
        prrt.updateAssetDocument(UPDATED_DOC);
    }

    // ================================================================
    // 测试 8：错误操作能够被合约拒绝
    // ================================================================

    function test_Revert_Mint_ToZeroAddress() public {
        vm.prank(minter);
        vm.expectRevert("PRRT: mint to zero address");
        prrt.mint(address(0), 100 * 1e18);
    }

    function test_Revert_Mint_ZeroAmount() public {
        vm.prank(minter);
        vm.expectRevert("PRRT: mint zero amount");
        prrt.mint(investor1, 0);
    }

    function test_Revert_Burn_ZeroAmount() public {
        vm.prank(investor1);
        vm.expectRevert("PRRT: burn zero amount");
        prrt.burn(0);
    }

    // ================================================================
    // 测试 9：事件验证
    // ================================================================

    function test_Event_TokensMinted() public {
        uint256 amount = 500 * 1e18;

        vm.prank(minter);
        vm.expectEmit(true, true, false, true);
        emit TokensMinted(investor1, amount);
        prrt.mint(investor1, amount);
    }

    function test_Event_TokensBurned() public {
        uint256 mintAmount = 500 * 1e18;
        uint256 burnAmount = 200 * 1e18;

        vm.prank(minter);
        prrt.mint(investor1, mintAmount);

        vm.prank(investor1);
        vm.expectEmit(true, true, false, true);
        emit TokensBurned(investor1, burnAmount);
        prrt.burn(burnAmount);
    }

    function test_Event_AssetDocumentUpdated() public {
        vm.prank(admin);
        vm.expectEmit(true, false, false, true);
        emit AssetDocumentUpdated(admin, INITIAL_DOC, UPDATED_DOC);
        prrt.updateAssetDocument(UPDATED_DOC);
    }

    // ================================================================
    // 测试 10：角色管理（admin 可以授予/撤销 minter 角色）
    // ================================================================

    function test_AdminCanGrantMinterRole() public {
        address newMinter = makeAddr("newMinter");
        assertFalse(prrt.isMinter(newMinter));

        vm.prank(admin);
        prrt.grantRole(MINTER_ROLE, newMinter);

        assertTrue(prrt.isMinter(newMinter));
    }

    function test_NewMinterCanMint() public {
        address newMinter = makeAddr("newMinter");

        vm.prank(admin);
        prrt.grantRole(MINTER_ROLE, newMinter);

        vm.prank(newMinter);
        prrt.mint(investor1, 100 * 1e18);

        assertEq(prrt.balanceOf(investor1), 100 * 1e18);
    }

    // ================================================================
    // 辅助：重新声明事件以进行 expectEmit 匹配
    // ================================================================

    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);
    event AssetDocumentUpdated(
        address indexed updater,
        string oldDocument,
        string newDocument
    );
}