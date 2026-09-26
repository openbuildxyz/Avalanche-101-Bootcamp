// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPangolinRouter {
    function WAVAX() external view returns (address);

    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts);

    function swapExactAVAXForTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline)
        external
        payable
        returns (uint256[] memory amounts);
}

/// 任务 3：发行 PSIM，购买数量由 Pangolin 交易对的实时报价决定。
contract PricedSim {
    string public constant name = "Priced SIM";
    string public constant symbol = "PSIM";
    uint8 public constant decimals = 18;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    IPangolinRouter public constant router = IPangolinRouter(0x2D99ABD9008Dc933ff5c0CD271B88309593aB921);
    address public immutable wavax;

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);
    event Bought(address indexed buyer, uint256 avaxIn, uint256 quotedSim, uint256 simOut);

    constructor() {
        wavax = router.WAVAX();
        uint256 amount = 1000 * 10 ** uint256(decimals);
        totalSupply = amount;
        balanceOf[msg.sender] = amount;
        emit Transfer(address(0), msg.sender, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "allowance");
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    /// 用 Pangolin 路由报价：付出 avaxIn，能换回多少 PSIM。
    function previewBuy(uint256 avaxIn) public view returns (uint256 simOut) {
        address[] memory path = new address[](2);
        path[0] = wavax;
        path[1] = address(this);
        simOut = router.getAmountsOut(avaxIn, path)[1];
    }

    /// 按交易对的实时报价，用测试币买入 PSIM。
    function buy(uint256 minSimOut) external payable {
        require(msg.value > 0, "no avax");
        uint256 quoted = previewBuy(msg.value);
        require(quoted >= minSimOut, "slippage");
        address[] memory path = new address[](2);
        path[0] = wavax;
        path[1] = address(this);
        uint256[] memory amounts = router.swapExactAVAXForTokens{value: msg.value}(
            minSimOut, path, msg.sender, block.timestamp + 10 minutes
        );
        emit Bought(msg.sender, msg.value, quoted, amounts[1]);
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}
