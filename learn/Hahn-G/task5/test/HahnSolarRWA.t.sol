// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {HahnSolarRWA} from "../src/HahnSolarRWA.sol";

contract HahnSolarRWATest is Test {
    HahnSolarRWA internal token;
    address internal owner = makeAddr("issuer");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    string internal constant INITIAL_DOCUMENT = "ipfs://bafy-hahn-solar-report-v1";

    function setUp() public {
        token = new HahnSolarRWA(owner, INITIAL_DOCUMENT);
    }

    function testDeploymentAndInitialMetadata() public view {
        assertEq(token.name(), "Hahn Solar Revenue Token");
        assertEq(token.symbol(), "HSRT");
        assertEq(token.decimals(), 18);
        assertEq(token.owner(), owner);
        assertEq(token.totalSupply(), 0);
        assertEq(token.assetDocument(), INITIAL_DOCUMENT);
    }

    function testOwnerCanMintAndSupplyChanges() public {
        vm.prank(owner);
        token.mint(alice, 1_000 ether);
        assertEq(token.balanceOf(alice), 1_000 ether);
        assertEq(token.totalSupply(), 1_000 ether);
    }

    function testNonOwnerCannotMint() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        token.mint(alice, 1 ether);
    }

    function testHolderCanTransfer() public {
        vm.prank(owner);
        token.mint(alice, 100 ether);
        vm.prank(alice);
        assertTrue(token.transfer(bob, 40 ether));
        assertEq(token.balanceOf(alice), 60 ether);
        assertEq(token.balanceOf(bob), 40 ether);
    }

    function testHolderCanBurnAndSupplyDecreases() public {
        vm.prank(owner);
        token.mint(alice, 100 ether);
        vm.prank(alice);
        token.burn(25 ether);
        assertEq(token.balanceOf(alice), 75 ether);
        assertEq(token.totalSupply(), 75 ether);
    }

    function testOwnerCanUpdateDocument() public {
        vm.prank(owner);
        token.updateAssetDocument("ipfs://bafy-hahn-solar-report-v2");
        assertEq(token.assetDocument(), "ipfs://bafy-hahn-solar-report-v2");
    }

    function testNonOwnerCannotUpdateDocument() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        token.updateAssetDocument("ipfs://forged-report");
    }

    function testRejectsInvalidOperations() public {
        vm.startPrank(owner);
        vm.expectRevert(HahnSolarRWA.HahnSolarRWA__ZeroAddress.selector);
        token.mint(address(0), 1 ether);
        vm.expectRevert(HahnSolarRWA.HahnSolarRWA__ZeroAmount.selector);
        token.mint(alice, 0);
        vm.expectRevert(HahnSolarRWA.HahnSolarRWA__EmptyDocument.selector);
        token.updateAssetDocument("");
        vm.stopPrank();

        vm.prank(alice);
        vm.expectRevert(HahnSolarRWA.HahnSolarRWA__ZeroAmount.selector);
        token.burn(0);
    }
}

