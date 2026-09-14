// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {
    IERC20MetadataMinimal,
    IPangolinFactory,
    IPangolinPair,
    IPangolinRouter
} from "./interfaces/IPangolinV2.sol";

/// @title HahnDexPriceReader
/// @notice Reads the HAHN/WAVAX price from Pangolin V2 on Avalanche Fuji.
/// @dev Both HAHN and WAVAX use 18 decimals. Reserve price is a spot price;
///      Router quotes include the 0.3% swap fee and price impact.
contract HahnDexPriceReader {
    address public immutable HAHN;
    address public immutable PANGOLIN_ROUTER;
    address public immutable PANGOLIN_FACTORY;
    address public immutable WAVAX;
    uint8 public immutable HAHN_DECIMALS;
    uint8 public immutable WAVAX_DECIMALS;
    uint256 public immutable HAHN_UNIT;

    constructor(address hahn, address pangolinRouter) {
        require(hahn != address(0), "HahnDexPriceReader: zero HAHN");
        require(pangolinRouter != address(0), "HahnDexPriceReader: zero router");

        HAHN = hahn;
        PANGOLIN_ROUTER = pangolinRouter;

        IPangolinRouter router = IPangolinRouter(pangolinRouter);
        PANGOLIN_FACTORY = router.factory();
        WAVAX = router.WAVAX();
        require(PANGOLIN_FACTORY != address(0), "HahnDexPriceReader: zero factory");
        require(WAVAX != address(0), "HahnDexPriceReader: zero WAVAX");

        HAHN_DECIMALS = IERC20MetadataMinimal(hahn).decimals();
        WAVAX_DECIMALS = IERC20MetadataMinimal(WAVAX).decimals();
        require(HAHN_DECIMALS == 18, "HahnDexPriceReader: HAHN decimals changed");
        require(WAVAX_DECIMALS == 18, "HahnDexPriceReader: WAVAX decimals changed");
        HAHN_UNIT = 10 ** uint256(HAHN_DECIMALS);
    }

    function getPairAddress() public view returns (address pair) {
        pair = IPangolinFactory(PANGOLIN_FACTORY).getPair(HAHN, WAVAX);
    }

    /// @return reserveHAHN HAHN reserve, 18 decimals.
    /// @return reserveWAVAX WAVAX reserve, 18 decimals.
    function getReserves() public view returns (uint256 reserveHAHN, uint256 reserveWAVAX) {
        address pairAddress = getPairAddress();
        require(pairAddress != address(0), "HahnDexPriceReader: pair missing");

        IPangolinPair pair = IPangolinPair(pairAddress);
        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();

        if (pair.token0() == HAHN) {
            require(pair.token1() == WAVAX, "HahnDexPriceReader: invalid pair");
            reserveHAHN = uint256(reserve0);
            reserveWAVAX = uint256(reserve1);
        } else {
            require(pair.token0() == WAVAX && pair.token1() == HAHN, "HahnDexPriceReader: invalid pair");
            reserveHAHN = uint256(reserve1);
            reserveWAVAX = uint256(reserve0);
        }

        require(reserveHAHN > 0 && reserveWAVAX > 0, "HahnDexPriceReader: no liquidity");
    }

    /// @notice Reserve spot price of one HAHN, denominated in AVAX with 18 decimals.
    /// @dev This is manipulable within a block and is for demonstration only, not a production oracle.
    function getSpotPriceInAVAX() public view returns (uint256 avaxPerHahn) {
        (uint256 reserveHAHN, uint256 reserveWAVAX) = getReserves();
        avaxPerHahn = (reserveWAVAX * HAHN_UNIT) / reserveHAHN;
    }

    /// @notice Returns HAHN output for an exact AVAX/WAVAX input.
    function quoteHAHNForAVAX(uint256 avaxIn) public view returns (uint256 hahnOut) {
        require(avaxIn > 0, "HahnDexPriceReader: zero input");
        getReserves(); // Fail explicitly when the Pair is missing or has no liquidity.
        address[] memory path = new address[](2);
        path[0] = WAVAX;
        path[1] = HAHN;
        hahnOut = IPangolinRouter(PANGOLIN_ROUTER).getAmountsOut(avaxIn, path)[1];
    }

    /// @notice Returns AVAX/WAVAX output for an exact HAHN input.
    function quoteAVAXForHAHN(uint256 hahnIn) public view returns (uint256 avaxOut) {
        require(hahnIn > 0, "HahnDexPriceReader: zero input");
        getReserves(); // Fail explicitly when the Pair is missing or has no liquidity.
        address[] memory path = new address[](2);
        path[0] = HAHN;
        path[1] = WAVAX;
        avaxOut = IPangolinRouter(PANGOLIN_ROUTER).getAmountsOut(hahnIn, path)[1];
    }
}
