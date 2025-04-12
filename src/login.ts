import "module-alias/register";
import { LaunchBrowser } from "#lib/Browser";
import LoginYoutube from "#lib/LoginYoutube";
import Logger from "#utils/Logger";
import { banner } from "#utils/banner";
import { getEnv, setEnv } from "./config";
import { CommentDB, db, initialize, SessionDB } from "models/index";
import Downloader from "#utils/net";
import fs from "fs";
import configData from "#config/baseConfig";
import { Page } from "puppeteer";
import { processAccountsConcurrently } from "./utils";

// 主函数
async function main(preferences: any) {
  Logger.banner(banner);
  Logger.divider();

  let pageList = await processAccountsConcurrently(configData);
  pageList.forEach(async (item) => {
    let title = await item.title();
    console.log("页面标题", title);
  });
}

// 初始化函数
async function init() {
  try {
    await initialize(); // 初始化数据库

    const zipFilePath = "./bin.zip";
    const driverFolderPath = "./driver";

    // 检查驱动文件夹
    if (
      fs.existsSync(driverFolderPath) &&
      fs.readdirSync(driverFolderPath).length > 0
    ) {
      Logger.info("Driver files already exist. Skipping download.");
    } else {
      if (fs.existsSync(zipFilePath)) {
        Logger.info("Zip file already exists. Skipping download.");
        const downloader = new Downloader(zipFilePath);
        await downloader.unzipFile();
      } else {
        Logger.info("Downloading driver files...");
        const downloader = new Downloader(zipFilePath);
        await downloader.downloadFromUrl();
      }
    }
    await main(configData);
  } catch (error) {
    Logger.error(`Initialization failed: ${error.message}`);
    process.exit(1);
  }
}

init();
