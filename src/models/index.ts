// db/index.ts
import { sql } from "drizzle-orm";
import { CommentDB } from "./Comment";
import { SessionDB } from "./Session";
import { db } from "#database/init";

async function initialize() {
  // 创建 comment 表
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS comment (
      username TEXT,
      video_url TEXT,
      comment_status TEXT,
      comment TEXT,
      video_id TEXT,
      date TEXT,
      error TEXT,
      user_email TEXT
    )
  `);

  // 创建 session 表
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS session (
      username TEXT UNIQUE,
      sessionDir TEXT,
      login_status TEXT
    )
  `);
  console.log("Database tables initialized");
}
export { initialize, db, CommentDB, SessionDB };
