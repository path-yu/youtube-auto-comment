import Logger from "#utils/Logger";
import Innertube from "youtubei.js";
import { ShortsLockupView, Video } from "youtubei.js/dist/src/parser/nodes";

export type UploadDate = "all" | "hour" | "today" | "week" | "month" | "year";
export type SearchType = "all" | "video" | "channel" | "playlist" | "movie";
export type Duration = "all" | "short" | "medium" | "long";
export type SortBy = "relevance" | "rating" | "upload_date" | "view_count";

export async function batchSearchVideos(data: {
  queries: string[]; // Changed from single query to array of queries
  upload_date?: UploadDate;
  duration?: Duration;
  sort_by?: SortBy;
  lang?: string;
  max_results_per_query?: number; // Optional limit per query
  // 是否过滤
  filter?: boolean;
}) {
  const {
    queries,
    upload_date = "all",
    duration = "all",
    sort_by = "relevance",
    lang = "zh-CN",
    filter = true,
  } = data;

  // Create Innertube instance once to reuse
  const innertube = await Innertube.create({ lang });
  innertube.getHomeFeed();
  // Store all results and unique IDs across all queries
  const allResults: any[] = [];
  const uniqueIds = new Set<string>();

  // Process each query sequentially
  for (const query of queries) {
    try {
      const search = await innertube.search(query, {
        upload_date,
        duration,
        sort_by,
      });
      Logger.info(`Searching for keyword: ${query}`);
      Logger.info(`Found ${search.videos.length} results.`);
      const queryResults = search.videos
        .map((item) => {
          let newItem = {} as any;

          if (item.type === "Video") {
            item = item as Video;
            newItem = {
              type: "Video",
              id: item.video_id,
              title: item.title.text,
              cover: item.thumbnails[0].url,
              published_at: item.published?.text,
              viewCount: item.view_count?.text,
              duration: item.duration?.text,
              link: "https://www.youtube.com/watch?v=" + item.video_id,
              query: query, // Add the query that found this result
            };
          } else if (item.type === "ShortsLockupView") {
            item = item as ShortsLockupView;
            newItem = {
              id: item.inline_player_data?.payload.videoId,
              title: item.overlay_metadata.primary_text?.text,
              cover: item.thumbnail[0].url,
              viewCount: item.overlay_metadata.secondary_text?.text,
              duration: null,
              published_at: null,
              type: "ShortsLockupView",
              link:
                "https://www.youtube.com/watch?v=" +
                item.inline_player_data?.payload.videoId,
              query: query, // Add the query that found this result
            };
          } else {
            console.log("Unknown type:", item.type, item);
            return null;
          }

          // Skip if ID already exists or invalid
          if (!newItem.id || (uniqueIds.has(newItem.id) && filter)) {
            return null;
          }

          uniqueIds.add(newItem.id);
          return newItem;
        })
        .filter((item) => item !== null); // Remove null entries

      allResults.push(...queryResults);
    } catch (error) {
      console.error(`Error searching for query "${query}":`, error);
    }
  }
  return allResults;
}
