import { getEnv } from "#config/index";
import { delay } from "#utils/delay";
import Logger from "#utils/Logger";
import { randomNumber } from "#utils/randomDelay";
import scrollToBottom from "#utils/scrollToBottom";
import type { Page } from "puppeteer";
import { collectLinks } from "#utils/videos/collectLinks";
import { commentDBCreate, commentDBfindOne } from "models/Comment";
import configData from "#config/baseConfig";
import { getPageSearchParams, getVideoId, isChinese } from "#utils/index";
// import { getComments } from "#utils/innerTube";
import baseConfig from "#config/baseConfig";
import notifier from "node-notifier";

Logger.banner("🚀 Starting YOMEN Application...");

export default class YOMEN {
  private page: Page;
  // 当前搜索页面sp参数
  private sp: string;
  user_email: string;
  userName: string;
  constructor(pages: Page, username: string, email: string) {
    this.page = pages;
    this.userName = username;
  }
  // 筛选搜索
  async filterSearchPage(index: number, valueIndex: number) {
    // 等待元素出现，最多等待 10 秒
    await this.page.waitForSelector("#filter-button button", {
      timeout: 10000,
    });
    // 点击筛选元素
    await this.page.simulateMouseClick("#filter-button button");
    // 等待弹窗加载
    await delay(1500);
    await this.page.evaluate(
      async (index, valueIndex) => {
        let allFiltersEle = document.querySelectorAll(
          "#options > ytd-search-filter-group-renderer"
        ) as NodeListOf<Element>;
        let parent = allFiltersEle[index];
        let child = parent.querySelectorAll("a")[valueIndex];
        child.click();
        return true;
      },
      index,
      valueIndex
    );
    // 等待加载
    await delay(1000);
    // 点击关闭弹窗
    await this.page.mouse.click(10, 10);
  }

  async searchKeyword(keyword: string): Promise<string[] | any> {
    if (typeof keyword !== "string") {
      Logger.error("Invalid keyword type. Expected a string.");
      return;
    }
    try {
      Logger.info(`Navigating to YouTube search results for: "${keyword}"`);
      await this.page.goto(
        `https://www.youtube.com/results?search_query=${encodeURIComponent(
          keyword
        )}&sp=${this.sp}`
      );
      Logger.info("开始选择筛选条件");
      // 初始化选择筛选
      if (!this.sp) {
        await this.filterSearchPage(0, baseConfig.videoUploadDate);
        // await this.filterSearchPage(2, baseConfig.videoType);
        await this.filterSearchPage(2, baseConfig.videoDuration);
        await this.filterSearchPage(4, baseConfig.sortBy);
        // 记录当前地址sp参数
        const spValue = await getPageSearchParams(this.page, "sp");
        this.sp = spValue;
      }
      // 读取sp参数
      Logger.info("等待搜索结果完成");
      const videoElement = await this.page
        .waitForSelector("ytd-video-renderer", { timeout: 5000 })
        .catch(() => null);
      if (!videoElement) {
        Logger.warn("未找到搜索结果,可能已超时或无搜索结果");
        return [];
        // 处理未找到的情况，比如重试或跳过
      }
      await scrollToBottom(this.page);
      Logger.info("Collecting video links...");
      const videoLinks: string[] = await collectLinks(this.page);

      Logger.success(`Collected ${videoLinks.length} video links.`);

      const convertedUrls = videoLinks.map((url) =>
        url.replace(
          /^https:\/\/www\.youtube\.com\/shorts\/([\w-]+)/,
          "https://www.youtube.com/watch?v=$1"
        )
      );
      return convertedUrls;
    } catch (error) {
      Logger.error(`Failed to search keyword: ${(error as Error).message}`);
    }
  }

  async getTrendingVideos(): Promise<string[] | any> {
    await this.page.goto("https://www.youtube.com/feed/trending");
    Logger.info("Scrolling to the bottom of the search results page...");
    await scrollToBottom(this.page);

    // 读取sp参数
    Logger.info("等待搜索结果完成");
    const videoElement = await this.page
      .waitForSelector("ytd-video-renderer", { timeout: 5000 })
      .catch(() => null);
    if (!videoElement) {
      Logger.warn("未找到搜索结果,可能已超时或无搜索结果");
      return [];
      // 处理未找到的情况，比如重试或跳过
    }

    Logger.info("Collecting video links...");
    const videoLinks: string[] = await collectLinks(this.page);

    Logger.success(`Collected ${videoLinks.length} video links.`);

    const convertedUrls = videoLinks.map((url) =>
      url.replace(
        /^https:\/\/www\.youtube\.com\/shorts\/([\w-]+)/,
        "https://www.youtube.com/watch?v=$1"
      )
    );
    return convertedUrls;
  }
  // 点击排序方式 选择最新评论
  async clickOrderComment() {
    // 滚动页面500
    await this.page.evaluate(() => {
      window.scrollBy(0, 250);
    });
    await this.page.waitForSelector("#sort-menu #trigger");
    await this.page.simulateMouseClick("#sort-menu #trigger");
    await delay(500);
    // document.querySelector('#menu > a:nth-child(2)')
    await this.page.simulateMouseClick("#menu > a:nth-child(2)");
    // 等待数据加载完成
    this.page.smartWaitForSelector(
      "span.yt-core-attributed-string.yt-core-attributed-string--white-space-pre-wrap"
    );
    await delay(500);
  }
  /**
   * 收集视频的所有评论，第一次获取所有可见评论，后续滚动直到没有新增评论
   * @returns 评论内容数组
   */
  async collectAllComments(): Promise<
    { username: string; content: string; publishedTime: string }[]
  > {
    Logger.info("开始收集视频评论...");

    // 向下滚动 加载评论
    await this.page.evaluate(() => {
      window.scrollBy(0, window.innerHeight / 2);
    });
    // Wait for the comments section to load
    // Wait for the comments section to load
    await this.page
      .waitForSelector("#comments #contents", { timeout: 30000 })
      .catch((error) => {
        Logger.error(`Failed to find comments section: ${error.message}`);
        return [];
      });
    const comments = new Map<
      string,
      { username: string; content: string; publishedTime: string }
    >();
    const interval = 2400; // Scroll interval in milliseconds
    const maxScrolls = 2; // Maximum number of scrolls
    let scrollCount = 0;

    try {
      while (scrollCount < maxScrolls) {
        // Get all comment elements
        const commentElements = await this.page.$$(
          "ytd-comment-view-model #main"
        );
        if (!commentElements.length) {
          Logger.info("No comments found.");
          break;
        }

        let previousSize = comments.size;

        // Process each comment element
        for (const commentElement of commentElements) {
          const username = await commentElement
            .$eval(
              "#author-text > span",
              (el) => el.textContent?.trim() ?? "Unknown User"
            )
            .catch(() => "Unknown User");

          const content = await commentElement
            .$eval(
              "#content-text span.yt-core-attributed-string.yt-core-attributed-string--white-space-pre-wrap",
              (el) => el.textContent?.trim() ?? "No Content"
            )
            .catch(() => "No Content");

          const publishedTime = await commentElement
            .$eval(
              "#published-time-text > a",
              (el) => el.textContent?.trim() ?? "Unknown Time"
            )
            .catch(() => "Unknown Time");

          if (username && content) {
            comments.set(username, { username, content, publishedTime });
          }
        }

        Logger.info(`目前已收集${comments.size} 条评论`);
        const scrollHeight = await this.page.evaluate(() => {
          let commentListContainerRect = document
            .querySelector("#comments")
            .getBoundingClientRect();
          let containerVisibleHeight =
            window.innerHeight - commentListContainerRect.top;
          return commentListContainerRect.height - containerVisibleHeight;
        });
        if (scrollHeight > 0) {
          await this.page.evaluate(
            (height) => window.scrollBy(0, height),
            scrollHeight
          );
        } else {
          Logger.info("没有新评论或已到底部，停止收藏。");
          break;
        }
        // If no new comments were added or we're at the bottom, stop
        if (comments.size === previousSize) {
          Logger.info("无没有评论或已到达底部，停止收集。");
          break;
        }

        scrollCount++;
        await new Promise((resolve) => setTimeout(resolve, interval)); // Wait before next scroll
      }

      Logger.info(`收集评论${comments.size} 个评论.`);
      // 滚动到顶部
      await this.page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      return Array.from(comments.values());
    } catch (error) {
      Logger.error(`Unable to collect comments: ${error.message}`);
      return [];
    }
  }

  async getCommentList() {
    // 读取页面标题
    const title = await this.page.title();
    Logger.info(`页面标题: ${title}`);
    // 判断是否为中文
    let isChineseData = isChinese(title);
    //  评论数组 随机获取一个评论
    let arr = isChineseData ? configData.comment : configData.enComment;
    return arr;
  }
  // 获取随机评论 支持参数排除指定评论
  async getRandomCommentByConfig(exclude?: string) {
    let commentList = await this.getCommentList();
    commentList = exclude
      ? commentList.filter((item) => item !== exclude)
      : commentList;
    let comment = commentList[Math.floor(Math.random() * commentList.length)];
    return comment;
  }
  async goToVideo(
    videoLink: string,
    commentType = "random",
    manual?: any
  ): Promise<void> {
    try {
      await this.page.goto(videoLink, { waitUntil: "networkidle2" });
      // 等待页面完全加载（load 事件）
      let videoId = getVideoId(videoLink);
      // 查询视频评论列表
      Logger.info(`开始获取视频评论列表: ${videoLink}`);
      await this.clickOrderComment();
      let commentList = await this.collectAllComments();
      // 判断是否已经评论过
      if (commentList.some((item) => item.username === this.userName)) {
        Logger.info(`视频已经评论过: ${videoLink}`);
        return;
      }
      // const exist = await commentDBfindOne({
      //   where: {
      //     username: getEnv("USERNAME_GOOGLE"),
      //     video_id: videoId,
      //     comment_status: "success",
      //   },
      // });

      switch (commentType) {
        case "random":
          await this.randomComment(videoLink);
          break;
        case "ai":
          await this.aiComment(videoLink);
          break;
        case "copy":
          await this.randomComment(videoLink);
          break;
        case "direct":
          await this.directComment(videoLink, manual);
          break;
        case "json":
          // 读取页面标题
          let comment = await this.getRandomCommentByConfig();
          Logger.info(`选择的评论: ${comment}`);
          await this.directComment(videoLink, comment);
          break;
        default:
          await this.randomComment(videoLink);
          break;
      }

      await delay(5000);
    } catch (e) {
      await commentDBCreate({
        username: getEnv("USERNAME_GOOGLE"),
        video_url: videoLink,
        comment_status: "failed",
        comment: (e as Error).message,
      });
      Logger.error(
        `Failed to interact with the video: ${(e as Error).message}`
      );
    }
  }
  async postComment(
    videoLink: string,
    comment: string,
    status: "success" | "failed" = "success"
  ) {
    let commentStatus = status;
    let videoId = getVideoId(videoLink);
    try {
      // 等待加载
      await this.page.waitForFunction(
        () => {
          return document.querySelector(
            "#channel-name > #container > #text-container"
          )?.textContent;
        },
        { timeout: randomNumber(15000, 20000) }
      );
      let result = await this.page.evaluate((configData) => {
        let authorName = document
          .querySelector("#channel-name > #container > #text-container")
          ?.textContent.trim();

        return configData["whiteAuthorNameList"].includes(authorName);
      }, configData);
      if (result) {
        Logger.info("Author is in the whitelist, skipping comment.");
        return;
      }
      // Scroll to load comments
      await this.page.evaluate(() => {
        window.scrollBy(0, 500);
      });

      Logger.info("Scrolling to the comment input box...");
      await this.page.waitForSelector("#simple-box", {
        visible: true,
        timeout: randomNumber(20000, 25000),
      });
      await this.page.evaluate(() => {
        const commentBox = document.querySelector("#simple-box");
        if (commentBox) {
          commentBox.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });

      Logger.info("Clicking on the comment box...");
      await this.page.waitForSelector("#placeholder-area", {
        visible: true,
        timeout: randomNumber(15000, 18000),
      });
      await this.page.simulateMouseClick("#placeholder-area");

      Logger.info("Waiting for the text input box to be ready...");
      await this.page.waitForSelector("#contenteditable-root", {
        visible: true,
        timeout: randomNumber(12000, 18000),
      });
      await this.page.click("#contenteditable-root");
      let waitSeconds = randomNumber(
        configData.waitWatchMinTimeout * 1000,
        configData.waitWatchMaxTimeout * 1000
      );
      Logger.info(`正在观看视频,等待${waitSeconds / 1000}秒...`);
      await delay(waitSeconds);
      Logger.info(`正在输入评论...${comment}`);
      await this.page.simulateTyping("#contenteditable-root", comment);
      Logger.info("准备提交评论...");
      await this.page.keyboard.press("Enter");
      await this.page.simulateMouseClick(
        "#submit-button > yt-button-shape > button > yt-touch-feedback-shape > div"
      );
      if (baseConfig.isCommentSuccess) {
        Logger.info("正在验证评论是否成功...");
        // 刷新页面
        await this.page.reload();
        await delay(baseConfig.checkCommentTimeOut * 1000);
        await this.clickOrderComment();
        let commentList = (await this.collectAllComments()).map(
          (item) => item.content
        );
        // 判断是否有评论内容
        if (commentList.find((item) => item.trim() === comment.trim())) {
          Logger.success("评论包含在评论列表中");
        } else {
          Logger.error("评论不在评论列表中!");
          commentStatus = "failed";
          // Object
          notifier.notify({
            title: "评论提交失败",
            message: `${videoLink} 评论${comment}失败`,
          });
          if (baseConfig.stopOnCommentFailure) {
            process.exit();
          } else {
            //提交其他评论
            Logger.info("正在提交其他评论...");
            let randomComment = await this.getRandomCommentByConfig(comment);
            Logger.info(`选择的评论: ${randomComment}`);
            await this.page.simulateMouseClick("#placeholder-area");
            await this.page.waitForSelector("#contenteditable-root", {
              visible: true,
              timeout: randomNumber(10000, 12000),
            });
            await this.page.simulateTyping("#contenteditable-root", comment);
            await this.page.keyboard.press("Enter");
            await this.page.simulateMouseClick(
              "#submit-button > yt-button-shape > button > yt-touch-feedback-shape > div"
            );
          }
        }
      }
      // 记录到数据库
      await commentDBCreate({
        username: this.userName,
        video_url: videoLink,
        comment_status: commentStatus,
        comment,
        video_id: videoId,
        date: new Date().toLocaleString("zh-CN"),
        user_email: this.user_email,
      });
      await delay(configData.commentSubmitDelayTime * 1000);
      // 评论成功 等待5s 跳转到下一个视频
      Logger.info(
        `评论提交成功 等待${configData.commentSubmitDelayTime} 跳转到下一个视频`
      );
    } catch (error) {
      Logger.error(`提交评论失败: ${error.message},${error}`);
      // 在失败时记录状态为 "failed"
      await commentDBCreate({
        username: getEnv("USERNAME_GOOGLE"),
        video_url: videoLink,
        comment_status: "failed",
        comment,
        video_id: videoId,
        date: new Date().toLocaleString("zh-CN"),
        error: error.message,
        user_email: this.user_email,
      });
      // throw error; // 可选：抛出错误以便上层处理
    }
  }

  // 直接评论
  async directComment(videoLink: string, comments: string) {
    await this.postComment(videoLink, comments, "success");
  }

  // 随机评论
  async randomComment(videoLink: string) {
    Logger.info("Collecting all comments from the video...");
    const comments = await this.collectAllComments();

    if (comments.length === 0) {
      Logger.warn("No comments found on this video.");
      return;
    }

    Logger.success(`Collected ${comments.length} comments.`);
    const randomComment = comments[Math.floor(Math.random() * comments.length)];
    Logger.info(`Random comment selected: "${randomComment}"`);

    await this.postComment(videoLink, randomComment.content, "success");
  }

  async aiComment(videoLink) {
    Logger.info("Collecting all comments from the video...");
    const comments = await this.collectAllComments();

    if (comments.length === 0) {
      Logger.warn("No comments found on this video.");
      return;
    }
  }
}
