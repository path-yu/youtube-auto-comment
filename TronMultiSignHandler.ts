import { TronWeb } from "tronweb";
import chalk from "chalk";

// 定义日志级别和样式
const logLevels = {
  info: chalk.green,
  error: chalk.red.bold,
  warn: chalk.yellow,
  debug: chalk.blue,
};

// 日志工具
export const logger = {
  info: (message: string, ...args: any[]) => {
    console.log(logLevels.info("[INFO]"), message, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(logLevels.error("[ERROR]"), message, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(logLevels.warn("[WARN]"), message, ...args);
  },
  debug: (message: string, ...args: any[]) => {
    console.debug(logLevels.debug("[DEBUG]"), message, ...args);
  },
};
interface MultiSignConfig {
  address: string;
  permissionId: number;
  keys: string[];
  tronGridUrl: string;
  feeLimit?: number;
}

interface TransferParams {
  to: string;
  amount?: number;
  asset?: string;
  memo?: string;
  assetType: "trx" | "trc10" | "trc20";
  unit?: "trx" | "sun" | "token";
}

interface MultiSignResult {
  txID: string;
  signedTx: any;
  broadcastResult?: any;
}

export class TronMultiSignHandler {
  private tronWeb: TronWeb;
  private config: MultiSignConfig;

  constructor(config: MultiSignConfig) {
    this.config = config;
    this.tronWeb = new TronWeb({ fullHost: config.tronGridUrl });
    logger.info(
      `Initialized TronMultiSignHandler for address: ${this.config.address}`
    );
    logger.debug(
      `Config: permissionId=${config.permissionId}, keys=${config.keys.length}`
    );
  }

  async getAvailableTrxBalance(): Promise<number> {
    const account = await this.tronWeb.trx.getAccount(this.config.address);

    // 确保 balance 和其他字段有默认值
    const totalBalance = account.balance || 0;
    const frozenBalance = account.frozenV2
      ? account.frozenV2.reduce((sum, f) => sum + (f.amount || 0), 0)
      : 0;
    const delegatedFrozen =
      account.delegated_frozenV2_balance_for_bandwidth || 0;

    // 计算可用余额，确保结果非 NaN
    const availableBalance = Math.max(
      0,
      totalBalance - frozenBalance - delegatedFrozen
    );

    // logger.debug(
    //   `TRX balance: ${availableBalance / 1_000_000} TRX ` +
    //     `(total=${totalBalance / 1_000_000}, frozen=${
    //       frozenBalance / 1_000_000
    //     }, delegated=${delegatedFrozen / 1_000_000})`
    // );

    return availableBalance;
  }

  async getMultiSignFee(fromAddress, toAddress, amount, numberOfSignatures) {
    try {
      // 创建未签名的交易
      const unsignedTransaction = await this.tronWeb.transactionBuilder.sendTrx(
        toAddress,
        amount,
        fromAddress
      );

      // 获取交易大小 (字节数)
      const transactionSize = JSON.stringify(unsignedTransaction).length;

      // 获取当前链上手续费配置
      const chainParameters = await this.tronWeb.trx.getChainParameters();
      const feePerByte = chainParameters.find(
        (param) => param.key === "getTransactionFee"
      )!.value;

      // 多签手续费的额外费用 (假设每个额外签名增加固定费用)
      const baseMultiSignFee = chainParameters.find(
        (param) => param.key === "getMultiSignFee"
      )!.value;

      // 计算基础手续费
      const baseFee = transactionSize * feePerByte;

      // 计算多签手续费
      const multiSignFee = baseMultiSignFee * (numberOfSignatures - 1); // 第一个签名不额外收费

      // 总手续费
      const totalFee = baseFee + multiSignFee;

      return totalFee; // 返回手续费 (SUN)
    } catch (error) {
      console.error("Error calculating multi-sign transaction fee:", error);
      throw error;
    }
  }

  async getTrc10Balance(tokenID: string): Promise<number> {
    const account = await this.tronWeb.trx.getAccount(this.config.address);
    const balance =
      account.assetV2 && account.assetV2[tokenID]
        ? account.assetV2[tokenID]
        : 0;
    logger.debug(`TRC10 balance for ${tokenID}: ${balance}`);
    return balance;
  }

  async getTrc20Balance(contractAddress: string): Promise<number> {
    try {
      const contract = await this.tronWeb.contract().at(contractAddress);
      const balance = await contract.balanceOf(this.config.address).call();
      const balanceNumber = this.tronWeb.toBigNumber(balance).toNumber();
      logger.debug(`TRC20 balance for ${contractAddress}: ${balanceNumber}`);
      return balanceNumber;
    } catch (e) {
      logger.error(`Failed to fetch TRC20 balance: ${e}`);
      return 0;
    }
  }
  async calculateMaxTransferableTRX(address) {
    try {
      // 获取账户信息
      const accountInfo = await this.tronWeb.trx.getAccount(address);
      const accountResources = await this.tronWeb.trx.getAccountResources(
        address
      );

      // 获取账户余额 (单位：SUN)
      const balance = accountInfo.balance || 0;

      // 获取冻结的 TRX (单位：SUN)
      const frozenBalance = (accountInfo.frozen || []).reduce(
        (total, frozen) => total + frozen.frozen_balance,
        0
      );

      // 获取宽带使用情况
      const bandwidthAvailable =
        accountResources.freeNetLimit - accountResources.freeNetUsed;

      // 获取链上参数
      const chainParameters = await this.tronWeb.trx.getChainParameters();
      const feePerByte = chainParameters.find(
        (param) => param.key === "getTransactionFee"
      )!.value;

      // 估算普通 TRX 转账的交易大小并计算手续费
      const estimatedTxSize = 250; // 平均交易大小（字节数）
      const estimatedFee = estimatedTxSize * feePerByte;

      // 如果宽带不足，额外计算 TRX 消耗
      const extraBandwidthFee =
        bandwidthAvailable < estimatedTxSize
          ? (estimatedTxSize - bandwidthAvailable) * feePerByte
          : 0;

      // 计算实际可转移金额
      const transferableAmount =
        balance - frozenBalance - estimatedFee - extraBandwidthFee;

      // 返回最大可转移的 TRX 数量 (单位：TRX)
      return Math.max(0, transferableAmount / 1e6); // 确保结果非负
    } catch (error) {
      console.error("Error calculating max transferable TRX:", error);
      throw error;
    }
  }
  /**
   * 动态计算交易大小
   * @param {string} fromAddress - 发送方地址
   * @param {string} toAddress - 接收方地址
   * @param {number} amount - 转账金额 (单位为 SUN，1 TRX = 1,000,000 SUN)
   * @returns {Promise<number>} - 返回交易大小 (单位：字节)
   */

  async transfer(
    params: TransferParams,
    broadcast: boolean = true
  ): Promise<MultiSignResult> {
    try {
      let amountInUnits;
      let availableMaxBalance = await calculateMaxTransferableTRX(
        this.tronWeb,
        this.config.address,
        params.to
      );
      if (!params.amount) {
        amountInUnits = availableMaxBalance;
      } else {
        //计算手续费
        let fee = await this.getMultiSignFee(
          this.config.address,
          params.to,
          params.amount,
          this.config.keys.length
        );
        //计算可用余额
        amountInUnits = params.amount - fee;
      }
      console.log(amountInUnits * 1_000_000);

      let signedTx;
      switch (params.assetType) {
        case "trx":
          signedTx = await this.multiSignTransferTrx({
            ...params,
            amount: (amountInUnits - 0.1) * 1_000_000,
          });
          break;
        case "trc10":
          if (!params.asset) throw new Error("TRC10 requires asset ID");
          signedTx = await this.multiSignTransferTrc10({
            ...params,
            amount: amountInUnits,
          });
          break;
        case "trc20":
          if (!params.asset) throw new Error("TRC20 requires contract address");
          signedTx = await this.multiSignTransferTrc20({
            ...params,
            amount: amountInUnits,
          });
          break;
        default:
          throw new Error(`Unsupported asset type: ${params.assetType}`);
      }

      const result: MultiSignResult = {
        txID: signedTx.txID,
        signedTx,
      };

      if (broadcast) {
        logger.debug(`Broadcasting tx: ${signedTx.txID}`);
        const broadcastResult = await this.tronWeb.trx.broadcast(signedTx);
        if (broadcastResult.result !== true) {
          throw new Error(
            `Broadcast failed: ${JSON.stringify(broadcastResult)}`
          );
        }
        result.broadcastResult = broadcastResult;
        logger.info(`Tx broadcast successfully, txID: ${signedTx.txID}`);
      }

      return result;
    } catch (e) {
      logger.error(`Transfer failed: ${e}`);
      throw e;
    }
  }

  private async multiSignTransferTrx(params: TransferParams): Promise<any> {
    const { to, amount } = params;
    const { address, permissionId } = this.config;

    logger.debug(`Creating TRX transfer: ${amount} sun to ${to}`);
    let unsignedTx = await this.tronWeb.transactionBuilder.sendTrx(
      to,
      Number(amount),
      address,
      {
        permissionId,
      }
    );

    return this.multiSign(unsignedTx);
  }

  private async multiSignTransferTrc10(params: TransferParams): Promise<any> {
    const { to, amount, asset } = params;
    const { address, permissionId } = this.config;

    if (!asset) throw new Error("TRC10 transfer requires asset ID");

    logger.debug(`Creating TRC10 transfer: ${amount} ${asset} to ${to}`);
    let unsignedTx = await this.tronWeb.transactionBuilder.sendAsset(
      to,
      Number(amount),
      asset,
      address,
      { permissionId }
    );

    return this.multiSign(unsignedTx);
  }

  private async multiSignTransferTrc20(params: TransferParams): Promise<any> {
    const { to, amount, asset, memo } = params;
    const { address, permissionId } = this.config;

    if (!asset) throw new Error("TRC20 transfer requires contract address");

    logger.debug(
      `Creating TRC20 transfer: ${amount} units to ${to} (contract: ${asset})`
    );
    const contract = await this.tronWeb.contract().at(asset);

    let unsignedTx = await this.tronWeb.transactionBuilder.triggerSmartContract(
      asset,
      "transfer(address,uint256)",
      {
        feeLimit: this.config.feeLimit || 10_000_000,
        callValue: 0,
        permissionId,
      },
      [
        { type: "address", value: to },
        { type: "uint256", value: Number(amount) },
      ],
      address
    );

    if (!unsignedTx.transaction) {
      throw new Error("Failed to create TRC20 transaction");
    }

    return this.multiSign(unsignedTx);
  }

  private async multiSign(unsignedTx: any): Promise<any> {
    try {
      const account = await this.tronWeb.trx.getAccount(this.config.address);
      let permission;
      if (this.config.permissionId === 0) {
        permission = account.owner_permission;
        logger.debug(`Using owner_permission (implicit ID=0)`);
      } else {
        permission = account.active_permission.find(
          (p) => p.id === this.config.permissionId
        );
        logger.debug(
          `Using active_permission with ID=${this.config.permissionId}`
        );
      }

      if (!permission) {
        throw new Error(`Permission ID ${this.config.permissionId} not found`);
      }

      const requiredSignatures = permission.threshold;
      if (this.config.keys.length < requiredSignatures) {
        throw new Error(
          `Insufficient keys: ${this.config.keys.length} provided, ${requiredSignatures} required`
        );
      }

      let signedTx = unsignedTx;
      for (let i = 0; i < requiredSignatures; i++) {
        const key = this.config.keys[i];
        signedTx = await this.tronWeb.trx.multiSign(
          signedTx,
          key,
          this.config.permissionId
        );
        logger.debug(`Signed with key ${i + 1}: ${key.slice(0, 6)}...`);
      }

      logger.debug(`Tx signed with ${requiredSignatures} signatures`);
      return signedTx;
    } catch (e) {
      logger.error(`Multi-sign failed: ${e}`);
      throw e;
    }
  }

  async checkTransactionStatus(txID: string): Promise<string> {
    try {
      const confirmedTx = await this.tronWeb.trx.getConfirmedTransaction(txID);
      if (confirmedTx.ret && confirmedTx.ret[0].contractRet === "SUCCESS") {
        logger.info(`Tx ${txID} confirmed successfully`);
        return "success";
      }
      logger.warn(
        `Tx ${txID} confirmed but failed: ${confirmedTx.ret[0].contractRet}`
      );
      return "error";
    } catch (e) {
      try {
        const unconfirmedTx = await this.tronWeb.trx.getTransaction(txID);
        if (unconfirmedTx) {
          logger.debug(`Tx ${txID} found but not confirmed yet`);
          return "pending";
        }
        logger.error(`Tx ${txID} not found on blockchain`);
        return "not_found";
      } catch (e2) {
        logger.error(`Tx ${txID} check failed: ${e2}`);
        return "not_found";
      }
    }
  }

  async batchTransfer(
    paramsList: TransferParams[],
    broadcast: boolean = true
  ): Promise<MultiSignResult[]> {
    const results: MultiSignResult[] = [];
    for (const params of paramsList) {
      try {
        const result = await this.transfer(params, broadcast);
        results.push(result);
        logger.info(
          `Batch transfer completed for ${params.assetType} to ${params.to}`
        );
      } catch (e) {
        logger.error(
          `Batch transfer failed for ${params.assetType} to ${params.to}: ${e}`
        );
        results.push({
          txID: "",
          signedTx: null,
          broadcastResult: { result: false, error: String(e) },
        });
      }
    }
    return results;
  }
}
export /**
 * 更新后的函数：计算账户可转移的最大 TRX 数量
 * @param {string} address - 用户的 TRON 地址
 * @returns {Promise<number>} - 返回最大可转移的 TRX 数量
 */
async function calculateMaxTransferableTRX(tronWeb, address, fromAddress) {
  try {
    // 获取账户信息
    const accountInfo = await tronWeb.trx.getAccount(address);
    const accountResources = await tronWeb.trx.getAccountResources(address);

    // 获取账户余额 (单位：SUN)
    const balance = accountInfo.balance || 0;

    // 获取冻结的 TRX (单位：SUN)
    const frozenBalance = (accountInfo.frozen || []).reduce(
      (total, frozen) => total + frozen.frozen_balance,
      0
    );

    // 获取宽带使用情况
    const bandwidthAvailable =
      accountResources.freeNetLimit - accountResources.freeNetUsed;

    // 获取链上参数
    const chainParameters = await tronWeb.trx.getChainParameters();
    const feePerByte = chainParameters.find(
      (param) => param.key === "getTransactionFee"
    ).value;

    // 估算普通 TRX 转账的交易大小并计算手续费
    const estimatedTxSize = 250; // 平均交易大小（字节数）
    const estimatedFee = estimatedTxSize * feePerByte;

    // 如果宽带不足，额外计算 TRX 消耗
    const extraBandwidthFee =
      bandwidthAvailable < estimatedTxSize
        ? (estimatedTxSize - bandwidthAvailable) * feePerByte
        : 0;

    // 调试信息
    console.log(`账户余额 (balance): ${balance / 1e6} TRX`);
    console.log(`冻结金额 (frozenBalance): ${frozenBalance / 1e6} TRX`);
    console.log(`宽带剩余 (bandwidthAvailable): ${bandwidthAvailable} bytes`);
    console.log(`每字节手续费 (feePerByte): ${feePerByte} SUN`);
    console.log(`估算的交易大小 (estimatedTxSize): ${estimatedTxSize} bytes`);
    console.log(`基础手续费 (estimatedFee): ${estimatedFee / 1e6} TRX`);
    console.log(
      `宽带不足导致的额外费用 (extraBandwidthFee): ${
        extraBandwidthFee / 1e6
      } TRX`
    );

    // 计算实际可转移金额
    const transferableAmount =
      balance - frozenBalance - estimatedFee - extraBandwidthFee;

    // 返回最大可转移的 TRX 数量 (单位：TRX)
    return Math.max(0, transferableAmount / 1e6); // 确保结果非负
  } catch (error) {
    console.error("Error calculating max transferable TRX:", error);
    throw error;
  }
}
