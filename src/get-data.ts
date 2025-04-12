import innertubeClient from "#utils/innerTube";
import fs from "fs";
import { CommentDB, db, initialize } from "models";
import { commentDBCreate } from "models/Comment";
import path from "path";
import Innertube from "youtubei.js";

// // // 写入到data.json
let dataDir = path.join(process.cwd(), "data.json");
// const allComment = db.select().from(CommentDB).all();
(async () => {
  await initialize();
  // // 4. 查询所有数据
  const allComment = db.select().from(CommentDB).all();
  console.log("allComment", allComment.length);
  // 1;
  // await commentDBCreate({
  //   username: "@yanzhihao",
  //   video_url: "https://www.youtube.com/shorts/3d7Ue1JuDSs",
  //   comment_status: "commentStatus",
  //   comment: "",
  //   video_id: "",
  //   date: new Date().toLocaleString("zh-CN"),
  //   user_email: "this.user_email",
  // });
  // let lastComment = allComment[allComment.length - 1];

  // Create Innertube instance once to reuse
  // const innertube = await innertubeClient.innertube;
  // const res = await innertube.getComments("Ks_QkNTbGJY", "NEWEST_FIRST");
  // let data = res.contents.map((item) => {
  //   let comment = item.comment.content.text;
  //   let author = item.comment.author.name;
  //   return {
  //     comment,
  //     author,
  //     id: item.comment.comment_id,
  //   };
  // });
  // console.log(data);
  // // 过滤掉null
  // fs.writeFileSync(dataDir, JSON.stringify(allComment, null, 2), "utf-8");
})();

// console.log("allComment", allComment.length);

// 读取data.json
// let data = fs.readFileSync(dataDir, "utf-8");
// let dataJson = JSON.parse(data);
// // 将data.json数据写入到  CommentDB
// console.log(dataJson.length);
// // 批量插入数据
// async function batchInsert() {
//   await db.insert(CommentDB).values(dataJson);
//   console.log(`成功插入 ${dataJson.length} 条数据！`);
// }
// batchInsert().catch((err) => console.error("批量插入失败：", err));

// async function deleteAllData() {
//   await db.delete(CommentDB); // 删除 users 表中的所有数据
//   console.log("所有数据已删除！");
// }
// deleteAllData();
