# 飞书消息发送调试指南

## 📊 信息流完整流程图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           用户调用 sendMessageFeishu                         │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. 参数解析 (send.ts: sendMessageFeishu)                                    │
│     - cfg: OpenClawConfig                                                   │
│     - to: "chat:{chat_id}" 或 "user:{user_id}"                              │
│     - text: 消息内容                                                        │
│     - replyToMessageId?: 回复目标消息 ID                                     │
│     - mentions?: @提及目标                                                  │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  2. 账号解析 (accounts.ts: resolveFeishuAccount)                             │
│     - 从 cfg.channels.feishu.accounts 中查找账号                             │
│     - 返回: { appId, appSecret, verificationToken, ... }                    │
│                                                                             │
│     💡 断点位置: extensions/feishu/src/accounts.ts                          │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  3. 发送目标解析 (send-target.ts: resolveFeishuSendTarget)                   │
│     - 解析 "chat:oc_xxx" → { receiveId: "oc_xxx", receiveIdType: "chat_id" } │
│     - 解析 "user:ou_xxx" → { receiveId: "ou_xxx", receiveIdType: "open_id" } │
│                                                                             │
│     💡 断点位置: extensions/feishu/src/send-target.ts                       │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  4. 创建飞书客户端 (client.ts: createFeishuClient)                           │
│     - 使用 @larksuiteoapi/node-sdk 创建 Lark.Client                         │
│     - 配置 appId, appSecret, 可选代理等                                      │
│                                                                             │
│     💡 断点位置: extensions/feishu/src/client.ts                            │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  5. 构建消息内容 (send.ts: buildFeishuPostMessagePayload)                    │
│     - 将文本包装为 Feishu "post" 消息格式                                    │
│     - JSON 结构: { zh_cn: { content: [[{ tag: "md", text: ... }]] } }       │
│                                                                             │
│     💡 断点位置: send.ts 中的 messageText 生成后                             │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  6. API 调用分支                                                            │
│     ┌─────────────────┐    ┌─────────────────┐                              │
│     │  replyToMessageId?    │    │      无         │                              │
│     │      有          │    │                 │                              │
│     └────────┬────────┘    └────────┬────────┘                              │
│              ▼                      ▼                                       │
│     ┌─────────────────┐    ┌─────────────────┐                              │
│     │ client.im.      │    │ client.im.      │                              │
│     │ message.reply() │    │ message.create()│                              │
│     │ 回复消息        │    │ 发送新消息      │                              │
│     └────────┬────────┘    └────────┬────────┘                              │
│              │                      │                                       │
│              └──────────┬───────────┘                                       │
│                         ▼                                                   │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  7. HTTP 请求 (@larksuiteoapi/node-sdk)                                      │
│     - POST https://open.feishu.cn/open-apis/im/v1/messages                   │
│     - 或 POST /im/v1/messages/{message_id}/reply                            │
│     - Headers: Authorization: Bearer {tenant_access_token}                  │
│     - Body: { receive_id, msg_type, content }                               │
│                                                                             │
│     💡 查看方法: 启用 DEBUG=* 环境变量                                       │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  8. 响应处理                                                                 │
│     - 成功: { code: 0, data: { message_id: "om_xxx" } }                     │
│     - 失败: { code: != 0, msg: "错误信息" }                                  │
│                                                                             │
│     💡 断点位置: send-result.ts: assertFeishuMessageApiSuccess              │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  9. 返回结果 (FeishuSendResult)                                              │
│     - messageId: 飞书消息 ID                                                 │
│     - chatId: 聊天 ID                                                       │
│     - timestamp: 发送时间戳                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🎯 VS Code 调试步骤

### 1. 打开项目

```bash
code /Users/yesupen/.openclaw/workspace/agents/dev/openclaw
```

### 2. 设置断点（关键位置）

| 文件 | 行号范围 | 说明 |
|------|---------|------|
| `extensions/feishu/src/send.ts` | 240-260 | `sendMessageFeishu` 入口 |
| `extensions/feishu/src/send.ts` | 280-290 | 消息内容构建 |
| `extensions/feishu/src/send.ts` | 295-310 | API 调用分支 |
| `extensions/feishu/src/accounts.ts` | 1-50 | 账号解析 |
| `extensions/feishu/src/client.ts` | 1-80 | 客户端创建 |

### 3. 启动调试

**方式一：调试测试脚本**

1. 打开 `scripts/test-feishu-send.ts`
2. 按 `F5` 选择 **"Debug Feishu Send Test"**
3. 单步执行 (F10) 或步入 (F11)

**方式二：调试 Gateway（实际运行）**

1. 确保已配置好 `~/.openclaw/config.yaml`
2. 在关键位置设置断点
3. 按 `F5` 选择 **"Debug OpenClaw Gateway"**
4. 从飞书发送消息触发断点

### 4. 查看变量

在调试面板中关注这些变量：

```javascript
// 发送参数
params.to           // "chat:oc_xxxx"
params.text         // 消息内容
params.mentions     // @提及列表

// 账号信息
account.appId       // 飞书应用 ID
account.appSecret   // 密钥（加密显示）

// 客户端
client              // Lark.Client 实例

// 消息内容
content             // JSON 格式的消息体
msgType             // "post" | "interactive" | "text"

// 响应
response.code       // 0 = 成功
response.data.message_id  // 消息 ID
```

## 🔧 常见问题调试

### 问题 1: "Feishu account not configured"

**检查点：**
```yaml
# ~/.openclaw/config.yaml
channels:
  feishu:
    accounts:
      dev:  # <- 这个 key 就是 accountId
        appId: "cli_xxxxxxxx"
        appSecret: "xxxxxxxx"
```

**调试：**
- 断点：`accounts.ts: resolveFeishuAccount`
- 检查 `cfg.channels?.feishu?.accounts` 是否为空

### 问题 2: "Invalid receive_id"

**检查点：**
- 群聊 ID 格式：`oc_xxxxxxxxxxxxxxxx`
- 用户 ID 格式：`ou_xxxxxxxxxxxxxxxx`

**调试：**
- 断点：`send-target.ts: resolveFeishuSendTarget`
- 检查 `receiveId` 和 `receiveIdType` 是否正确

### 问题 3: 消息发送成功但看不到

**可能原因：**
1. 机器人不在群聊中
2. 机器人被禁言
3. 消息被飞书过滤

**调试：**
- 检查响应中的 `message_id` 是否存在
- 使用 `getMessageFeishu` 查询消息状态

## 📝 调试技巧

### 1. 添加日志

```typescript
// 在关键位置添加 console.log
console.log("[DEBUG] Step X: variable =", variable);
```

### 2. 使用条件断点

在 VS Code 中右键断点，设置条件：
```javascript
params.to.includes("oc_test")  // 只在测试群触发
```

### 3. 捕获网络请求

```bash
# 启动 gateway 时启用调试日志
DEBUG=openclaw:*,axios* openclaw gateway start
```

### 4. 模拟发送

使用测试脚本快速验证：
```bash
cd /Users/yesupen/.openclaw/workspace/agents/dev/openclaw
npx tsx scripts/test-feishu-send.ts
```

## 🔗 相关文件

| 文件 | 职责 |
|------|------|
| `extensions/feishu/src/send.ts` | 核心发送逻辑 |
| `extensions/feishu/src/accounts.ts` | 账号管理 |
| `extensions/feishu/src/client.ts` | SDK 客户端创建 |
| `extensions/feishu/src/send-target.ts` | 目标解析 |
| `extensions/feishu/src/send-result.ts` | 响应处理 |
| `extensions/feishu/src/mention.ts` | @提及处理 |
