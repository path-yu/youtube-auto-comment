// db/schema/session.ts
import { eq } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { db } from "models/index";

export const SessionDB = sqliteTable("session", {
  username: text("username"),
  sessionDir: text("sessionDir"),
  login_status: text("login_status"),
});

// Type exports for TypeScript usage
export type Session = typeof SessionDB.$inferSelect;
export type NewSession = typeof SessionDB.$inferInsert;

// 创建 sessionDBUpsert 函数
export async function sessionDBUpsert(data: any): Promise<Session> {
  // 尝试查找现有记录
  const existing = await db
    .select()
    .from(SessionDB)
    .where(eq(SessionDB.username, data.username))
    .limit(1)
    .then((results) => results[0]);

  if (existing) {
    // 如果记录存在，更新它
    const [updated] = await db
      .update(SessionDB)
      .set({
        sessionDir: data.sessionDir,
        login_status: data.login_status,
      })
      .where(eq(SessionDB.username, data.username))
      .returning();
    return updated;
  } else {
    // 如果记录不存在，插入新记录
    const [inserted] = await db.insert(SessionDB).values(data).returning();
    return inserted;
  }
}
