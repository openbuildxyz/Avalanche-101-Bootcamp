// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { Test } from "forge-std/Test.sol";

import { AvalancheBootcampToken } from "../src/AvalancheBootcampToken.sol";
import { MockPangolinFactory, MockPangolinPair, MockPangolinRouter } from "./MockPangolin.sol";

contract AvalancheBootcampTokenTest is Test {
    AvalancheBootcampToken internal token;
    MockPangolinFactory internal factory;
    MockPangolinPair internal pair;
    MockPangolinRouter internal router;
    address internal wavax = address(uint160(uint256(keccak256("WAVAX"))));

    address internal owner = address(0xA11CE);
    address internal buyer = address(0xB0B);

    function setUp() public {
        factory = new MockPangolinFactory();
        pair = new MockPangolinPair();
        router = new MockPangolinRouter(address(factory), wavax);

        vm.prank(owner);
        token = new AvalancheBootcampToken(owner, address(router));

        address t0 = address(token) < wavax ? address(token) : wavax;
        address t1 = address(token) < wavax ? wavax : address(token);
        uint112 rToken = 20_000 ether;
        uint112 rWavax = 0.05 ether;
        if (t0 == address(token)) {
            pair.set(t0, t1, rToken, rWavax);
        } else {
            pair.set(t0, t1, rWavax, rToken);
        }
        factory.setPair(address(token), wavax, address(pair));

        vm.deal(buyer, 1 ether);
        vm.deal(address(token), 1 ether);
    }

    function test_initialSupplyToOwner() public view {
        assertEq(token.balanceOf(owner), 1_000_000 ether);
    }

    function test_spotPriceFromReserves() public view {
        assertEq(token.getTokenPriceInAVAX(), 0.0000025 ether);
    }

    function test_routerQuoteMatchesAmmFormula() public view {
        uint256 avaxIn = 0.01 ether;
        uint256 expected = (20_000 ether * avaxIn * 997) / (0.05 ether * 1000 + avaxIn * 997);
        assertEq(token.getTokenAmountForAVAX(avaxIn), expected);
    }

    function test_buyUsesDexQuoteNotHardcodedPrice() public {
        uint256 avaxIn = 0.005 ether;
        uint256 expected = token.getTokenAmountForAVAX(avaxIn);

        vm.prank(buyer);
        uint256 minted = token.buyTokensWithAVAX{ value: avaxIn }();

        assertEq(minted, expected);
        assertEq(token.balanceOf(buyer), expected);
        assertGt(minted, 0);
    }

    function test_sellUsesDexQuote() public {
        vm.prank(buyer);
        uint256 minted = token.buyTokensWithAVAX{ value: 0.005 ether }();

        uint256 expectedRefund = token.getAVAXAmountForToken(minted / 2);
        uint256 balBefore = buyer.balance;

        vm.prank(buyer);
        uint256 refund = token.sellTokensForAVAX(minted / 2);

        assertEq(refund, expectedRefund);
        assertEq(buyer.balance, balBefore + refund);
    }

    function test_onlyOwnerCanMint() public {
        vm.prank(buyer);
        vm.expectRevert();
        token.mint(buyer, 1 ether);
    }
}
