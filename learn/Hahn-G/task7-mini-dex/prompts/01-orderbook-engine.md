# Prompt 01 · 撮合引擎（第 2 章演示 1）

> 先发第一段要测试，跑红；再发第二段要实现，跑绿。这就是"测试先行"的 Vibe Coding。

## 第一步：只要测试

在 server/src/engine/ 下用 vitest 为一个 OrderBook 类写测试，**先不要写实现**。API：
- submit(order) 返回 { fills, resting }；order 有 id/owner/side("buy"|"sell")/type("limit"|"market")/price/qty，数值是 bigint（8 位小数定点）。
- cancel(id, owner)；snapshot(depth) 返回 { bids:[[price,qty]], asks:[[price,qty]] }，同价聚合；bestBid()/bestAsk()。

必须覆盖：空簿挂限价单会 rest；交叉的限价单按 maker 价成交；部分成交剩余挂回；价格优先（更优价先成交）；时间优先（同价先到先成交）；市价买单跨多档吃；空簿市价单无成交也不挂；撤单后 snapshot 不再出现；snapshot 同价聚合。
先给我测试文件，我跑一下看全红。

## 第二步：要实现

现在写 orderbook.ts 让测试全绿。要求：
- bids/asks 各用 Map<price, Level> + 有序价格数组（bids 降序、asks 升序），Level 内是 FIFO 数组——初学者能读懂优先于性能。
- 撮合循环：沿对手盘最优价逐档走，越过限价就停；同档按 FIFO；成交价 = maker 价；market 吃到没流动性为止、不挂单；limit 剩余挂单。
- 文件顶部用中文注释说明数据结构和算法，每个公开方法一行注释。
写完自己运行 `npx vitest run` 并把结果贴给我。

## 追问示例（课上可选）

- "如果两个 taker 并发提交会怎样？这个引擎是单线程的吗？生产上 Primit 用 RwLock + DashMap 做了什么？"
- "把 self-trade（自己吃自己的单）加个开关拒绝掉，补一个测试。"
