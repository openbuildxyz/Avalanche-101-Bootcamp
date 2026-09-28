// 合约 ABI：用 viem 的 parseAbi 直接写"人类可读"的函数签名，
// 不依赖 contracts 包的编译产物，照着 spec §3.3 抄即可。
import { parseAbi } from "viem";

export const vaultAbi = parseAbi([
  "function deposit(address token, uint256 amount)",
  "function withdraw(address token, uint256 amount, uint256 nonce, uint256 deadline, bytes signature)",
  "function balances(address user, address token) view returns (uint256)",
  "event Deposit(address indexed user, address indexed token, uint256 amount)",
  "event Withdraw(address indexed user, address indexed token, uint256 amount, uint256 nonce)",
]);

export const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function mint(address to, uint256 amount)",
]);
