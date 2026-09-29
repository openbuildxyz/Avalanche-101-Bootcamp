// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {TestBase} from "./TestBase.sol";
import {CoffeeWarehouseReceipt} from "../task5/contracts/CoffeeWarehouseReceipt.sol";

contract RWATest is TestBase {
    CoffeeWarehouseReceipt token;
    function setUp() public { token = new CoffeeWarehouseReceipt(address(this), 10_000, "urn:bootcamp:coffee:batch-001:v1"); }
    function testDeploymentAndMetadata() public view {
        eq(token.name(), "Coffee Warehouse Receipt"); eq(token.symbol(), "CWR"); eq(token.decimals(), 0);
        eq(token.totalSupply(), 0); eq(token.cap(), 10_000); eq(token.assetDocument(), "urn:bootcamp:coffee:batch-001:v1");
    }
    function testAuthorizedMint() public { token.mint(alice, 100); eq(token.balanceOf(alice), 100); eq(token.totalSupply(), 100); }
    function testUnauthorizedMintRejected() public { vm.prank(alice); vm.expectRevert(); token.mint(alice, 100); }
    function testTransferBurnAndSupply() public {
        token.mint(alice, 100);
        vm.prank(alice); token.transfer(bob, 30);
        vm.prank(bob); token.burn(10);
        eq(token.balanceOf(alice), 70); eq(token.balanceOf(bob), 20); eq(token.totalSupply(), 90);
    }
    function testAuthorizedDocumentUpdate() public { token.updateAssetDocument("urn:bootcamp:coffee:batch-001:v2"); eq(token.assetDocument(), "urn:bootcamp:coffee:batch-001:v2"); }
    function testUnauthorizedDocumentUpdateRejected() public { vm.prank(alice); vm.expectRevert(); token.updateAssetDocument("fake"); }
    function testEmptyDocumentRejected() public { vm.expectRevert(); token.updateAssetDocument(""); }
    function testZeroMintRejected() public { vm.expectRevert(); token.mint(alice, 0); }
    function testMintToZeroRejected() public { vm.expectRevert(); token.mint(address(0), 1); }
    function testCapRejected() public { token.mint(alice, 10_000); vm.expectRevert(); token.mint(alice, 1); }
    function testInsufficientTransferRejected() public { vm.prank(alice); vm.expectRevert(); token.transfer(bob, 1); }
    function testExcessBurnRejected() public { token.mint(alice, 2); vm.prank(alice); vm.expectRevert(); token.burn(3); }
    function testBurnFromRequiresAllowance() public { token.mint(alice, 10); vm.prank(bob); vm.expectRevert(); token.burnFrom(alice, 1); }
    function testBurnFromWithAllowance() public {
        token.mint(alice, 10); vm.prank(alice); token.approve(bob, 3);
        vm.prank(bob); token.burnFrom(alice, 3); eq(token.balanceOf(alice), 7); eq(token.totalSupply(), 7);
    }
    function testRoleRevocation() public {
        bytes32 role = token.MINTER_ROLE(); token.grantRole(role, alice);
        vm.prank(alice); token.mint(bob, 5); token.revokeRole(role, alice);
        vm.prank(alice); vm.expectRevert(); token.mint(bob, 1);
    }
    function testFuzzSupplyAccounting(uint16 rawMint, uint16 rawBurn) public {
        uint256 m = uint256(rawMint) % 10_000 + 1;
        uint256 b = uint256(rawBurn) % m + 1;
        token.mint(alice, m); vm.prank(alice); token.burn(b);
        eq(token.totalSupply(), m - b); eq(token.balanceOf(alice), m - b);
    }
}
