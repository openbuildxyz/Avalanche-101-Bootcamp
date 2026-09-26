// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";

import {HahnDexPriceReader} from "../src/HahnDexPriceReader.sol";

contract MockMetadataToken {
    uint8 public immutable decimals;

    constructor(uint8 decimals_) {
        decimals = decimals_;
    }
}

contract MockPair {
    address public token0;
    address public token1;
    uint112 private reserve0;
    uint112 private reserve1;

    constructor(address tokenA, address tokenB, uint112 reserveA, uint112 reserveB) {
        token0 = tokenA;
        token1 = tokenB;
        reserve0 = reserveA;
        reserve1 = reserveB;
    }

    function getReserves() external view returns (uint112, uint112, uint32) {
        return (reserve0, reserve1, uint32(block.timestamp));
    }
}

contract MockFactory {
    mapping(address => mapping(address => address)) private pairs;

    function setPair(address tokenA, address tokenB, address pair) external {
        pairs[tokenA][tokenB] = pair;
        pairs[tokenB][tokenA] = pair;
    }

    function getPair(address tokenA, address tokenB) external view returns (address) {
        return pairs[tokenA][tokenB];
    }
}

contract MockRouter {
    address public immutable factory;
    address public immutable WAVAX;

    constructor(address factory_, address wavax_) {
        factory = factory_;
        WAVAX = wavax_;
    }

    function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts) {
        MockPair pair = MockPair(MockFactory(factory).getPair(path[0], path[1]));
        require(address(pair) != address(0), "pair missing");

        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();
        (uint256 reserveIn, uint256 reserveOut) =
            pair.token0() == path[0] ? (uint256(reserve0), uint256(reserve1)) : (uint256(reserve1), uint256(reserve0));

        uint256 amountInWithFee = amountIn * 997;
        uint256 amountOut = amountInWithFee * reserveOut / (reserveIn * 1000 + amountInWithFee);

        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = amountOut;
    }
}

contract HahnDexPriceReaderTest is Test {
    address private hahn;
    address private wavax;

    MockFactory private factory;
    MockRouter private router;

    function setUp() external {
        hahn = address(new MockMetadataToken(18));
        wavax = address(new MockMetadataToken(18));
        factory = new MockFactory();
        router = new MockRouter(address(factory), wavax);
    }

    function testReadsReservesAndSpotPriceWhenHahnIsToken0() external {
        MockPair pair = new MockPair(hahn, wavax, uint112(10_000 ether), uint112(0.1 ether));
        factory.setPair(hahn, wavax, address(pair));
        HahnDexPriceReader reader = new HahnDexPriceReader(hahn, address(router));

        (uint256 reserveHAHN, uint256 reserveWAVAX) = reader.getReserves();
        assertEq(reserveHAHN, 10_000 ether);
        assertEq(reserveWAVAX, 0.1 ether);
        assertEq(reader.getSpotPriceInAVAX(), 0.00001 ether);
    }

    function testNormalizesReservesWhenHahnIsToken1() external {
        MockPair pair = new MockPair(wavax, hahn, uint112(0.1 ether), uint112(10_000 ether));
        factory.setPair(hahn, wavax, address(pair));
        HahnDexPriceReader reader = new HahnDexPriceReader(hahn, address(router));

        (uint256 reserveHAHN, uint256 reserveWAVAX) = reader.getReserves();
        assertEq(reserveHAHN, 10_000 ether);
        assertEq(reserveWAVAX, 0.1 ether);
    }

    function testRouterQuotesUseAmmFormula() external {
        MockPair pair = new MockPair(hahn, wavax, uint112(10_000 ether), uint112(0.1 ether));
        factory.setPair(hahn, wavax, address(pair));
        HahnDexPriceReader reader = new HahnDexPriceReader(hahn, address(router));

        uint256 avaxIn = 0.01 ether;
        uint256 expectedHahnOut = avaxIn * 997 * 10_000 ether / (0.1 ether * 1000 + avaxIn * 997);
        assertEq(reader.quoteHAHNForAVAX(avaxIn), expectedHahnOut);

        uint256 hahnIn = 100 ether;
        uint256 expectedAvaxOut = hahnIn * 997 * 0.1 ether / (10_000 ether * 1000 + hahnIn * 997);
        assertEq(reader.quoteAVAXForHAHN(hahnIn), expectedAvaxOut);
    }

    function testRevertsBeforePairExists() external {
        HahnDexPriceReader reader = new HahnDexPriceReader(hahn, address(router));

        vm.expectRevert("HahnDexPriceReader: pair missing");
        reader.getReserves();
    }

    function testRevertsWhenPairHasNoLiquidity() external {
        MockPair pair = new MockPair(hahn, wavax, 0, 0);
        factory.setPair(hahn, wavax, address(pair));
        HahnDexPriceReader reader = new HahnDexPriceReader(hahn, address(router));

        vm.expectRevert("HahnDexPriceReader: no liquidity");
        reader.quoteHAHNForAVAX(0.01 ether);
    }

    function testRejectsUnexpectedTokenDecimals() external {
        address sixDecimalHahn = address(new MockMetadataToken(6));

        vm.expectRevert("HahnDexPriceReader: HAHN decimals changed");
        new HahnDexPriceReader(sixDecimalHahn, address(router));
    }
}
