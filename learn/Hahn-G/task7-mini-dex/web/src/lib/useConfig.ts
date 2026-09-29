// 读取后端 /config：链 ID、Vault 和代币地址都从这里来，前端不写死。
import { useQuery } from "@tanstack/react-query";
import { api, type Config } from "./api";

export function useConfig() {
  return useQuery<Config>({
    queryKey: ["config"],
    queryFn: api.config,
    staleTime: Infinity,
    retry: 1,
  });
}

// vault 为空 = 离线模式（后端没连链），此时显示"离线水龙头"按钮
export function hasVault(config: Config | undefined): config is Config & { vault: `0x${string}` } {
  return !!config && config.vault !== "" && !/^0x0+$/.test(config.vault);
}
