import { getEnv } from "#config/index";
import { delay } from "#utils/delay";
import Logger from "#utils/Logger";
import { randomDelay, randomNumber } from "#utils/randomDelay";
import { time } from "console";
import { SessionDB } from "models/index";
import { sessionDBUpsert } from "models/Session";
import { Page } from "puppeteer";

export default class LoginYoutube {
  page: Page;
  // 邮箱
  email: string = getEnv("EMAIL");
  // 密码
  password: string = getEnv("PASSWORD");

  constructor(pages, email, password) {
    this.page = pages;
    this.email = email;
    this.password = password;
  }

  async login() {
    try {
      Logger.info("Setting up browser headers and user agent...");
      await this.page.setExtraHTTPHeaders({
        "Accept-Language": "en-US,en;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
      });
      await this.page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
      );

      Logger.info("Navigating to Google Account Info Page...");
      await this.page.goto("https://myaccount.google.com/personal-info?pli=1", {
        waitUntil: "networkidle0",
      });
      const hasLogin = await this.page.evaluate(() => {
        const elements = document.querySelector(
          "#i12 > div > div.zTjtYe > div"
        );
        return elements !== null;
      });
      if (hasLogin) {
        Logger.success("Already logged in.");
        await sessionDBUpsert({
          username: this.email,
          sessionDir: getEnv("SESSION_DIR_" + this.email),
          login_status: "success",
        });
        // 跳转到youtube首页
        await this.page.goto("https://www.youtube.com/");
        return true;
      } else {
        Logger.warn("User not logged in. Proceeding to login...");
      }
      // ✅ Navigate to Login Page
      Logger.info("Navigating to Google Login Page...");
      await this.page.goto(
        "https://accounts.google.com/v3/signin/identifier?continue=https%3A%2F%2Fwww.youtube.com%2Fsignin%3Faction_handle_signin%3Dtrue%26app%3Ddesktop%26hl%3Den%26next%3Dhttps%253A%252F%252Fwww.youtube.com%252F%253FthemeRefresh%253D1&ec=65620&hl=en&ifkv=AeZLP9_9zvAmir7Pg7TsXbdot1JS1Aihdz4-s09f1W0AHcGAlUl7JArUSY0p8rHx3W1azNTqcUtbfg&passive=true&service=youtube&uilel=3&flowName=GlifWebSignIn&flowEntry=ServiceLogin&dsh=S-99093102%3A1736179702641005&ddm=1"
      );

      // ✅ Enter Username
      Logger.info("Typing username...");
      const usernameSelector = "#identifierId";
      await this.page.waitForSelector(usernameSelector, {
        visible: true,
        timeout: 10000,
      });

      await this.page.type(usernameSelector, this.email, {
        delay: randomNumber(100, 300),
      });
      await this.page.keyboard.press("Enter");
      await randomDelay(1000, 2000);

      // ✅ Enter Password
      Logger.info("Typing password...");
      const passwordSelector = 'input[type="password"]';
      await this.page.waitForSelector(passwordSelector, {
        visible: true,
        timeout: 10000,
      });
      await this.page.type(passwordSelector, this.password, {
        delay: randomNumber(100, 300),
      });
      await this.page.keyboard.press("Enter");
      await this.page.waitForNavigation({ waitUntil: "networkidle0" });

      // ✅ Check for Login Errors
      const errorSelector = 'span[jsname="B34EJ"]';
      const errorExists = await this.page
        .waitForSelector(errorSelector, { visible: true, timeout: 5000 })
        .catch(() => null);

      if (errorExists) {
        const errorMessage = await this.page.$eval(
          errorSelector,
          (el) => el.textContent?.trim() || "Unknown error"
        );
        Logger.error(`Login failed: ${errorMessage}`);
        await delay(5000);
        await this.page.browser().close();
        return;
      }

      // ✅ Verify Successful Login
      Logger.info("Verifying successful login...");

      Logger.success("Login successful! Redirecting to dashboard...");
      await sessionDBUpsert({
        username: this.email,
        sessionDir: getEnv("SESSION_DIR_" + this.email),
        login_status: "success",
      });
    } catch (error) {
      Logger.error(`Unexpected error during login: ${error.message}`);
      await delay(5000);
      await this.page.browser().close();
    }
  }
}
