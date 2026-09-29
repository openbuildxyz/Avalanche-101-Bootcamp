// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {TestBase} from "./TestBase.sol";
import {BaseAsset, MockUSDC} from "../contracts/TestAssets.sol";
import {MiniExchange} from "../contracts/MiniExchange.sol";

contract MiniExchangeTest is TestBase {
    BaseAsset base; MockUSDC usd; MiniExchange dex;
    uint256 buyerKey = 0xA11CE; uint256 sellerKey = 0xB0B;
    address buyer; address seller;
    function setUp() public {
        buyer = vm.addr(buyerKey); seller = vm.addr(sellerKey);
        base = new BaseAsset(address(this)); usd = new MockUSDC(address(this));
        dex = new MiniExchange(address(base), address(usd), 1000, 10_000e6);
        base.mint(seller, 100); usd.mint(buyer, 1000e6);
        vm.startPrank(seller); base.approve(address(dex), 100); dex.deposit(address(base), 100); vm.stopPrank();
        vm.startPrank(buyer); usd.approve(address(dex), 1000e6); dex.deposit(address(usd), 1000e6); vm.stopPrank();
    }
    function orders() internal view returns (MiniExchange.Order memory b, MiniExchange.Order memory s) {
        b = MiniExchange.Order(buyer, true, 11e6, 10, 1, block.timestamp + 100);
        s = MiniExchange.Order(seller, false, 10e6, 10, 2, block.timestamp + 100);
    }
    function sig(MiniExchange.Order memory o, uint256 key) internal returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, dex.hashOrder(o));
        return abi.encodePacked(r, s, v);
    }
    function testDepositAndWithdraw() public {
        eq(dex.balances(buyer, address(usd)), 1000e6);
        vm.prank(buyer); dex.withdraw(address(usd), 100e6);
        eq(usd.balanceOf(buyer), 100e6); eq(dex.totalDeposited(address(usd)), 900e6);
    }
    function testNoWithdrawOfOtherUsersFunds() public { vm.prank(alice); vm.expectRevert(); dex.withdraw(address(usd), 1); }
    function testHardCapEnforced() public {
        base.mint(seller, 1000); vm.startPrank(seller); base.approve(address(dex), 1000);
        vm.expectRevert(); dex.deposit(address(base), 901); vm.stopPrank();
    }
    function testZeroDepositRejected() public { vm.expectRevert(); dex.deposit(address(base), 0); }
    function testUnsupportedAssetRejected() public { vm.expectRevert(); dex.deposit(address(0x1234), 1); }
    function testTwoSignedAccountsTradeAndWithdraw() public {
        (MiniExchange.Order memory b, MiniExchange.Order memory s) = orders();
        dex.settle(b, sig(b, buyerKey), s, sig(s, sellerKey), 4, 10e6);
        eq(dex.balances(buyer, address(base)), 4); eq(dex.balances(seller, address(base)), 96);
        eq(dex.balances(buyer, address(usd)), 960e6); eq(dex.balances(seller, address(usd)), 40e6);
        eq(dex.totalDeposited(address(base)), 100); eq(dex.totalDeposited(address(usd)), 1000e6);
        vm.prank(buyer); dex.withdraw(address(base), 4); eq(base.balanceOf(buyer), 4);
    }
    function testForgedSignatureRejected() public {
        (MiniExchange.Order memory b, MiniExchange.Order memory s) = orders();
        bytes memory bs = sig(b, sellerKey); bytes memory ss = sig(s, sellerKey);
        vm.expectRevert(); dex.settle(b, bs, s, ss, 1, 10e6);
    }
    function testFilledOrderCannotReplay() public {
        (MiniExchange.Order memory b, MiniExchange.Order memory s) = orders();
        bytes memory bs = sig(b, buyerKey); bytes memory ss = sig(s, sellerKey);
        dex.settle(b, bs, s, ss, 10, 10e6);
        vm.expectRevert(); dex.settle(b, bs, s, ss, 1, 10e6);
    }
    function testSelfTradeRejectedOnChain() public {
        (MiniExchange.Order memory b, MiniExchange.Order memory s) = orders(); s.trader = buyer;
        bytes memory bs = sig(b, buyerKey); bytes memory ss = sig(s, buyerKey);
        vm.expectRevert(); dex.settle(b, bs, s, ss, 1, 10e6);
    }
    function testCancelledOrderRejected() public {
        (MiniExchange.Order memory b, MiniExchange.Order memory s) = orders();
        bytes memory bs = sig(b, buyerKey); bytes memory ss = sig(s, sellerKey);
        vm.prank(buyer); dex.cancel(b.nonce);
        vm.expectRevert(); dex.settle(b, bs, s, ss, 1, 10e6);
    }
    function testExpiredOrderRejected() public {
        (MiniExchange.Order memory b, MiniExchange.Order memory s) = orders();
        bytes memory bs = sig(b, buyerKey); bytes memory ss = sig(s, sellerKey);
        vm.warp(b.deadline + 1); vm.expectRevert(); dex.settle(b, bs, s, ss, 1, 10e6);
    }
    function testOutsideLimitPriceRejected() public {
        (MiniExchange.Order memory b, MiniExchange.Order memory s) = orders();
        bytes memory bs = sig(b, buyerKey); bytes memory ss = sig(s, sellerKey);
        vm.expectRevert(); dex.settle(b, bs, s, ss, 1, 12e6);
    }
    function testWithdrawBeforeSettlementRejectsTrade() public {
        (MiniExchange.Order memory b, MiniExchange.Order memory s) = orders();
        bytes memory bs = sig(b, buyerKey); bytes memory ss = sig(s, sellerKey);
        vm.prank(buyer); dex.withdraw(address(usd), 1000e6);
        vm.expectRevert(); dex.settle(b, bs, s, ss, 1, 10e6);
        eq(dex.filled(dex.hashOrder(b)), 0);
    }
    function testCrossContractReplayRejected() public {
        (MiniExchange.Order memory b, MiniExchange.Order memory s) = orders();
        bytes memory bs = sig(b, buyerKey); bytes memory ss = sig(s, sellerKey);
        MiniExchange other = new MiniExchange(address(base), address(usd), 1000, 10_000e6);
        vm.expectRevert(bytes("invalid signature")); other.settle(b, bs, s, ss, 1, 10e6);
    }
}
