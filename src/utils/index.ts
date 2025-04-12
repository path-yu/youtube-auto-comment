import { LaunchBrowser } from "#lib/Browser";
import LoginYoutube from "#lib/LoginYoutube";
import { Page } from "puppeteer";

export function isChinese(str) {
  const containsChineseRegex = /[\u4e00-\u9fff]/;
  const isPureEnglish = /^[A-Za-z\s]*$/;
  return containsChineseRegex.test(str) && !isPureEnglish.test(str);
}
// 查询https://www.youtube.com/watch?v=VnyYWOko3oI&t=401s链接id
export function getVideoId(url) {
  const videoId = url.split("v=")[1].split("&")[0];
  return videoId;
}
/**
 * 从 YouTube 链接中提取视频 ID
 * @param {string} url - 单个 YouTube 链接
 * @returns {string | null} - 提取的 videoId 或 null（如果链接无效）
 */
export function extractVideoId(url) {
  try {
    const urlObj = new URL(url);
    const searchParams = new URLSearchParams(urlObj.search);
    return searchParams.get("v"); // 获取 v 参数的值
  } catch (error) {
    console.error(`无法解析链接: ${url}`, error);
    return null;
  }
}

/**
 * 过滤 YouTube 链接列表，去除重复的 videoId
 * @param {string[]} urlList - YouTube 链接数组
 * @returns {string[]} - 去重后的链接数组
 */
export function filterDuplicateVideos(urlList: string[]) {
  // 使用 Map 存储 videoId 和对应的原始链接
  const videoMap = new Map();

  for (const url of urlList) {
    const videoId = extractVideoId(url);
    if (videoId && !videoMap.has(videoId)) {
      // 如果 videoId 有效且未重复，则存入 Map
      videoMap.set(videoId, url);
    }
  }

  // 返回去重后的链接数组
  return Array.from(videoMap.values());
}

export async function getPageSearchParams(page, key) {
  const url = await page.url();
  const urlObj = new URL(url);
  return urlObj.searchParams.get(key);
}

export async function processAccountsConcurrently(configData): Promise<Page[]> {
  // 使用 Promise.all 并行处理所有账户
  const promises = configData.accounts.map(async (user) => {
    try {
      const browser = new LaunchBrowser(user.username);
      await browser.init();
      const page = await browser.page; // 修正命名

      const login = new LoginYoutube(page, user.email, user.password);
      await login.login();
      return page;
    } catch (error) {
      console.error(`处理用户 ${user.username} 时出错:`, error);
      return null;
    }
  });

  // 等待所有账户处理完成
  return await Promise.all(promises);
}
export function splitKeywords(keywords, numAccounts) {
  const result = Array.from({ length: numAccounts }, () => []);
  for (let i = 0; i < keywords.length; i++) {
    result[i % numAccounts].push(keywords[i]);
  }
  return result.filter((arr) => arr.length > 0); // 移除空数组（如果账户数多于关键词）
}
export function splitArray(items, numParts, randomize = false) {
  const result = Array.from({ length: numParts }, () => []);
  let itemsToSplit = [...items];
  if (randomize) {
    for (let i = itemsToSplit.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [itemsToSplit[i], itemsToSplit[j]] = [itemsToSplit[j], itemsToSplit[i]];
    }
  }
  for (let i = 0; i < itemsToSplit.length; i++) {
    result[i % numParts].push(itemsToSplit[i]);
  }
  return result.filter((arr) => arr.length > 0);
}
