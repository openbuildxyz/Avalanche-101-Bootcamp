// 链与 wagmi 配置：只支持 Fuji 测试网和本地 anvil，并明确锁定 MetaMask。
// 不能使用无 target 的 injected()：同时安装 Core/MetaMask 时，window.ethereum
// 可能由 Core 注入，导致“Connect MetaMask”实际打开 Core 授权页。
// "应该用哪条链"不在这里写死，而是由后端 GET /config 返回的 chainId 决定。
import { createConfig, http } from "wagmi";
import { avalancheFuji } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { defineChain } from "viem";

export const anvil = defineChain({
  id: 31337,
  name: "Anvil (local)",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
});

export const chains = [avalancheFuji, anvil] as const;

export const wagmiConfig = createConfig({
  chains,
  connectors: [injected({ target: "metaMask" })],
  transports: {
    [avalancheFuji.id]: http(),
    [anvil.id]: http(),
  },
});

// 让 wagmi 的 hooks 知道我们的链列表，switchChain 的 chainId 才有类型提示
declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}

export function chainName(chainId: number): string {
  return chains.find((c) => c.id === chainId)?.name ?? `chain ${chainId}`;
}

// 交易浏览器链接：Fuji 用 snowtrace 测试网，anvil 没有浏览器
export function explorerTxUrl(chainId: number, hash: string): string | null {
  if (chainId === avalancheFuji.id) return `https://testnet.snowtrace.io/tx/${hash}`;
  return null;
}

// 地址浏览器链接：Fuji 用 snowtrace 测试网，anvil 没有浏览器
export function explorerAddressUrl(chainId: number, address: string): string | null {
  if (chainId === avalancheFuji.id) return `https://testnet.snowtrace.io/address/${address}`;
  return null;
}

// 测试网水龙头（领付 gas 用的 AVAX）：只有 Fuji 有；anvil 账户自带 10000 ETH
export function faucetUrl(chainId: number): string | null {
  if (chainId === avalancheFuji.id) return "https://core.app/tools/testnet-faucet/";
  return null;
}
