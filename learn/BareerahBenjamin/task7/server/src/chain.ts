// 链上对接：
//  1. 监听 Vault 的 Deposit 事件 -> 换算成 8 位定点 -> 记入账本（"充值到账"）。
//  2. 用后端私钥签 EIP-712 Withdraw 授权，前端拿着签名去调 Vault.withdraw。
// VAULT_ADDRESS 为空时进入"离线模式"：不连链，用 /dev/faucet 直接发测试余额。
// 注意：signer 私钥 = 金库钥匙（提现不受链上余额约束），生产要 HSM/多签 + 限额。
import { createPublicClient, http, parseAbi, getAddress, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { Asset } from "./ledger.js";
import { weiToFixed, fixedToWei } from "./fixed.js";

export interface ChainConfig {
  chainId: number;
  rpcUrl: string;
  vault: string;   // 空 = 离线模式
  usdc: string;
  wavax: string;
  signerKey: Hex;
}

export const TOKEN_DECIMALS: Record<Asset, number> = { USDC: 6, WAVAX: 18 };

// 直接写人类可读 ABI，不依赖 contracts 包（和 spec §3.3 的事件签名一致）
const VAULT_ABI = parseAbi([
  "event Deposit(address indexed user, address indexed token, uint256 amount)",
  "event Withdraw(address indexed user, address indexed token, uint256 amount, uint256 nonce)",
]);

const WITHDRAW_TYPES = {
  Withdraw: [
    { name: "user", type: "address" },
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export function createChain(cfg: ChainConfig) {
  const offline = !cfg.vault;
  const signer = privateKeyToAccount(cfg.signerKey);

  const tokenAddress = (asset: Asset) => (asset === "USDC" ? cfg.usdc : cfg.wavax);
  function assetOf(token: string): Asset | null {
    const t = token.toLowerCase();
    if (t === cfg.usdc.toLowerCase()) return "USDC";
    if (t === cfg.wavax.toLowerCase()) return "WAVAX";
    return null;
  }

  /**
   * 启动回放：从 fromBlock 扫到最新块，把历史 Deposit 记入账本、历史 Withdraw 扣掉。
   * 这是 Primit block_sync_state 游标的极简版——内存账本重启即丢，没有回放就会"充了钱不见了"。
   * 公共 RPC 对 eth_getLogs 有区块跨度限制（Avalanche 是 2048），所以分块查。
   */
  async function backfill(
    client: ReturnType<typeof createPublicClient>,
    fromBlock: bigint,
    onDeposit: (user: string, asset: Asset, amount: bigint) => void,
    onWithdraw: (user: string, asset: Asset, amount: bigint) => void,
  ): Promise<bigint> {
    const latest = await client.getBlockNumber();
    const STEP = 2000n;
    let deposits = 0, withdraws = 0;
    for (let start = fromBlock; start <= latest; start += STEP) {
      const end = start + STEP - 1n < latest ? start + STEP - 1n : latest;
      const logs = await client.getContractEvents({ address: getAddress(cfg.vault), abi: VAULT_ABI, fromBlock: start, toBlock: end });
      for (const log of logs) {
        const { user, token, amount } = log.args as { user?: string; token?: string; amount?: bigint };
        if (!user || !token || amount === undefined) continue;
        const asset = assetOf(token);
        if (!asset) continue;
        const fixed = weiToFixed(amount, TOKEN_DECIMALS[asset]);
        if (log.eventName === "Deposit") { onDeposit(user, asset, fixed); deposits++; }
        else { onWithdraw(user, asset, fixed); withdraws++; }
      }
    }
    console.log(`[chain] 回放 ${fromBlock} → ${latest}：Deposit ${deposits} 笔，Withdraw ${withdraws} 笔`);
    return latest;
  }

  /** 开始监听 Deposit 事件；每笔到账回调 onDeposit(user, asset, 8 位定点金额)。
   *  fromBlock 有值时先回放历史事件（Deposit 入账、Withdraw 扣账）再开始实时监听。 */
  function watchDeposits(
    onDeposit: (user: string, asset: Asset, amount: bigint) => void,
    opts: { fromBlock?: bigint; onWithdraw?: (user: string, asset: Asset, amount: bigint) => void } = {},
  ): () => void {
    if (offline) {
      console.log("[chain] 离线模式：VAULT_ADDRESS 为空，不监听链上事件，开放 POST /dev/faucet");
      return () => {};
    }
    console.log(`[chain] 链上模式：chainId=${cfg.chainId} vault=${cfg.vault} rpc=${cfg.rpcUrl}`);
    console.log(`[chain] 后端签名地址 signer=${signer.address}（必须和 Vault.signer 一致）`);
    const client = createPublicClient({ transport: http(cfg.rpcUrl) });
    let stop: (() => void) | null = null;
    let stopped = false;
    const startWatch = (fromBlock?: bigint) => {
      if (stopped) return;
      stop = client.watchContractEvent({
        address: getAddress(cfg.vault),
        abi: VAULT_ABI,
        eventName: "Deposit",
        fromBlock,
        onLogs: (logs) => {
          for (const log of logs) {
            const { user, token, amount } = log.args;
            if (!user || !token || amount === undefined) continue;
            const asset = assetOf(token);
            if (!asset) { console.warn(`[chain] 未知代币 ${token}，忽略`); continue; }
            const fixed = weiToFixed(amount, TOKEN_DECIMALS[asset]);
            console.log(`[chain] Deposit ${user} ${asset} ${amount} wei (tx ${log.transactionHash})`);
            onDeposit(user, asset, fixed);
          }
        },
        onError: (e) => console.error("[chain] 事件监听出错:", e.message),
      });
    };
    if (opts.fromBlock !== undefined) {
      backfill(client, opts.fromBlock, onDeposit, opts.onWithdraw ?? (() => {}))
        .then((latest) => startWatch(latest + 1n))
        .catch((e) => { console.error("[chain] 回放失败，改为只监听新事件:", e.message); startWatch(); });
    } else {
      startWatch();
    }
    return () => { stopped = true; stop?.(); };
  }

  /** 签 Withdraw 授权。amount 是 8 位定点，这里换算成代币 wei 再签 */
  async function signWithdraw(p: { user: string; asset: Asset; amount: bigint; nonce: bigint; deadline: bigint }) {
    const token = getAddress(tokenAddress(p.asset));
    const amountWei = fixedToWei(p.amount, TOKEN_DECIMALS[p.asset]);
    const signature = await signer.signTypedData({
      domain: { name: "MiniDexVault", version: "1", chainId: cfg.chainId, verifyingContract: getAddress(cfg.vault) },
      types: WITHDRAW_TYPES,
      primaryType: "Withdraw",
      message: { user: getAddress(p.user), token, amount: amountWei, nonce: p.nonce, deadline: p.deadline },
    });
    return { token, amountWei, signature };
  }

  return { offline, signerAddress: signer.address, tokenAddress, watchDeposits, signWithdraw };
}
export type Chain = ReturnType<typeof createChain>;
