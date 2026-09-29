// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Vault —— mini-dex 的链上资金托管合约
/// @notice 资金流：用户 deposit 把代币锁进来 → 链下撮合引擎记账/撮合 → 用户想提现时，
///         后端用 signer 私钥签一条 EIP-712 `Withdraw` 授权，用户拿着签名调 withdraw 把钱取走。
///
/// @dev 关键安全说明（课上要讲）：
///      合约 **不** 用链上 `balances` 限制提现金额——因为成交已经在链下发生，
///      链上 `balances` 只是"充了多少 / 取了多少"的参考账本，真正的余额在链下账本里。
///      所以 signer 私钥 = 金库钥匙：谁拿到它就能签走所有钱。生产环境必须上 HSM / 多签 + 限额。
contract Vault is EIP712, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @dev EIP-712 结构体类型哈希。字段顺序/类型必须和后端 server/src/chain.ts 里的 types 完全一致。
    bytes32 public constant WITHDRAW_TYPEHASH =
        keccak256("Withdraw(address user,address token,uint256 amount,uint256 nonce,uint256 deadline)");

    /// @notice 后端签名地址：只有它签出的 Withdraw 授权才有效
    address public signer;

    /// @notice 允许充值的代币白名单（提现不看白名单，避免代币下架后用户取不出来）
    mapping(address => bool) public allowedTokens;

    /// @notice 链上记账：user => token => 累计充值 - 累计提现。仅供展示/对账，不是提现的依据。
    mapping(address => mapping(address => uint256)) public balances;

    /// @notice 已用过的提现 nonce，防止同一条授权被重复使用（重放攻击）
    mapping(uint256 => bool) public usedNonces;

    event Deposit(address indexed user, address indexed token, uint256 amount);
    event Withdraw(address indexed user, address indexed token, uint256 amount, uint256 nonce);

    /// @param initialSigner 后端签名地址（server 启动时用对应私钥签 Withdraw）
    /// @dev domain = { name: "MiniDexVault", version: "1", chainId, verifyingContract: 本合约 }
    constructor(address initialSigner) EIP712("MiniDexVault", "1") Ownable(msg.sender) {
        require(initialSigner != address(0), "Vault: signer is zero");
        signer = initialSigner;
    }

    // ------------------------------------------------------------------
    // 管理员
    // ------------------------------------------------------------------

    /// @notice 更换后端签名地址（密钥轮换）
    function setSigner(address s) external onlyOwner {
        require(s != address(0), "Vault: signer is zero");
        signer = s;
    }

    /// @notice 上架 / 下架某个代币的充值
    function setAllowedToken(address token, bool allowed) external onlyOwner {
        allowedTokens[token] = allowed;
    }

    // ------------------------------------------------------------------
    // 用户
    // ------------------------------------------------------------------

    /// @notice 充值：把 `amount` 个 `token` 从 msg.sender 转进金库。调用前需要先对本合约 approve。
    /// @dev 后端 chain.ts 监听 Deposit 事件给链下账本加钱；事件是链上 → 链下的唯一通道。
    function deposit(address token, uint256 amount) external nonReentrant {
        require(allowedTokens[token], "Vault: token not allowed");
        require(amount > 0, "Vault: amount is zero");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        balances[msg.sender][token] += amount;

        emit Deposit(msg.sender, token, amount);
    }

    /// @notice 提现：必须持有后端 signer 对 (msg.sender, token, amount, nonce, deadline) 的 EIP-712 签名。
    /// @param token     要提的代币
    /// @param amount    数量（最小单位，wei）
    /// @param nonce     后端分配的一次性编号，防重放
    /// @param deadline  签名过期时间（unix 秒），超时后签名作废
    /// @param signature 后端 signer 的 65 字节签名 (r, s, v)
    /// @dev 校验顺序：没过期 → nonce 没用过 → 签名恢复出来的地址 == signer。
    ///      注意 digest 里的 user 直接用 msg.sender，所以"拿别人的签名来提"会因为恢复地址不对而失败，
    ///      这就等价于 spec 里的 `msg.sender == user` 检查。
    function withdraw(address token, uint256 amount, uint256 nonce, uint256 deadline, bytes calldata signature)
        external
        nonReentrant
    {
        require(block.timestamp <= deadline, "Vault: expired");
        require(!usedNonces[nonce], "Vault: nonce used");

        bytes32 digest = hashWithdraw(msg.sender, token, amount, nonce, deadline);
        address recovered = ECDSA.recover(digest, signature);
        require(recovered == signer, "Vault: bad signature");

        usedNonces[nonce] = true;

        // 链上记账只是参考：链下账本才是真相（成交发生在链下），signer 才是真正的闸门。
        // 所以这里不 revert，余额不够就直接归零，避免"链下明明有钱、链上取不出来"。
        uint256 bal = balances[msg.sender][token];
        balances[msg.sender][token] = bal >= amount ? bal - amount : 0;

        IERC20(token).safeTransfer(msg.sender, amount);

        emit Withdraw(msg.sender, token, amount, nonce);
    }

    // ------------------------------------------------------------------
    // 工具
    // ------------------------------------------------------------------

    /// @notice 计算 Withdraw 的 EIP-712 digest（已包含 domain separator）。
    /// @dev 后端 / 测试可以直接调这个 view 拿到待签名的 32 字节，避免自己拼 EIP-712 时字段写错。
    ///      等价于 viem 的 hashTypedData({ domain, types, primaryType: "Withdraw", message })。
    function hashWithdraw(address user, address token, uint256 amount, uint256 nonce, uint256 deadline)
        public
        view
        returns (bytes32)
    {
        return _hashTypedDataV4(keccak256(abi.encode(WITHDRAW_TYPEHASH, user, token, amount, nonce, deadline)));
    }
}
