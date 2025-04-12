// db/schema/comment.ts
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { eq, and } from "drizzle-orm";
import { db } from "models/index";

// 定义 Comment 表
export const CommentDB = sqliteTable("comment", {
  username: text("username"),
  video_url: text("video_url"),
  comment_status: text("comment_status"),
  comment: text("comment"),
  video_id: text("video_id"),
  // 评论时间
  date: text("date"),
  error: text("error"),
  user_email: text("user_email"),
});

// 类型定义
export type Comment = typeof CommentDB.$inferSelect;
export type NewComment = typeof CommentDB.$inferInsert;

// 独立的 commentDBfindOne 函数
export async function commentDBfindOne({
  where,
}: {
  where: Partial<Comment>;
}): Promise<Comment | null> {
  const conditions = Object.entries(where).map(([key, value]) =>
    eq(CommentDB[key as any], value)
  );

  return await db
    .select()
    .from(CommentDB)
    .where(and(...conditions))
    .limit(1)
    .then((results) => results[0] || null);
}
// 创建 commentDBCreate 函数
export async function commentDBCreate(data: NewComment): Promise<Comment> {
  const [result] = await db.insert(CommentDB).values(data).returning(); // 返回插入的记录

  return result;
}
