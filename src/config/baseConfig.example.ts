// 定义生成中文评论的函数类型
function generateComments(data: string): string[] {
  return [
    `${data}`,
    // ... 其他评论
  ];
}

// 定义生成英文评论的函数类型
function generateEnComments(data: string): string[] {
  return [
    `${data}`,
    // ... 其他评论
  ];
}

// Account 类型，描述单个账户的配置
interface Account {
  username: string;
  password: string;
  email: string;
  mnemonic: string; // 助记词，可能为空
  searchType: "keyword"; // 当前仅支持 "keyword"，可扩展
}

// Preferences 类型，描述搜索偏好
interface Preferences {
  searchType: "keyword"; // 当前仅支持 "keyword"，可扩展
  keywords: string[]; // 分配的关键词数组
}

// Config 类型，扩展 Account 并添加 preferences
interface Config extends Account {
  preferences: Preferences;
}

// ConfigData 类型，描述整个配置对象
interface ConfigData {
  searchType: "keyword" | "trending"; // 搜索类型
  keyword: string; // 默认单个关键词
  sortBy: 0 | 1 | 2 | 3; // 搜索排序：0 相关程度, 1 上传日期, 2 观看次数, 3 评分
  videoType: 0 | 1 | 2; // 视频类型：0 视频, 1 频道, 2 播放列表
  videoDuration: 0 | 1 | 2; // 视频时长：0 <4分钟, 1 4-20分钟, 2 >20分钟
  videoUploadDate: 0 | 1 | 2 | 3 | 4; // 上传日期：0 过去1小时, 1 今天, 2 本周, 3 本月, 4 今年
  commentType: "manual" | "ai" | "copy"; // 评论类型
  manualCommentType?: "json" | "direct"; // 当 commentType 为 "manual" 时使用
  comment: string[]; // 中文评论数组，由 generateComments 生成
  enComment: string[]; // 英文评论数组，由 generateEnComments 生成
  language: "zh-CN" | "en-US"; // 语言，支持中文或英文
  keywords: string[]; // 关键词数组，用于分配
  whiteAuthorNameList: string[]; // 白名单作者列表
  repeatCount: number; // 重复次数
  repeatTimeOut: number; // 重复间隔时间（秒）
  waitWatchMaxTimeout: number; // 观看视频最大超时时间（秒）
  waitWatchMinTimeout: number; // 观看视频最小超时时间（秒）
  commentSubmitDelayTime: number; // 评论提交成功延迟跳转（秒）
  isCommentSuccess: boolean; // 是否检测评论成功
  checkCommentTimeOut: number; // 评论检测延迟时间（秒）
  stopOnCommentFailure: boolean; // 评论失败是否停止程序
  retryCommentCount: number; // 评论重试次数
  hasAlreadyWatchFilter: boolean; // 是否过滤已观看视频
  commentKeyword: string[]; // 评论相关关键词
  accounts: Account[]; // 账户数组
}

// 默认助记词
const defaultStr: string = "";

// 默认配置对象
const configData: ConfigData = {
  searchType: "keyword",
  keyword: "btc",
  sortBy: 2,
  videoType: 0,
  videoDuration: 1,
  videoUploadDate: 1,
  commentType: "manual",
  manualCommentType: "json",
  comment: generateComments(defaultStr),
  enComment: generateEnComments(defaultStr),
  language: "zh-CN",
  keywords: [
    // "TRX"
  ],
  whiteAuthorNameList: [""],
  repeatCount: 5,
  repeatTimeOut: 5,
  waitWatchMaxTimeout: 460,
  waitWatchMinTimeout: 400,
  commentSubmitDelayTime: 5,
  isCommentSuccess: true,
  checkCommentTimeOut: 10,
  stopOnCommentFailure: false,
  retryCommentCount: 3,
  hasAlreadyWatchFilter: true,
  commentKeyword: [],
  accounts: [
    {
      username: "",
      password: "",
      email: "",
      mnemonic: "",
      searchType: "keyword",
    },
    {
      username: "",
      password: "",
      mnemonic: "",
      email: "",
      searchType: "keyword",
    },
  ],
};

export default configData;
export { Config, ConfigData, Account, Preferences };
