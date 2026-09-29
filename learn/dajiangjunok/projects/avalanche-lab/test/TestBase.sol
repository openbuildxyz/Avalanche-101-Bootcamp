// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
interface Vm {
    function prank(address) external;
    function startPrank(address) external;
    function stopPrank() external;
    function expectRevert() external;
    function expectRevert(bytes calldata) external;
    function warp(uint256) external;
    function addr(uint256) external returns (address);
    function sign(uint256, bytes32) external returns (uint8, bytes32, bytes32);
}
abstract contract TestBase {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    function eq(uint256 a, uint256 b) internal pure { require(a == b, "uint mismatch"); }
    function eq(address a, address b) internal pure { require(a == b, "address mismatch"); }
    function eq(string memory a, string memory b) internal pure { require(keccak256(bytes(a)) == keccak256(bytes(b)), "string mismatch"); }
}
