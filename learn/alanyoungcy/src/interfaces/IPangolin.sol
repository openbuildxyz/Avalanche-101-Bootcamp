// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IPangolinRouter {
    function factory() external view returns (address);
    function WAVAX() external view returns (address);

    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts);

    function addLiquidityAVAX(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountAVAXMin,
        address to,
        uint256 deadline
    ) external payable returns (uint256 amountToken, uint256 amountAVAX, uint256 liquidity);
}

interface IPangolinFactory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
    function createPair(address tokenA, address tokenB) external returns (address pair);
}

interface IPangolinPair {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
}
