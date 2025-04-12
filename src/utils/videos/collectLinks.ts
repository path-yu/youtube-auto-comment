import { Page } from "puppeteer";

export async function collectLinks(page) {
  const videoLinks = await page.$$eval(
    "ytd-video-renderer a#thumbnail",
    (anchors) => {
      return anchors
        .map((anchor) => {
          const isLive =
            anchor
              .closest("ytd-video-renderer")
              ?.querySelector(
                'ytd-badge-supported-renderer svg path[d*="M9 8c0 .55-.45 1-1 1"]'
              ) !== null;
          return { href: anchor.href, isLive };
        })
        .filter((item) => item.href && !item.isLive)
        .map((item) => item.href);
    }
  );

  return videoLinks;
}
