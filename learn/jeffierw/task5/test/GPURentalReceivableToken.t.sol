// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

import {GPURentalReceivableToken} from "../src/GPURentalReceivableToken.sol";

contract GPURentalReceivableTokenTest is Test {
    string internal constant INITIAL_DOCUMENT = "urn:grrt:GPU-LEASE-2026-09:v1";
    string internal constant UPDATED_DOCUMENT = "sha256:asset-report-v2";

    address internal admin = makeAddr("admin");
    address internal holder = makeAddr("holder");
    address internal recipient = makeAddr("recipient");
    address internal outsider = makeAddr("outsider");

    GPURentalReceivableToken internal token;

    event ReceivableIssued(address indexed operator, address indexed recipient, uint256 amount);
    event ReceivableBurned(address indexed account, uint256 amount);
    event AssetDocumentUpdated(address indexed operator, string previousDocument, string newDocument);

    function setUp() public {
        token = new GPURentalReceivableToken(admin, INITIAL_DOCUMENT);
    }

    function testDeploymentAndInitialTokenInformation() public view {
        assertEq(token.name(), "GPU Rental Receivable Token");
        assertEq(token.symbol(), "GRRT");
        assertEq(token.decimals(), 6);
        assertEq(token.totalSupply(), 0);
        assertEq(token.assetDocument(), INITIAL_DOCUMENT);
        assertTrue(token.hasRole(token.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(token.hasRole(token.MINTER_ROLE(), admin));
        assertTrue(token.hasRole(token.DOCUMENT_ROLE(), admin));
    }

    function testAuthorizedAccountCanMint() public {
        uint256 amount = 10_000e6;

        vm.expectEmit(true, true, false, true);
        emit ReceivableIssued(admin, holder, amount);
        vm.prank(admin);
        token.mint(holder, amount);

        assertEq(token.balanceOf(holder), amount);
        assertEq(token.totalSupply(), amount);
    }

    function testUnauthorizedAccountCannotMint() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, outsider, token.MINTER_ROLE()
            )
        );
        vm.prank(outsider);
        token.mint(holder, 1e6);
    }

    function testHolderCanTransfer() public {
        vm.prank(admin);
        token.mint(holder, 2_000e6);

        vm.prank(holder);
        token.transfer(recipient, 750e6);

        assertEq(token.balanceOf(holder), 1_250e6);
        assertEq(token.balanceOf(recipient), 750e6);
        assertEq(token.totalSupply(), 2_000e6);
    }

    function testHolderCanBurnAndSupplyChanges() public {
        vm.prank(admin);
        token.mint(holder, 2_000e6);

        vm.expectEmit(true, false, false, true);
        emit ReceivableBurned(holder, 500e6);
        vm.prank(holder);
        token.burn(500e6);

        assertEq(token.balanceOf(holder), 1_500e6);
        assertEq(token.totalSupply(), 1_500e6);
    }

    function testAuthorizedAccountCanUpdateAssetDocument() public {
        vm.expectEmit(true, false, false, true);
        emit AssetDocumentUpdated(admin, INITIAL_DOCUMENT, UPDATED_DOCUMENT);
        vm.prank(admin);
        token.updateAssetDocument(UPDATED_DOCUMENT);

        assertEq(token.assetDocument(), UPDATED_DOCUMENT);
    }

    function testUnauthorizedAccountCannotUpdateAssetDocument() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, outsider, token.DOCUMENT_ROLE()
            )
        );
        vm.prank(outsider);
        token.updateAssetDocument(UPDATED_DOCUMENT);
    }

    function testZeroMintIsRejected() public {
        vm.expectRevert(GPURentalReceivableToken.ZeroAmount.selector);
        vm.prank(admin);
        token.mint(holder, 0);
    }

    function testEmptyAssetDocumentIsRejected() public {
        vm.expectRevert(GPURentalReceivableToken.EmptyAssetDocument.selector);
        vm.prank(admin);
        token.updateAssetDocument("");
    }

    function testBurnAboveBalanceIsRejected() public {
        vm.prank(admin);
        token.mint(holder, 100e6);

        vm.expectRevert();
        vm.prank(holder);
        token.burn(101e6);
    }
}
