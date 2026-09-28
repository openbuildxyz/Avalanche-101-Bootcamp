// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// 只演示 ERC20 最基本的玩法：部署时拿到代币，再转给别人。
contract SimpleErc20 {
    string public name = "Simple Token";
    string public symbol = "SIM";
    uint8 public decimals = 18;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;

    event Transfer(address indexed from, address indexed to, uint256 amount);

    constructor() {
        uint256 amount = 1000 * 10 ** uint256(decimals);
        totalSupply = amount;
        balanceOf[msg.sender] = amount;
        emit Transfer(address(0), msg.sender, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "balance too low");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }
}
