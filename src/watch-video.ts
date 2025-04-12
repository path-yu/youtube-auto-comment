import "module-alias/register";
import { LaunchBrowser } from "#lib/Browser";
import LoginYoutube from "#lib/LoginYoutube";
import Logger from "#utils/Logger";
import { banner } from "#utils/banner";
import { initialize } from "models/index";
import Downloader from "#utils/net";
import fs from "fs";
import YOMEN from "#lib/Bot/YoutubeBot";
import { config } from "dotenv";
import { batchSearchVideos } from "#utils/search";
import configData from "#config/baseConfig";
import { delay } from "#utils/delay";

// 主函数
async function main() {
  Logger.divider();
  Logger.banner(banner);
  Logger.divider();

  let account = configData.accounts[0];
  const browser = new LaunchBrowser(account.username);
  await browser.init();

  const page = await browser.page; // 修正命名
  await page.goto("https://www.youtube.com", {
    waitUntil: "networkidle2",
  });
  await page.waitForSelector("body");

  const signInEl = await page.evaluate(() => {
    const elements = document.querySelectorAll(
      ".yt-spec-button-shape-next__button-text-content > .yt-core-attributed-string"
    );
    for (let el of elements) {
      if (el.textContent.trim() === "Sign in") {
        return el;
      }
    }
    return null;
  });

  const login = new LoginYoutube(page, account.email, account.password);

  if (signInEl) {
    Logger.info("Sign in button found, attempting login...");
    await login.login();
  } else {
    Logger.success("No Sign in button found, assuming already logged in");
  }

  const yomen = new YOMEN(page, account.username, account.email);

  // test
  // 跳转到视频页面
  await page.goto("https://www.youtube.com/watch?v=DrN7DWL5bYA", {
    waitUntil: "networkidle2",
  });
  await yomen.clickOrderComment();

  let urls: string[];
  if (configData.searchType === "trending") {
    Logger.info("Fetching trending videos...");
    urls = await yomen.getTrendingVideos();
  } else {
    let keywords: string[] = [];
    if (configData.keywords.length) {
      keywords = configData.keywords;
    } else {
      keywords = [configData.keyword];
    }
    // let result = await batchSearchVideos({
    //   queries: keywords,
    //   sort_by: configData.sortBy,
    //   upload_date: configData.videoUploadDate,
    //   duration: configData.videoDuration,
    //   lang: configData.language,
    //   filter: false,
    // });
    // Logger.info(`Search video length: ${result.length}`);
    // urls = result.map((item) => item.link);

    urls = await yomen.searchKeyword(configData.keyword);
  }

  for (const url of urls) {
    Logger.info(`Navigating to video: ${url}`);
    //  跳转到视频页面
    page.goto(url, { waitUntil: "networkidle2" });
    // 随机滚动200 -800px
    await page.evaluate(() => {
      window.scrollBy(0, Math.floor(Math.random() * 600 + 200));
    });
    //  Logger.info("Waiting for video to load...");
    await delay(10000);
  }

  // Logger.info("Process completed");
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

    await main();
  } catch (error) {
    Logger.error(`Initialization failed: ${error.message}`);
    process.exit(1);
  }
}

init();
