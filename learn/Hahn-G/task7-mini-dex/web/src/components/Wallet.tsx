// 左列：余额卡（链上钱包 vs 交易所）、水龙头、充值（approve → deposit 两步）、提现。
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { parseUnits } from "viem";
import { api, type Address, type Balances, type Config, type TokenSymbol } from "../lib/api";
import { erc20Abi, vaultAbi } from "../lib/abi";
import { TOKEN_DECIMALS, errorMessage, fmtNum, fmtWei, toWei } from "../lib/format";
import { hasVault } from "../lib/useConfig";
import { faucetUrl } from "../lib/chains";
import { TxStatus } from "./TxStatus";

const TOKENS: TokenSymbol[] = ["USDC", "WAVAX"];
const FAUCET_AMOUNT: Record<TokenSymbol, string> = { USDC: "1000", WAVAX: "10" };

interface WalletProps {
  config: Config;
  token: string | null; // JWT
  balances: Balances | null; // 交易所余额（WS 推送 / REST）
}

export function Wallet({ config, token, balances }: WalletProps) {
  const { address } = useAccount();
  const onchain = hasVault(config);

  return (
    <div className="wallet-grid">
      {/* 水龙头放最左：新用户第一步就是领测试币 */}
      {address && onchain && <Faucet config={config} address={address} />}
      {address && !onchain && <OfflineFaucet jwt={token} />}
      <BalancesCard config={config} address={address} balances={balances} />
      {address && onchain && <DepositForm config={config} address={address} balances={balances} />}
      {address && onchain && token && <WithdrawForm config={config} address={address} jwt={token} />}
      {!address && <p className="muted">连接钱包后显示余额与充提。</p>}
    </div>
  );
}

// ---------- 余额卡 ----------
function BalancesCard({
  config,
  address,
  balances,
}: {
  config: Config;
  address: Address | undefined;
  balances: Balances | null;
}) {
  return (
    <div className="card">
      <h3>余额</h3>
      <table className="table">
        <thead>
          <tr>
            <th>币种</th>
            <th>链上钱包</th>
            <th>交易所可用</th>
            <th>冻结</th>
          </tr>
        </thead>
        <tbody>
          {TOKENS.map((sym) => (
            <BalanceRow key={sym} config={config} address={address} symbol={sym} balances={balances} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BalanceRow({
  config,
  address,
  symbol,
  balances,
}: {
  config: Config;
  address: Address | undefined;
  symbol: TokenSymbol;
  balances: Balances | null;
}) {
  const onchain = hasVault(config);
  // 链上余额：每 5 秒轮询一次（教学用，够直观）
  const wallet = useReadContract({
    address: config.tokens[symbol],
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && onchain, refetchInterval: 5000 },
  });
  return (
    <tr>
      <td>{symbol}</td>
      <td>{onchain ? fmtWei(wallet.data, TOKEN_DECIMALS[symbol]) : "离线"}</td>
      <td>{fmtNum(balances?.[symbol]?.available)}</td>
      <td className="muted">{fmtNum(balances?.[symbol]?.locked)}</td>
    </tr>
  );
}

// ---------- 水龙头：任何人都能 mint ----------
function Faucet({ config, address }: { config: Config; address: Address }) {
  const { writeContractAsync, data: hash, isPending, error, reset } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });

  async function mint(symbol: TokenSymbol) {
    reset();
    await writeContractAsync({
      address: config.tokens[symbol],
      abi: erc20Abi,
      functionName: "mint",
      args: [address, parseUnits(FAUCET_AMOUNT[symbol], TOKEN_DECIMALS[symbol])],
    }).catch(() => {});
  }

  return (
    <div className="card">
      <h3>水龙头</h3>
      <div className="row">
        {TOKENS.map((sym) => (
          <button key={sym} className="btn" disabled={isPending} onClick={() => mint(sym)}>
            mint {FAUCET_AMOUNT[sym]} {sym}
          </button>
        ))}
      </div>
      <p className="muted small">
        这里 mint 的是交易用的测试代币。付 gas 的原生币另领：
        {faucetUrl(config.chainId) ? (
          <a href={faucetUrl(config.chainId)!} target="_blank" rel="noreferrer">
            Avalanche 测试网水龙头 ↗
          </a>
        ) : (
          "anvil 账户自带 10000 ETH"
        )}
      </p>
      <TxStatus chainId={config.chainId} hash={hash} waiting={receipt.isLoading} success={receipt.isSuccess} failed={receipt.isError} />
      {error && <div className="msg err">{errorMessage(error)}</div>}
    </div>
  );
}

// ---------- 充值：approve → deposit 两步 ----------
function DepositForm({
  config,
  address,
  balances,
}: {
  config: Config;
  address: Address;
  balances: Balances | null;
}) {
  const vault = config.vault as Address;
  const [symbol, setSymbol] = useState<TokenSymbol>("USDC");
  const [amount, setAmount] = useState("");
  // idle → approving → depositing → settling(链上已确认，等后端入账)
  const [stage, setStage] = useState<"idle" | "approving" | "depositing" | "settling">("idle");

  const decimals = TOKEN_DECIMALS[symbol];
  const amountWei = toWei(amount, decimals);

  const allowance = useReadContract({
    address: config.tokens[symbol],
    abi: erc20Abi,
    functionName: "allowance",
    args: [address, vault],
  });
  const needApprove = amountWei !== null && (allowance.data ?? 0n) < amountWei;

  const { writeContractAsync, data: hash, isPending, error, reset } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });

  // 链上确认后推进到下一步
  useEffect(() => {
    if (!receipt.isSuccess) return;
    if (stage === "approving") {
      allowance.refetch();
      setStage("idle");
      reset();
    } else if (stage === "depositing") {
      setStage("settling"); // 后端看到 Deposit 事件后会通过 WS 推余额
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt.isSuccess]);

  // 等待入账期间只要交易所余额变了，就认为后端已入账
  const balancesKey = JSON.stringify(balances);
  useEffect(() => {
    if (stage === "settling") {
      setStage("idle");
      setAmount("");
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balancesKey]);

  async function submit() {
    if (amountWei === null) return;
    reset();
    try {
      if (needApprove) {
        setStage("approving");
        await writeContractAsync({
          address: config.tokens[symbol],
          abi: erc20Abi,
          functionName: "approve",
          args: [vault, amountWei],
        });
      } else {
        setStage("depositing");
        await writeContractAsync({
          address: vault,
          abi: vaultAbi,
          functionName: "deposit",
          args: [config.tokens[symbol], amountWei],
        });
      }
    } catch {
      setStage("idle"); // 用户拒绝签名等
    }
  }

  const busy = isPending || receipt.isLoading || stage === "settling";
  const label =
    stage === "settling"
      ? "等待后端入账…"
      : needApprove
        ? "1/2 Approve"
        : "2/2 Deposit";

  return (
    <div className="card">
      <h3>充值到 Vault</h3>
      <div className="row">
        <TokenSelect value={symbol} onChange={setSymbol} />
        <input className="input" placeholder="数量" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <button className="btn primary" disabled={busy || amountWei === null} onClick={submit}>
          {label}
        </button>
      </div>
      <p className="muted small">
        已授权额度：{fmtWei(allowance.data, decimals)} {symbol}。第一步 approve 给 Vault，第二步 deposit；
        后端监听到 Deposit 事件后才会给交易所账户入账。
      </p>
      <TxStatus chainId={config.chainId} hash={hash} waiting={receipt.isLoading} success={receipt.isSuccess} failed={receipt.isError} />
      {stage === "settling" && <div className="msg">链上已确认，等待后端入账…（靠 WS 余额推送刷新）</div>}
      {error && <div className="msg err">{errorMessage(error)}</div>}
    </div>
  );
}

// ---------- 提现：后端签授权 → 用户自己调 Vault.withdraw ----------
function WithdrawForm({ config, address, jwt }: { config: Config; address: Address; jwt: string }) {
  const queryClient = useQueryClient();
  const [symbol, setSymbol] = useState<TokenSymbol>("USDC");
  const [amount, setAmount] = useState("");
  const [apiError, setApiError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  const { writeContractAsync, data: hash, isPending, error, reset } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });

  async function submit() {
    setApiError(null);
    reset();
    setRequesting(true);
    try {
      // 注意：后端在这一步就已经扣掉 available 了。如果用户随后拒签，
      // 这笔钱就"卡"在授权里 —— 生产系统要有 in-flight 状态 + 过期回滚。
      const auth = await api.withdraw(jwt, { token: symbol, amount });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
      await writeContractAsync({
        address: auth.vault,
        abi: vaultAbi,
        functionName: "withdraw",
        args: [config.tokens[symbol], BigInt(auth.amount), BigInt(auth.nonce), BigInt(auth.deadline), auth.signature],
        account: address,
      });
      setAmount("");
    } catch (e) {
      setApiError(errorMessage(e));
    } finally {
      setRequesting(false);
    }
  }

  const valid = toWei(amount, TOKEN_DECIMALS[symbol]) !== null;

  return (
    <div className="card">
      <h3>从 Vault 提现</h3>
      <div className="row">
        <TokenSelect value={symbol} onChange={setSymbol} />
        <input className="input" placeholder="数量" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <button className="btn primary" disabled={!valid || requesting || isPending || receipt.isLoading} onClick={submit}>
          {requesting ? "申请签名…" : "Withdraw"}
        </button>
      </div>
      <p className="muted small">后端用 signer 私钥签 EIP-712 授权，你拿着签名自己上链领钱。</p>
      <TxStatus chainId={config.chainId} hash={hash} waiting={receipt.isLoading} success={receipt.isSuccess} failed={receipt.isError} />
      {(apiError || error) && <div className="msg err">{apiError ?? errorMessage(error)}</div>}
    </div>
  );
}

// ---------- 离线水龙头：后端没连链时直接加钱 ----------
function OfflineFaucet({ jwt }: { jwt: string | null }) {
  const queryClient = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);

  async function claim() {
    if (!jwt) return;
    try {
      await api.devFaucet(jwt);
      queryClient.invalidateQueries({ queryKey: ["balances"] });
      setMsg("已到账");
    } catch (e) {
      setMsg(errorMessage(e));
    }
  }

  return (
    <div className="card">
      <h3>Faucet（离线模式）</h3>
      <p className="muted small">/config 没有 Vault 地址，说明后端没连链；直接让后端给账户加测试余额。</p>
      <button className="btn" disabled={!jwt} onClick={claim}>
        {jwt ? "领取测试余额" : "请先登录"}
      </button>
      {msg && <div className="msg">{msg}</div>}
    </div>
  );
}

function TokenSelect({ value, onChange }: { value: TokenSymbol; onChange: (v: TokenSymbol) => void }) {
  return (
    <select className="input select" value={value} onChange={(e) => onChange(e.target.value as TokenSymbol)}>
      {TOKENS.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}
