// 交易状态一行：hash（Fuji 可点开 snowtrace）+ 确认中 / 已确认 / 失败。
import { explorerTxUrl } from "../lib/chains";
import { shortAddress } from "../lib/format";

interface Props {
  chainId: number;
  hash: `0x${string}` | undefined;
  waiting: boolean;
  success: boolean;
  failed: boolean;
}

export function TxStatus({ chainId, hash, waiting, success, failed }: Props) {
  if (!hash) return null;
  const url = explorerTxUrl(chainId, hash);
  const label = waiting ? "等待链上确认…" : failed ? "交易失败" : success ? "已确认" : "已发送";
  return (
    <div className={`msg ${failed ? "err" : success ? "ok" : ""}`}>
      tx {url ? <a href={url} target="_blank" rel="noreferrer">{shortAddress(hash)}</a> : shortAddress(hash)}
      {" · "}
      {label}
    </div>
  );
}
