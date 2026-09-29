// 底部面板：当前委托 / 资产与充提 两个 Tab，像真实交易所把账户相关操作收在下方。
import { useState } from "react";
import type { Balances, Config } from "../lib/api";
import { MyOrders } from "./MyOrders";
import { Wallet } from "./Wallet";

type Tab = "orders" | "assets";

interface Props {
  config: Config | undefined;
  token: string | null;
  balances: Balances | null;
}

export function BottomPanel({ config, token, balances }: Props) {
  const [tab, setTab] = useState<Tab>("orders");
  return (
    <div className="panel bottom-panel">
      <div className="panel-bar tabs-bar">
        <button className={`tab ${tab === "orders" ? "on" : ""}`} onClick={() => setTab("orders")}>
          当前委托
        </button>
        <button className={`tab ${tab === "assets" ? "on" : ""}`} onClick={() => setTab("assets")}>
          资产与充提
        </button>
      </div>
      <div className="bottom-body">
        {tab === "orders" && <MyOrders token={token} />}
        {tab === "assets" &&
          (config ? <Wallet config={config} token={token} balances={balances} /> : <p className="muted">加载配置中…</p>)}
      </div>
    </div>
  );
}
