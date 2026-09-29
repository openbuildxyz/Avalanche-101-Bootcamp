// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Educational spot settlement, not a perpetual exchange. No operator may move unsigned funds.
contract MiniExchange is EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;
    struct Order { address trader; bool isBuy; uint256 price; uint256 amount; uint256 nonce; uint256 deadline; }
    bytes32 public constant ORDER_TYPEHASH = keccak256("Order(address trader,bool isBuy,uint256 price,uint256 amount,uint256 nonce,uint256 deadline)");
    address public immutable baseToken;
    address public immutable quoteToken;
    uint256 public immutable baseCap;
    uint256 public immutable quoteCap;
    mapping(address => mapping(address => uint256)) public balances;
    mapping(address => uint256) public totalDeposited;
    mapping(bytes32 => uint256) public filled;
    mapping(address => mapping(uint256 => bool)) public cancelled;
    event Deposit(address indexed user, address indexed token, uint256 amount);
    event Withdraw(address indexed user, address indexed token, uint256 amount);
    event Cancel(address indexed user, uint256 nonce);
    event Trade(bytes32 indexed buyHash, bytes32 indexed sellHash, address buyer, address seller, uint256 amount, uint256 price);

    constructor(address base, address quote, uint256 maxBase, uint256 maxQuote) EIP712("BootcampMiniDEX", "1") {
        require(base != address(0) && quote != address(0) && base != quote, "invalid assets");
        require(maxBase > 0 && maxQuote > 0, "invalid cap");
        baseToken = base; quoteToken = quote; baseCap = maxBase; quoteCap = maxQuote;
    }

    function deposit(address token, uint256 amount) external nonReentrant {
        require(token == baseToken || token == quoteToken, "unsupported token");
        require(amount > 0, "zero amount");
        uint256 cap = token == baseToken ? baseCap : quoteCap;
        require(amount <= cap - totalDeposited[token], "deposit cap");
        uint256 beforeBalance = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        require(IERC20(token).balanceOf(address(this)) - beforeBalance == amount, "unsupported transfer fee");
        balances[msg.sender][token] += amount;
        totalDeposited[token] += amount;
        emit Deposit(msg.sender, token, amount);
    }

    function withdraw(address token, uint256 amount) external nonReentrant {
        require(token == baseToken || token == quoteToken, "unsupported token");
        require(amount > 0 && balances[msg.sender][token] >= amount, "insufficient balance");
        balances[msg.sender][token] -= amount;
        totalDeposited[token] -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);
        emit Withdraw(msg.sender, token, amount);
    }

    function hashOrder(Order memory o) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(ORDER_TYPEHASH, o.trader, o.isBuy, o.price, o.amount, o.nonce, o.deadline)));
    }

    function cancel(uint256 nonce) external { cancelled[msg.sender][nonce] = true; emit Cancel(msg.sender, nonce); }

    function _validate(Order calldata o, bytes calldata signature, uint256 amount) private view returns (bytes32 h) {
        require(o.trader != address(0) && o.price > 0 && o.amount > 0, "invalid order");
        require(block.timestamp <= o.deadline && !cancelled[o.trader][o.nonce], "inactive order");
        h = hashOrder(o);
        require(amount <= o.amount - filled[h], "overfill");
        require(ECDSA.recover(h, signature) == o.trader, "invalid signature");
    }

    function settle(Order calldata buy, bytes calldata buySignature, Order calldata sell, bytes calldata sellSignature,
        uint256 amount, uint256 price) external nonReentrant
    {
        require(buy.isBuy && !sell.isBuy && buy.trader != sell.trader, "side or self trade");
        require(amount > 0 && price >= sell.price && price <= buy.price, "price or amount");
        bytes32 b = _validate(buy, buySignature, amount);
        bytes32 s = _validate(sell, sellSignature, amount);
        uint256 cost = amount * price; // BASE decimals=0, price in raw mUSD (6 decimals).
        require(balances[buy.trader][quoteToken] >= cost && balances[sell.trader][baseToken] >= amount, "insufficient funds");
        filled[b] += amount; filled[s] += amount;
        balances[buy.trader][quoteToken] -= cost;
        balances[sell.trader][quoteToken] += cost;
        balances[sell.trader][baseToken] -= amount;
        balances[buy.trader][baseToken] += amount;
        emit Trade(b, s, buy.trader, sell.trader, amount, price);
    }
}
