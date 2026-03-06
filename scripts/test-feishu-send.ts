/**
 * 飞书消息发送调试脚本
 * 
 * 使用方法:
 * 1. 在 VS Code 中打开此文件
 * 2. 按 F5 启动调试 (选择 "Debug Feishu Send Test")
 * 3. 在关键行设置断点进行单步调试
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { parse as parseYaml } from "yaml";
import type { OpenClawConfig } from "../src/config/types.js";

// 模拟加载配置
function loadConfig(): OpenClawConfig {
  const configPath = resolve(process.env.HOME || "~", ".openclaw/config.yaml");
  console.log(`[DEBUG] Loading config from: ${configPath}`);
  
  const content = readFileSync(configPath, "utf-8");
  const config = parseYaml(content) as OpenClawConfig;
  
  console.log(`[DEBUG] Config loaded, agents: ${config.agents?.list?.length || 0}`);
  return config;
}

// 模拟飞书账号解析
function resolveFeishuAccount(cfg: OpenClawConfig, accountId?: string) {
  console.log(`[DEBUG] Resolving Feishu account: ${accountId || "default"}`);
  
  const accounts = cfg.channels?.feishu?.accounts || {};
  const id = accountId || Object.keys(accounts)[0];
  const account = accounts[id];
  
  if (!account) {
    throw new Error(`Feishu account "${id}" not found`);
  }
  
  console.log(`[DEBUG] Account resolved: ${id}, appId: ${account.appId}`);
  return { accountId: id, ...account };
}

// 模拟创建飞书客户端
function createFeishuClient(account: any) {
  console.log(`[DEBUG] Creating Feishu client for app: ${account.appId}`);
  
  // 这里会实际调用 @larksuiteoapi/node-sdk
  return {
    im: {
      message: {
        create: async (params: any) => {
          console.log(`[DEBUG] API Call: im.message.create`);
          console.log(`[DEBUG] Params:`, JSON.stringify(params, null, 2));
          
          // 模拟 API 响应
          return {
            code: 0,
            msg: "success",
            data: {
              message_id: `om_${Date.now()}`,
            },
          };
        },
        reply: async (params: any) => {
          console.log(`[DEBUG] API Call: im.message.reply`);
          console.log(`[DEBUG] Params:`, JSON.stringify(params, null, 2));
          
          return {
            code: 0,
            msg: "success",
            data: {
              message_id: `om_${Date.now()}`,
            },
          };
        },
      },
    },
  };
}

// 模拟发送目标解析
function resolveSendTarget(to: string) {
  console.log(`[DEBUG] Resolving send target: ${to}`);
  
  // 格式: chat:{chat_id} 或 user:{user_id}
  const [type, id] = to.split(":");
  
  if (type === "chat") {
    return { receiveId: id, receiveIdType: "chat_id" };
  } else if (type === "user") {
    return { receiveId: id, receiveIdType: "open_id" };
  }
  
  throw new Error(`Invalid target format: ${to}`);
}

// 主发送函数 - 可以在这里设置断点
async function sendMessage(
  cfg: OpenClawConfig,
  to: string,
  text: string,
  replyToMessageId?: string
) {
  console.log("\n========== 开始发送消息 ==========");
  console.log(`[INFO] Target: ${to}`);
  console.log(`[INFO] Text: ${text.substring(0, 50)}...`);
  console.log(`[INFO] ReplyTo: ${replyToMessageId || "none"}`);
  
  // Step 1: 解析账号
  const account = resolveFeishuAccount(cfg, undefined);
  
  // Step 2: 创建客户端
  const client = createFeishuClient(account);
  
  // Step 3: 解析发送目标
  const { receiveId, receiveIdType } = resolveSendTarget(to);
  
  // Step 4: 构建消息内容
  const content = JSON.stringify({
    zh_cn: {
      content: [[{ tag: "md", text }]],
    },
  });
  
  console.log(`[DEBUG] Message content built`);
  
  // Step 5: 发送消息
  let response;
  if (replyToMessageId) {
    // 回复模式
    console.log(`[DEBUG] Using reply mode`);
    response = await client.im.message.reply({
      path: { message_id: replyToMessageId },
      data: {
        content,
        msg_type: "post",
      },
    });
  } else {
    // 直接发送模式
    console.log(`[DEBUG] Using direct send mode`);
    response = await client.im.message.create({
      params: { receive_id_type: receiveIdType },
      data: {
        receive_id: receiveId,
        content,
        msg_type: "post",
      },
    });
  }
  
  console.log(`[DEBUG] Response:`, response);
  console.log("========== 发送完成 ==========\n");
  
  return response;
}

// 主函数
async function main() {
  try {
    console.log("🚀 飞书消息发送调试工具\n");
    
    // 加载配置
    const cfg = loadConfig();
    
    // 示例：发送一条测试消息
    // 注意：请将下面的 chat_id 替换为实际的飞书群聊 ID
    const testChatId = "oc_xxxxxxxxxxxxxxxx"; // 替换为实际的群聊 ID
    
    // 在这里设置断点，逐步调试发送流程
    const result = await sendMessage(
      cfg,
      `chat:${testChatId}`,
      "这是一条来自 OpenClaw 调试工具的测试消息 🎉",
      undefined // 不需要回复某条消息
    );
    
    console.log("✅ 消息发送成功!");
    console.log(`Message ID: ${result.data?.message_id}`);
    
  } catch (error) {
    console.error("❌ 发送失败:", error);
    process.exit(1);
  }
}

// 运行
main();
