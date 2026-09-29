// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {TestBase} from "./TestBase.sol";
import {BootcampToken} from "../contracts/BootcampToken.sol";
import {MockUSDC} from "../contracts/TestAssets.sol";
import {LearningPair} from "../contracts/LearningPair.sol";

contract TokenAndDexTest is TestBase {
    BootcampToken token;
    MockUSDC usd;
    LearningPair pair;
    function setUp() public {
        token = new BootcampToken(address(this));
        usd = new MockUSDC(address(this));
        pair = new LearningPair(address(token), address(usd));
        token.setDexPair(address(pair));
        usd.mint(address(this), 100_000e6);
        token.approve(address(pair), type(uint256).max);
        usd.approve(address(pair), type(uint256).max);
        pair.addLiquidity(100_000 ether, 10_000e6, 1, block.timestamp);
        usd.mint(alice, 1000e6);
        vm.prank(alice); usd.approve(address(token), type(uint256).max);
    }
    function testTokenMetadataAndSupply() public view {
        eq(token.name(), "Dajiangjun Bootcamp Token"); eq(token.symbol(), "DJJ");
        eq(token.decimals(), 18); eq(token.totalSupply(), 1_000_000 ether);
    }
    function testTransferAndAllowance() public {
        token.approve(alice, 10 ether);
        vm.prank(alice); token.transferFrom(address(this), bob, 10 ether);
        eq(token.balanceOf(bob), 10 ether); eq(token.allowance(address(this), alice), 0);
    }
    function testOnlyOwnerConfiguresPair() public {
        BootcampToken fresh = new BootcampToken(address(this));
        vm.prank(alice); vm.expectRevert(); fresh.setDexPair(address(pair));
    }
    function testPairCannotBeReplaced() public { vm.expectRevert(); token.setDexPair(address(pair)); }
    function testWrongPairRejected() public {
        BootcampToken fresh = new BootcampToken(address(this));
        vm.expectRevert(); fresh.setDexPair(address(pair));
    }
    function testDecimalsAndQuoteFromRealReserves() public view {
        uint256 expected = uint256(100e6) * 997 * 100_000 ether / (10_000e6 * 1000 + 100e6 * 997);
        eq(token.quotePurchase(100e6), expected);
        require(expected > 987 ether && expected < 988 ether, "decimals wrong");
    }
    function testPurchaseUsesQuoteAndChangesPrice() public {
        uint256 beforeQuote = token.quotePurchase(100e6);
        uint256 kBefore = uint256(pair.reserve0()) * pair.reserve1();
        vm.prank(alice); token.buyWithQuote(100e6, beforeQuote, block.timestamp);
        eq(token.balanceOf(alice), beforeQuote); eq(usd.balanceOf(alice), 900e6);
        eq(usd.balanceOf(address(token)), 0); eq(token.totalSupply(), 1_000_000 ether);
        require(token.quotePurchase(100e6) < beforeQuote, "price did not move");
        require(uint256(pair.reserve0()) * pair.reserve1() >= kBefore, "k decreased");
    }
    function testSlippageRevertsAtomically() public {
        uint256 amount = token.quotePurchase(100e6);
        vm.prank(alice); vm.expectRevert(); token.buyWithQuote(100e6, amount + 1, block.timestamp);
        eq(usd.balanceOf(alice), 1000e6); eq(token.balanceOf(alice), 0);
    }
    function testExpiredPurchaseRejected() public {
        vm.warp(100); vm.prank(alice); vm.expectRevert(); token.buyWithQuote(100e6, 1, 99);
    }
    function testEmptyPoolRejected() public {
        LearningPair empty = new LearningPair(address(token), address(usd));
        vm.expectRevert(); empty.getAmountOut(address(usd), 1e6);
    }
    function testReverseTokenOrdering() public {
        LearningPair reverse = new LearningPair(address(usd), address(token));
        token.approve(address(reverse), type(uint256).max); usd.approve(address(reverse), type(uint256).max);
        reverse.addLiquidity(10_000e6, 100_000 ether, 1, block.timestamp);
        eq(reverse.getAmountOut(address(usd), 100e6), token.quotePurchase(100e6));
    }
    function testRemoveLiquidity() public {
        uint256 shares = pair.balanceOf(address(this));
        uint256 beforeBalance = token.balanceOf(address(this));
        (uint256 a,) = pair.removeLiquidity(shares, 1, 1, block.timestamp);
        eq(token.balanceOf(address(this)), beforeBalance + a);
        eq(pair.totalSupply(), 1000);
    }
    function testFuzzPurchasePreservesConstantProduct(uint64 rawAmount) public {
        uint256 amount = uint256(rawAmount) % 999e6 + 1e6;
        uint256 k = uint256(pair.reserve0()) * pair.reserve1();
        vm.prank(alice); token.buyWithQuote(amount, 1, block.timestamp);
        require(uint256(pair.reserve0()) * pair.reserve1() >= k, "k decreased");
    }
}
