// 顶栏：连接钱包 / 切链 / 签名登录 / 登出，右侧状态小圆点按颜色区分四种状态。
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import type { Config } from "../lib/api";
import { chainName, chains, explorerAddressUrl, faucetUrl } from "../lib/chains";
import { shortAddress } from "../lib/format";
import { hasVault } from "../lib/useConfig";
import type { useAuth } from "../lib/useAuth";

type Auth = ReturnType<typeof useAuth>;
type Status = "disconnected" | "wrongChain" | "connected" | "signedIn";

const STATUS_LABEL: Record<Status, string> = {
  disconnected: "未连接",
  wrongChain: "链错误",
  connected: "已连接未登录",
  signedIn: "已登录",
};

export function Header({ config, auth }: { config: Config | undefined; auth: Auth }) {
  const { address, chainId, isConnected } = useAccount();
  const { connect, connectors, isPending: connecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();

  const expectedChainId = config?.chainId;
  const wrongChain = isConnected && !!expectedChainId && chainId !== expectedChainId;
  const targetChain = chains.find((c) => c.id === expectedChainId);

  const status: Status = !isConnected
    ? "disconnected"
    : wrongChain
      ? "wrongChain"
      : auth.token
        ? "signedIn"
        : "connected";

  return (
    <header className="header">
      <div className="brand">
        <span className="logo">◆</span> MiniDex
      </div>

      {config && <ContractLinks config={config} />}

      <div className="header-right">
        {expectedChainId && <span className="pill net">{chainName(expectedChainId)}</span>}

        {!isConnected && (
          <button
            className="btn primary"
            disabled={connecting}
            onClick={() => connect({ connector: connectors[0] })}
          >
            {connecting ? "连接中…" : "Connect MetaMask"}
          </button>
        )}

        {isConnected && address && (
          <span className="pill addr" title={address}>
            {shortAddress(address)}
          </span>
        )}

        {wrongChain && targetChain && (
          <button
            className="btn warn"
            disabled={switching}
            onClick={() => switchChain({ chainId: targetChain.id })}
          >
            {switching ? "切换中…" : `Switch to ${targetChain.name}`}
          </button>
        )}
        {wrongChain && !targetChain && (
          <span className="pill err">后端要求的链 {expectedChainId} 前端未配置</span>
        )}

        {isConnected && !wrongChain && !auth.token && (
          <button className="btn primary" disabled={auth.busy} onClick={auth.signIn}>
            {auth.busy ? "签名中…" : "Sign in"}
          </button>
        )}

        {auth.token && (
          <button className="btn" onClick={auth.signOut}>
            Sign out
          </button>
        )}

        {isConnected && (
          <button className="btn ghost" onClick={() => disconnect()}>
            断开
          </button>
        )}

        <span className={`pill status ${status}`}>
          <i className="dot" /> {STATUS_LABEL[status]}
        </span>
      </div>

      {auth.error && <div className="msg err header-msg">登录失败：{auth.error}</div>}
    </header>
  );
}

// 顶栏中间：三个合约地址（来自后端 /config，不在前端写死）+ 测试网水龙头。有浏览器的链可点开看源码。
function ContractLinks({ config }: { config: Config }) {
  if (!hasVault(config)) return <span className="muted small">离线模式 · 未连接合约</span>;
  const items: { label: string; address: string }[] = [
    { label: "Vault", address: config.vault },
    { label: "USDC", address: config.tokens.USDC },
    { label: "WAVAX", address: config.tokens.WAVAX },
  ];
  const faucet = faucetUrl(config.chainId);
  return (
    <div className="contracts">
      <span className="muted small">合约</span>
      {items.map(({ label, address }) => {
        const url = explorerAddressUrl(config.chainId, address);
        const body = (
          <>
            <span className="tag">{label}</span>
            <span className="addr">{shortAddress(address)}</span>
            {url && <span className="ext">↗</span>}
          </>
        );
        return url ? (
          <a key={label} className="pill link" href={url} target="_blank" rel="noreferrer" title={`${address}（在浏览器中查看合约与源码）`}>
            {body}
          </a>
        ) : (
          <span key={label} className="pill" title={address}>
            {body}
          </span>
        );
      })}
      {faucet && (
        <a className="pill link faucet" href={faucet} target="_blank" rel="noreferrer" title="领取测试网 AVAX（付 gas 用）">
          🚰 测试网水龙头 <span className="ext">↗</span>
        </a>
      )}
    </div>
  );
}
