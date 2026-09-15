// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

contract MockLFJPair {
    address public token0;
    uint112 internal reserve0;
    uint112 internal reserve1;

    function set(address token0_, uint112 reserve0_, uint112 reserve1_) external {
        token0 = token0_;
        reserve0 = reserve0_;
        reserve1 = reserve1_;
    }

    function getReserves() external view returns (uint112, uint112, uint32) {
        return (reserve0, reserve1, uint32(block.timestamp));
    }
}

contract MockLFJFactory {
    address public pair;

    function setPair(address pair_) external {
        pair = pair_;
    }

    function getPair(address, address) external view returns (address) {
        return pair;
    }
}

contract MockLFJRouter {
    address public immutable factory;
    address public immutable WAVAX;
    MockLFJPair public immutable pair;

    constructor(address factory_, address wavax_, address pair_) {
        factory = factory_;
        WAVAX = wavax_;
        pair = MockLFJPair(pair_);
    }

    function getAmountsOut(uint256 amountIn, address[] calldata) external view returns (uint256[] memory amounts) {
        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();
        (uint256 tokenReserve, uint256 avaxReserve) =
            pair.token0() == WAVAX ? (uint256(reserve1), uint256(reserve0)) : (uint256(reserve0), uint256(reserve1));
        uint256 amountInWithFee = amountIn * 997;

        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = amountInWithFee * tokenReserve / (avaxReserve * 1000 + amountInWithFee);
    }
}
