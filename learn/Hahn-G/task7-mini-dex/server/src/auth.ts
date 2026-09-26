// EIP-712 登录 -> JWT。
// 流程：GET /auth/nonce 拿一次性 nonce -> 钱包签 Login 类型化数据 -> POST /auth/login 校验 -> 发 JWT(24h)。
// 为什么用 EIP-712 而不是 personal_sign？钱包弹窗能显示结构化字段，用户知道自己在签什么。
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { verifyTypedData, isAddress, type Hex } from "viem";
import { SignJWT, jwtVerify } from "jose";
import { randomBytes } from "node:crypto";
import { norm } from "./ledger.js";

const NONCE_TTL_MS = 5 * 60 * 1000;

// 和前端/smoke 脚本必须完全一致（spec §3.4）
export const LOGIN_TYPES = {
  Login: [
    { name: "address", type: "address" },
    { name: "nonce", type: "string" },
    { name: "statement", type: "string" },
  ],
} as const;
export const LOGIN_STATEMENT = "Sign in to MiniDex";
export const loginDomain = (chainId: number) => ({ name: "MiniDex", version: "1", chainId } as const);

// Hono 上下文里放什么变量，这里声明类型
export type AuthEnv = { Variables: { address: string } };

export function createAuth(opts: { chainId: number; jwtSecret: string }) {
  const secret = new TextEncoder().encode(opts.jwtSecret);
  const nonces = new Map<string, { nonce: string; expires: number }>(); // address -> nonce（单次使用）

  const router = new Hono();

  router.get("/auth/nonce", (c) => {
    const address = c.req.query("address") ?? "";
    if (!isAddress(address)) return c.json({ error: "address 非法" }, 400);
    const nonce = "0x" + randomBytes(16).toString("hex");
    nonces.set(norm(address), { nonce, expires: Date.now() + NONCE_TTL_MS });
    return c.json({ nonce });
  });

  router.post("/auth/login", async (c) => {
    const body = await c.req.json<{ address?: string; nonce?: string; signature?: string }>().catch(() => ({}) as { address?: string; nonce?: string; signature?: string });
    const { address, nonce, signature } = body;
    if (!address || !isAddress(address) || !nonce || !signature) return c.json({ error: "缺少 address / nonce / signature" }, 400);

    const key = norm(address);
    const saved = nonces.get(key);
    if (!saved || saved.nonce !== nonce) return c.json({ error: "nonce 不存在或已使用" }, 401);
    if (saved.expires < Date.now()) { nonces.delete(key); return c.json({ error: "nonce 已过期" }, 401); }

    const ok = await verifyTypedData({
      address,
      domain: loginDomain(opts.chainId),
      types: LOGIN_TYPES,
      primaryType: "Login",
      message: { address, nonce, statement: LOGIN_STATEMENT },
      signature: signature as Hex,
    }).catch(() => false);
    if (!ok) return c.json({ error: "签名校验失败" }, 401);

    nonces.delete(key); // 单次使用，防重放
    const token = await new SignJWT({ address: key })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(key)
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(secret);
    return c.json({ token });
  });

  /** 校验 JWT，返回小写地址；失败返回 null */
  async function verifyToken(token: string): Promise<string | null> {
    try {
      const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
      return typeof payload.sub === "string" ? payload.sub : null;
    } catch {
      return null;
    }
  }

  /** Bearer 中间件：校验通过后把地址放进 c.get("address") */
  const bearer = createMiddleware<AuthEnv>(async (c, next) => {
    const header = c.req.header("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const address = token ? await verifyToken(token) : null;
    if (!address) return c.json({ error: "未登录" }, 401);
    c.set("address", address);
    await next();
  });

  return { router, bearer, verifyToken };
}
