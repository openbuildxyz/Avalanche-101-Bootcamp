// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";

import {HahnDexSale} from "../src/HahnDexSale.sol";

contract MockSaleToken {
    mapping(address => uint256) public balanceOf;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract MockSaleReader {
    address public immutable HAHN;
    uint256 public immutable hahnPerAvax;

    constructor(address token, uint256 rate) {
        HAHN = token;
        hahnPerAvax = rate;
    }

    function quoteHAHNForAVAX(uint256 avaxIn) external view returns (uint256) {
        return avaxIn * hahnPerAvax / 1 ether;
    }
}

contract HahnDexSaleTest is Test {
    MockSaleToken private token;
    HahnDexSale private sale;
    address private buyer = makeAddr("buyer");

    function setUp() external {
        token = new MockSaleToken();
        MockSaleReader reader = new MockSaleReader(address(token), 100_000 ether);
        sale = new HahnDexSale(address(reader));
        token.mint(address(sale), 10_000 ether);
        vm.deal(buyer, 1 ether);
    }

    function testBuysUsingReaderQuote() external {
        vm.prank(buyer);
        uint256 received = sale.buyWithAVAX{value: 0.01 ether}(990 ether);

        assertEq(received, 1_000 ether);
        assertEq(token.balanceOf(buyer), 1_000 ether);
        assertEq(address(sale).balance, 0.01 ether);
    }

    function testRejectsSlippage() external {
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(HahnDexSale.HahnDexSale__Slippage.selector, 1_000 ether, 1_001 ether));
        sale.buyWithAVAX{value: 0.01 ether}(1_001 ether);
    }

    function testOnlyOwnerWithdraws() external {
        vm.prank(buyer);
        sale.buyWithAVAX{value: 0.01 ether}(0);

        vm.prank(buyer);
        vm.expectRevert(HahnDexSale.HahnDexSale__NotOwner.selector);
        sale.withdrawProceeds(payable(buyer));

        uint256 ownerBalanceBefore = address(this).balance;
        sale.withdrawProceeds(payable(address(this)));
        assertEq(address(this).balance, ownerBalanceBefore + 0.01 ether);
    }

    receive() external payable {}
}
