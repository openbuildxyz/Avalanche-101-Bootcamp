// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

contract MockPangolinPair {
    address public token0;
    address public token1;
    uint112 public reserve0;
    uint112 public reserve1;

    function set(address t0, address t1, uint112 r0, uint112 r1) external {
        token0 = t0;
        token1 = t1;
        reserve0 = r0;
        reserve1 = r1;
    }

    function getReserves() external view returns (uint112, uint112, uint32) {
        return (reserve0, reserve1, uint32(block.timestamp));
    }
}

contract MockPangolinFactory {
    mapping(address => mapping(address => address)) public pairs;

    function setPair(address a, address b, address pair) external {
        pairs[a][b] = pair;
        pairs[b][a] = pair;
    }

    function getPair(address a, address b) external view returns (address) {
        return pairs[a][b];
    }
}

contract MockPangolinRouter {
    address public factory;
    address public WAVAX;

    constructor(address _factory, address _wavax) {
        factory = _factory;
        WAVAX = _wavax;
    }

    function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts) {
        require(path.length == 2, "path");
        MockPangolinFactory f = MockPangolinFactory(factory);
        MockPangolinPair pair = MockPangolinPair(f.getPair(path[0], path[1]));
        require(address(pair) != address(0), "no pair");

        (uint112 r0, uint112 r1,) = pair.getReserves();
        uint256 reserveIn;
        uint256 reserveOut;
        if (pair.token0() == path[0]) {
            reserveIn = r0;
            reserveOut = r1;
        } else {
            reserveIn = r1;
            reserveOut = r0;
        }

        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = reserveIn * 1000 + amountInWithFee;
        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = numerator / denominator;
    }
}
