import "module-alias/register";
import { LaunchBrowser } from "#lib/Browser";
import LoginYoutube from "#lib/LoginYoutube";
import Logger from "#utils/Logger";
import { banner } from "#utils/banner";
import { initialize } from "models/index";
import Downloader from "#utils/net";
import fs from "fs";
import YOMEN from "#lib/Bot/YoutubeBot";
import { delay } from "#utils/delay";
import configData, { Account } from "#config/baseConfig";
import { filterDuplicateVideos, splitArray } from "./utils";
import pLimit from "p-limit";

async function searchVideo(yomen, page, keywords) {
  let urls = [];
  for (const keyword of keywords) {
    Logger.info(`开始搜索关键字: ${keyword}`);
    let result = await yomen.searchKeyword(keyword);
    urls.push(...result);
    // 重新加载页面
    await page.reload({ waitUntil: "networkidle2" });
    Logger.info("页面已重新加载");
    await delay(9000);
  }
  return urls;
}

async function runWithRepeats(yomen, page, preferences) {
  // 每次迭代返回搜索结果，处理逻辑在 processBatch 中
  const urls = await searchVideo(yomen, page, preferences.keywords);
  return urls;
}

async function processVideoUrl(yomen, url) {
  await yomen.goToVideo(url, "json", configData.comment);
}

async function processBatch(configData, concurrency = 2) {
  const limit = pLimit(concurrency);
  // 分配关键词（可选择随机）
  const splitKeywordsArray = splitArray(
    configData.keywords,
    configData.accounts.length,
    true
  ); // randomize = true

  // 为每个账户分配关键词
  const configs = configData.accounts.map((account, index) => ({
    ...account,
    preferences: {
      searchType: "keyword",
      keywords: splitKeywordsArray[index] || [],
    },
  })) as Account[];

  // 初始化浏览器（每个账户一次）
  const browsers = [];
  try {
    for (const config of configs) {
      Logger.info(`为用户 ${config.username || "默认"} 初始化浏览器`);
      const browser = new LaunchBrowser(config.username);
      await browser.init();
      const page = await browser.page;
      await page.goto("https://www.youtube.com", { waitUntil: "networkidle2" });
      await page.waitForSelector("body");

      const profileButton = await page.evaluate(() => {
        return !!document.querySelector("#buttons #avatar-btn"); // 返回 true/false
      });
      if (!profileButton) {
        Logger.info("正在尝试登录...");
        const login = new LoginYoutube(page, config.email, config.password);
        await login.login();
      } else {
        Logger.success("无需登录，已登录状态");
      }

      browsers.push({
        config,
        browser,
        page,
        yomen: new YOMEN(page, config.email, config.username),
      });
    }

    // 重复 repeatCount 次
    const { repeatCount, repeatTimeOut } = configData;
    const allResults = [];

    for (let i = 0; i < repeatCount; i++) {
      Logger.divider();
      Logger.info(`开始第 ${i + 1} 次迭代（共 ${repeatCount} 次）`);

      // 并发执行每个账户的搜索
      const tasks = browsers.map(({ config, page, yomen }) =>
        limit(async () => {
          try {
            Logger.info(
              `处理用户 ${
                config.username
              } 的关键词：${config.preferences.keywords.join(", ")}`
            );
            const urls = await runWithRepeats(yomen, page, config.preferences);
            return {
              status: "success",
              username: config.username,
              keywords: config.preferences.keywords,
              urls,
            };
          } catch (error) {
            Logger.error(`用户 ${config.username} 搜索出错:`);
            return {
              status: "error",
              username: config.username,
              error,
              urls: [],
            };
          }
        })
      );

      // 收集本次迭代结果
      const results = await Promise.all(tasks);
      allResults.push(results);

      // 合并所有链接
      let allUrls = results.reduce((acc, result) => {
        if (result.status === "success" && Array.isArray(result.urls)) {
          return acc.concat(result.urls);
        }
        return acc;
      }, []);

      // 过滤重复链接
      allUrls = filterDuplicateVideos(allUrls);

      // 过滤已观看视频（如果启用）
      if (configData.hasAlreadyWatchFilter) {
        allUrls = allUrls.filter((url) => !url.includes("t="));
        Logger.info(
          `第 ${i + 1} 次迭代过滤已观看后剩余 ${allUrls.length} 个视频链接`
        );
      }
      // 遍历所有链接，轮流分配账户处理
      for (let j = 0; j < allUrls.length; j++) {
        const browserIndex = j % browsers.length; // 轮流分配
        const { yomen, config } = browsers[browserIndex];
        Logger.info(`分配链接 ${allUrls[j]} 给用户 ${config.username} 处理`);
        await processVideoUrl(yomen, allUrls[j]);
      }

      // 如果不是最后一次迭代，等待 repeatTimeOut
      if (i < repeatCount - 1) {
        const timeoutMs = repeatTimeOut * 1000;
        Logger.info(`等待 ${repeatTimeOut} 秒后进行下一次迭代...`);
        await delay(timeoutMs);
      }
    }

    Logger.divider();
    Logger.success(`完成所有 ${repeatCount} 次迭代`);

    // 合并所有迭代的链接（如果需要最终结果）
    const mergedUrls = allResults.flatMap((results) =>
      results
        .filter((result) => result.status === "success")
        .flatMap((result) => result.urls || [])
    );
    const finalUrls = filterDuplicateVideos(mergedUrls);

    return {
      results: allResults,
      mergedUrls: finalUrls,
    };
  } finally {
    // 关闭所有浏览器
    for (const { browser } of browsers) {
      if (browser?.browser) {
        await browser.browser.close();
        Logger.info(`浏览器已关闭`);
      }
    }
  }
}

// 主函数
async function main() {
  Logger.divider();
  Logger.banner(banner);
  Logger.divider();
  try {
    const results = await processBatch(configData);
    console.log("Batch results:", results);
  } catch (error) {
    console.error("Batch processing failed:", error);
  }
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
    // await delay(4000000);
    await main();
  } catch (error) {
    Logger.error(`Initialization failed: ${error.message}`);
    process.exit(1);
  }
}

init();
