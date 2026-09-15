// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";

import {AvalancheBuilderTokenV2} from "../src/AvalancheBuilderTokenV2.sol";
import {MockLFJFactory, MockLFJPair, MockLFJRouter} from "./MockLFJ.sol";

contract AvalancheBuilderTokenV2Test is Test {
    AvalancheBuilderTokenV2 internal token;
    MockLFJPair internal pair;
    address internal owner = makeAddr("owner");
    address internal buyer = makeAddr("buyer");
    address internal wavax = makeAddr("wavax");

    function setUp() public {
        MockLFJFactory factory = new MockLFJFactory();
        pair = new MockLFJPair();
        MockLFJRouter router = new MockLFJRouter(address(factory), wavax, address(pair));
        token = new AvalancheBuilderTokenV2(owner, address(router));

        if (address(token) < wavax) {
            pair.set(address(token), 10_000 ether, 0.02 ether);
        } else {
            pair.set(wavax, 0.02 ether, 10_000 ether);
        }
        factory.setPair(address(pair));

        vm.prank(owner);
        token.transfer(address(token), 100_000 ether);
        vm.deal(buyer, 1 ether);
    }

    function testInitialSupplyBelongsToOwner() public view {
        assertEq(token.totalSupply(), 1_000_000 ether);
        assertEq(token.balanceOf(owner), 900_000 ether);
    }

    function testQuoteComesFromPairReserves() public view {
        uint256 avaxIn = 0.001 ether;
        uint256 expected = avaxIn * 997 * 10_000 ether / (0.02 ether * 1000 + avaxIn * 997);
        assertEq(token.quoteTokensForAVAX(avaxIn), expected);
    }

    function testBuyUsesLiveQuote() public {
        uint256 avaxIn = 0.001 ether;
        uint256 quote = token.quoteTokensForAVAX(avaxIn);

        vm.prank(buyer);
        uint256 received = token.buyWithAVAX{value: avaxIn}(quote);

        assertEq(received, quote);
        assertEq(token.balanceOf(buyer), quote);
        assertEq(address(token).balance, avaxIn);
    }

    function testReserveChangeChangesPurchaseAmount() public {
        uint256 firstQuote = token.quoteTokensForAVAX(0.001 ether);
        if (address(token) < wavax) {
            pair.set(address(token), 5_000 ether, 0.02 ether);
        } else {
            pair.set(wavax, 0.02 ether, 5_000 ether);
        }
        uint256 secondQuote = token.quoteTokensForAVAX(0.001 ether);

        assertLt(secondQuote, firstQuote);
    }

    function testMinimumOutputProtectsBuyer() public {
        uint256 quote = token.quoteTokensForAVAX(0.001 ether);

        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(AvalancheBuilderTokenV2.InsufficientOutput.selector, quote + 1, quote));
        token.buyWithAVAX{value: 0.001 ether}(quote + 1);
    }
}
