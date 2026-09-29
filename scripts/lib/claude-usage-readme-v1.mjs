const LABELS = {
  "desktop-code": "Claude Desktop · Code",
  "desktop-cowork": "Claude Desktop · Cowork", "desktop-chat": "Claude Desktop · Chat 缓存",
  "desktop-unclassified": "Desktop · 模式未标记", "desktop-thirdparty": "第三方 Desktop 客户端", vscode: "VS Code · Claude Code", cli: "Claude Code CLI",
  shared: "跨入口共享会话（只计一次）", unknown: "Claude Code（入口未标记）"
};
const issueLabel = (issue) => ({
  DESKTOP_FORMAT_UNSUPPORTED: "Desktop 缓存格式出现未支持的记录", DESKTOP_HISTORY_PARTIAL: "Desktop 历史缓存不完整", CHAT_EXPORT_REQUIRED: "普通 Chat 等待导出",
  CHAT_USAGE_UNAVAILABLE: "Chat 导出缺少真实 usage", CHAT_IMPORT_ERROR: "Chat 导入失败",
  DESKTOP_COLLECTOR_ERROR: "Desktop 读取失败", TRANSCRIPT_READ_ERRORS: "部分日志读取失败",
  CLI_NOT_OBSERVED: "CLI 尚未验证到记录", VSCODE_NOT_OBSERVED: "VS Code 尚未验证到记录",
  "DESKTOP-CODE_NOT_OBSERVED": "Desktop Code 尚未验证到记录"
}[issue] ?? "存在未识别的覆盖问题");
const number = (value) => value.toLocaleString("en-US");

export function renderClaudeUsage(snapshot) {
  if (!snapshot) return "";
  const code = snapshot.observedClaude ?? snapshot.code;
  const chat = snapshot.chat;
  const rows = Object.entries(LABELS).map(([key, label]) => {
    const stats = code.surfaces[key];
    const lastDate = code.coverage?.[key]?.lastRecordDate ?? "—";
    return stats?.status === "observed"
      ? `| ${label} | ${number(stats.totalTokens)} | ${number(stats.messages)} | ${lastDate} | 已发现记录；非完整账单 |`
      : `| ${label} | — | — | ${lastDate} | 尚未发现可归属的记录 |`;
  }).join("\n");
  const chatStatus = chat.status === "awaiting-export"
    ? "等待导入官方 conversations.json 或导出 ZIP；当前没有普通 Chat 数据。"
    : "已导入 Claude 账户聊天记录。导出数据通常不能区分 Desktop、网页和手机端。";
  const measured = chat.reportedTokens ? number(chat.reportedTokens.totalTokens) : "不可获取";
  const estimate = chat.textEstimate ? `约 ${number(chat.textEstimate.tokens)}` : "未估算";
  const partial = snapshot.code.diagnostics.invalidLines || snapshot.code.diagnostics.unreadableEntries
    ? "\n> 部分日志解析失败或不可读取，本地明细可能不完整。\n" : "";
  return `
## Claude 多入口用量

以下为本机保留日志的去重明细，采集时间：${snapshot.generatedAt}（按 ${snapshot.timeZone} 分日）。
本节为已采集并保存在本地台账中的 Claude 模型用量，CLI、VS Code、Desktop 按消息 ID 去重。与上方 Tokscale 历史图可能重叠，不再次叠加到上方总量；Desktop 新增缓存记录尚不写入 Tokscale 排名。缓存读取也计入 tokens，不等于新生成文字。第三方模型不计入本节 Claude 总量。

**覆盖不是完整账户账单。** ${snapshot.health ? `当前状态：${snapshot.health.status === "degraded" ? "采集异常" : "部分覆盖"}；提示：${snapshot.health.issues.map(issueLabel).join("；") || "无"}。` : ""}
${snapshot.desktop ? `Desktop 可读会话 ${snapshot.desktop.diagnostics.conversations ?? 0} 个，其中 ${snapshot.desktop.diagnostics.conversationsWithOlderUncachedMessages ?? 0} 个有未缓存的更早消息；读取状态：${snapshot.desktop.status === "partial-cache" ? "已采到缓存记录" : snapshot.desktop.status === "error" ? "读取失败" : "未验证到真实用量"}。` : ""}

| 使用入口 | 日志报告的 tokens | 唯一回复数 | 最近记录日期 | 覆盖状态 |
| --- | ---: | ---: | --- | --- |
${rows}
${snapshot.observedClaude ? `\n已记录 Claude tokens 小计：**${number(code.totals.totalTokens)}**；这不是完整账户总量。其他模型另计 ${number(code.otherModels.totalTokens)} tokens。\n` : ""}
${partial}
### Claude 普通 Chat

${chatStatus}

| 指标 | 数值 |
| --- | ---: |
| 导入消息数 | ${number(chat.messages)} |
| 带真实 usage 的回复 | ${number(chat.measuredReplies)} |
| 缺少 usage 的回复 | ${number(chat.repliesWithoutUsage)} |
| 导出记录中报告的 tokens | ${measured} |
| 可见文本 token 估算 | ${estimate} |

文本估算仅衡量导出文字量，不代表实际消耗：未计入历史上下文重复发送、系统提示、隐藏思考、工具或附件；它也不是实际消耗的下限。真实 usage 与文本估算不相加。普通 Chat 的这两项均单列展示，不写入 Tokscale 排名和顶部热力图。

本节仅发布按日期和入口聚合的数字，不发布聊天正文、会话 ID 或本机路径。[接入与限制说明](./SETUP-CLAUDE-V6.md) · [聚合数据](./data/claude-usage.json)
`;
}
