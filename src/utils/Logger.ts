// logger.js
import chalk from "chalk";
import fs from "fs";
import path from "path";

// 日志文件路径（每次运行生成唯一文件名）
const timestamp = new Date().toISOString().replace(/[:.]/g, "-"); // 例如 2025-04-07T12-34-56
const logDir = path.join(process.cwd(), "logs");
const logFile = path.join(logDir, `log-${timestamp}.txt`);

// 确保 logs 目录存在
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 写入日志到文件的辅助函数
function writeToFile(message) {
  const plainMessage = message.replace(/\x1B\[\d+m/g, ""); // 去掉 ANSI 颜色代码
  fs.appendFileSync(logFile, `${plainMessage}\n`, "utf8");
}

export default class Logger {
  static logTime() {
    return chalk.dim(`[${new Date().toLocaleTimeString()}]`);
  }

  static info(message) {
    const logMessage = `${this.logTime()} ${chalk.bold.blue(
      "❯ "
    )} ${chalk.blueBright(message)}`;
    console.log(logMessage);
    writeToFile(logMessage);
  }

  static warn(message) {
    const logMessage = `${this.logTime()} ${chalk.bold.yellow(
      "⚠ "
    )} ${chalk.yellowBright(message)}`;
    console.log(logMessage);
    writeToFile(logMessage);
  }

  static error(message) {
    const logMessage = `${this.logTime()} ${chalk.bold.red(
      "✖ "
    )} ${chalk.redBright(message)}`;
    console.log(logMessage);
    writeToFile(logMessage);
  }

  static success(message) {
    const logMessage = `${this.logTime()} ${chalk.bold.green(
      "✔ "
    )} ${chalk.greenBright(message)}`;
    console.log(logMessage);
    writeToFile(logMessage);
  }

  static custom(label, color, icon, message) {
    const logMessage = `${this.logTime()} ${chalk
      .hex(color)
      .bold(`${icon} ${label}`)} ${chalk.hex(color)(message)}`;
    console.log(logMessage);
    writeToFile(logMessage);
  }

  static divider() {
    const logMessage = chalk.dim(
      "────────────────────────────────────────────────────"
    );
    console.log(logMessage);
    writeToFile(logMessage);
  }

  static banner(text) {
    const logMessage = chalk.whiteBright.bold(` ${text} `);
    console.log(logMessage);
  }
}
