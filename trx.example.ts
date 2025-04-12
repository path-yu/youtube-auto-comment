import { TronMultiSignHandler } from "./TronMultiSignHandler";

// 配置多签账户
const multiSignConfig = {
  address: "416e3c5f3c71427f61ed5f8025855712a771ccf559", // 你的多签地址
  permissionId: 0, // 使用 owner_permission
  keys: ["YOUR_PRIVATE_KEY_1", "YOUR_PRIVATE_KEY_2"], // 替换为实际私钥，假设 threshold = 2
  tronGridUrl: "https://api.trongrid.io", // 主网
};

// 初始化
const tronMultiSign = new TronMultiSignHandler(multiSignConfig);

// 工具函数：轮询交易状态
async function pollTransactionStatus(txID: string) {
  let status = "pending";
  let attempts = 0;
  const maxAttempts = 10;
  while (status === "pending" && attempts < maxAttempts) {
    status = await tronMultiSign.checkTransactionStatus(txID);
    console.log(`Transaction ${txID} status: ${status}`);
    if (status === "pending") {
      await new Promise((resolve) => setTimeout(resolve, 3000)); // 等待 3 秒
      attempts++;
    }
  }
}

// 示例 1：转账所有 TRX
async function transferAllTrx() {
  const params = {
    to: "419ad73aa9490ec2927d31b0fde7d8404a8147a17c", // 目标地址
    assetType: "trx" as const,
  };

  try {
    const result = await tronMultiSign.transfer(params);
    console.log("TRX Transfer Result:", result);
    await pollTransactionStatus(result.txID);
  } catch (e) {
    console.error("TRX Transfer Failed:", e);
  }
}

// 示例 2：转账 1000 个 TRC10 代币
async function transferTrc10() {
  const params = {
    to: "419ad73aa9490ec2927d31b0fde7d8404a8147a17c",
    assetType: "trc10" as const,
    asset: "1000001", // 示例 TRC10 tokenID
    amount: 1000, // 1000 个单位
  };

  try {
    const result = await tronMultiSign.transfer(params);
    console.log("TRC10 Transfer Result:", result);
    await pollTransactionStatus(result.txID);
  } catch (e) {
    console.error("TRC10 Transfer Failed:", e);
  }
}

// 示例 3：转账 1 个 TRC20 USDT
async function transferTrc20() {
  const params = {
    to: "419ad73aa9490ec2927d31b0fde7d8404a8147a17c",
    assetType: "trc20" as const,
    asset: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", // USDT 合约地址
    amount: 1, // 1 USDT
    unit: "token" as const, // 使用代币自然单位
  };

  try {
    const result = await tronMultiSign.transfer(params);
    console.log("TRC20 Transfer Result:", result);
    await pollTransactionStatus(result.txID);
  } catch (e) {
    console.error("TRC20 Transfer Failed:", e);
  }
}

// 示例 4：批量转账
async function batchTransfer() {
  const paramsList = [
    {
      to: "419ad73aa9490ec2927d31b0fde7d8404a8147a17c",
      assetType: "trx" as const,
      amount: 2,
      unit: "trx" as const,
    },
    {
      to: "419ad73aa9490ec2927d31b0fde7d8404a8147a17c",
      assetType: "trc10" as const,
      asset: "1000001",
      amount: 500,
    },
    {
      to: "419ad73aa9490ec2927d31b0fde7d8404a8147a17c",
      assetType: "trc20" as const,
      asset: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
      amount: 0.5,
      unit: "token" as const,
    },
  ];

  try {
    const results = await tronMultiSign.batchTransfer(paramsList);
    console.log("Batch Transfer Results:", results);
    for (const result of results) {
      await pollTransactionStatus(result.txID);
    }
  } catch (e) {
    console.error("Batch Transfer Failed:", e);
  }
}

// 运行所有示例
async function runExamples() {
  console.log("Starting TRX Transfer...");
  await transferAllTrx();

  console.log("\nStarting TRC10 Transfer...");
  await transferTrc10();

  console.log("\nStarting TRC20 Transfer...");
  await transferTrc20();

  console.log("\nStarting Batch Transfer...");
  await batchTransfer();
}

runExamples().catch(console.error);
