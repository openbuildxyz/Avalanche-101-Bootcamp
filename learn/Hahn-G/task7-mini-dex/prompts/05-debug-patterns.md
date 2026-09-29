# Prompt 05 · 调试时怎么追问 AI（方法论）

下面是课上讲"Vibe Coding 方法论"时展示的追问模板。核心：**把证据喂给 AI，而不是把感觉喂给 AI。**

## 模板 1：贴完整报错 + 复现步骤
```
我运行 `npm test` 报错如下（完整粘贴）：
<错误原文>
复现步骤：1) ... 2) ...
请先告诉我根因是什么，再给修复；修完自己再跑一次测试把结果贴出来。
```

## 模板 2：签名验证失败（本课最高频问题）
```
前端 signTypedData 后，后端 verifyTypedData 返回 false。
请逐项对比前后端的 domain(name/version/chainId/verifyingContract)、types 字段顺序和类型、message 的每个字段值，
打印两边的 hashTypedData 结果给我看是否一致。不要猜，先打印。
```

## 模板 3：链上交易 revert
```
调用 Vault.withdraw 时 MetaMask 提示交易会失败。
请用 cast call --trace（或 forge test 里复现）找出 revert 的自定义错误名，
然后对照合约里四个 require（deadline / nonce / signer / msg.sender）告诉我是哪一个，并说明前端该传什么。
```

## 模板 4：让 AI 做代码审查而不是写代码
```
不要改代码。请审查 server/src/routes.ts 的下单路径：
资金是什么时候冻结的？成交后是怎么划转的？撤单解冻了吗？市价单没用完的冻结额释放了吗？
列出你发现的每一个资金安全问题，按严重程度排序。
```

## 模板 5：限制范围
```
只修改 server/src/engine/orderbook.ts 这一个文件，不要动测试，不要新增依赖。
```
