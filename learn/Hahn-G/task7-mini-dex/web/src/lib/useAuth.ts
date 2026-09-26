// 登录状态：EIP-712 签名换 JWT。
// 流程：GET /auth/nonce → 钱包 signTypedData → POST /auth/login → 存 localStorage。
// 注意 domain.chainId 用的是后端 /config 给的 chainId，不是钱包当前链。
import { useCallback, useEffect, useState } from "react";
import { useAccount, useSignTypedData } from "wagmi";
import { api, clearJwt, loadJwt, saveJwt } from "./api";
import { errorMessage } from "./format";

const LOGIN_TYPES = {
  Login: [
    { name: "address", type: "address" },
    { name: "nonce", type: "string" },
    { name: "statement", type: "string" },
  ],
} as const;

const LOGIN_STATEMENT = "Sign in to MiniDex";

export function useAuth(expectedChainId: number | undefined) {
  const { address } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 地址或目标链变化时，从 localStorage 取对应的 token，并用 /me 验一下是否过期
  useEffect(() => {
    if (!address || !expectedChainId) {
      setToken(null);
      return;
    }
    const saved = loadJwt(expectedChainId, address);
    setToken(saved);
    if (!saved) return;
    let cancelled = false;
    api.me(saved).catch(() => {
      if (cancelled) return;
      clearJwt(expectedChainId, address);
      setToken(null);
    });
    return () => {
      cancelled = true;
    };
  }, [address, expectedChainId]);

  const signIn = useCallback(async () => {
    if (!address || !expectedChainId) return;
    setBusy(true);
    setError(null);
    try {
      const { nonce } = await api.nonce(address);
      const signature = await signTypedDataAsync({
        domain: { name: "MiniDex", version: "1", chainId: expectedChainId },
        types: LOGIN_TYPES,
        primaryType: "Login",
        message: { address, nonce, statement: LOGIN_STATEMENT },
      });
      const res = await api.login({ address, nonce, signature });
      saveJwt(expectedChainId, address, res.token);
      setToken(res.token);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [address, expectedChainId, signTypedDataAsync]);

  const signOut = useCallback(() => {
    if (address && expectedChainId) clearJwt(expectedChainId, address);
    setToken(null);
    setError(null);
  }, [address, expectedChainId]);

  return { token, signIn, signOut, busy, error };
}
