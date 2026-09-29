# Claude 多入口用量接入（v5）

这个版本扩展原来的 Tokscale → GitHub 流程。Claude Code 的 CLI、Desktop Code 和 VS Code 官方扩展使用本地真实 usage 日志；普通 Chat 通过官方导出导入。**普通 Chat 无真实 usage 时只能单列可见文本估算，不能宣称已获得完整 token 消耗。**

## 当前交付状态

- 新版本独立于原项目，原有 LaunchAgent、Tokscale 全局配置和远程仓库未被本次迭代修改。
- 新版已经在本机执行本地扫描并生成 README；顶部 Tokscale 总量仍来自项目已有的历史快照。
- 普通 Chat 当前等待真实导出文件。未读取 Cookie、未抓取私有聊天接口、未修改 Claude 应用。
- 新版代码尚未发布到 GitHub，也尚未替换原有定时任务。

## 三种入口如何采集

| 入口 | 数据来源 | 限制 |
| --- | --- | --- |
| Desktop 的 Code 模式 | 默认 Claude Code 日志和 Desktop `claude-code-sessions` 下的 JSONL | 仅本机可读取的会话；云端、SSH、VM 内没有落到本机的日志不会凭空出现 |
| VS Code 官方 Claude Code 扩展 | 与 CLI 共享的 Claude Code 日志 | `entrypoint` 有 VS Code 标记时单列；否则保留为入口未知，不根据安装了扩展就猜测来源 |
| Claude Code CLI | `.claude/projects`、`.claude/transcripts`、`.config/claude`，以及 `CLAUDE_CONFIG_DIR` 指向的目录 | 依赖实际保留的 JSONL；已删除的日志无法通过这个扫描器恢复 |
| 普通 Chat | 官方 `conversations.json` 或包含该文件的 ZIP | 导出通常没有 usage，且通常无法区分 Desktop、网页和手机端；需要后续重新导出才能刷新 |

Code 统计遵循 provider message ID + request ID 去重；同一次回复的流式快照按字段取最大值，复制和恢复会话不重复计数。不同入口共享同一回复时归入“跨入口共享会话”。报告只统计 assistant 的 request usage，不把 context 大小或套餐百分比转成 tokens。自定义 provider 的 DeepSeek 等模型也可能出现在 Claude Code 客户端日志中。

本地 Code 明细是 Tokscale 的部分数据视图，不与其总量重复相加。同步时用 `TOKSCALE_EXTRA_DIRS` 将额外日志根目录交给 Tokscale，原始日志不会提交到 GitHub。

## 本地扫描与验证

需要 Node.js 18+；测试和 ZIP 导入还需要 Python 3。没有新增 npm 依赖。

在**新版项目目录**执行：

```bash
npm test                 # 验证去重、数据缺失、隐私字段、Chat 导入和同步计划
npm run scan:claude       # 只扫描本机日志与已导入的 Chat 数字，刷新本地 README，不上传
npm run sync:tokens      # 默认仅预览同步步骤，不执行 Git、网络或写文件操作
```

`data/claude-usage.json` 是可发布的聚合快照，不含正文、标题、会话 ID 或绝对路径。README 中 `—` / “尚未发现”代表无可归属的数据，不能解释为实际消耗为零。顶部图和原来的 AI Usage 表格不会因为本地扫描而被新明细重复加总。

## 接入普通 Chat

在 Claude Desktop 或网页版的 **Settings → Privacy → Export data** 获取官方导出。导出可能包含整个 Claude 账户的聊天历史；普通 Chat 的真实消耗通常无法从导出恢复。

将文件保留在仓库之外，传入绝对路径：

```bash
npm run import:claude-chat -- /absolute/path/conversations.json  # 导入 JSON、去重、生成本地聚合报告
npm run import:claude-chat -- /absolute/path/claude-export.zip   # 从 ZIP 内存读取 conversations.json，不解压其他文件
```

同一个导出重复导入不会累加。新导出更新同一消息的数字；没有 usage 的新版本不会抹掉以前已有的真实 usage。只有哈希 ID、日期、数字和附件存在标记写入被 Git 忽略的 `.private/claude-chat-ledger.json`，不保存聊天文本或标题。ZIP 内须恰有一个 `conversations.json`，解压后大小上限为 128 MiB。

普通 Chat 单列两项，**两项不能相加，也不进入 Tokscale 排名或顶部热力图**：

1. **导出记录中报告的 tokens**：仅接受 assistant `usage` / `token_usage` 中真实的 `input_tokens`、`output_tokens`，以及可选缓存读写 tokens。没有字段就显示“不可获取”，不填 0。
2. **可见文本 token 估算**：粗略公式为 `ceil(ASCII 字符数 / 4 + 非 ASCII Unicode 码点数)`，每条可见文本只计一次。它不是 Claude tokenizer，也不是实际计费量或消耗下限；不包括历史上下文重发、隐藏推理、系统提示、附件和工具。它只适合观察导出文字规模。

官方导出无法标记 Desktop 来源时，报告明确使用“Claude 账户 Chat”，不伪装成 Desktop 专属精确统计。要禁用估算，可在单次导入加 `--no-estimates`；要隐藏已有估算，在本地配置中设置 `chatTextEstimates: false`。

## 非默认日志位置

按需新建 `.private/claude-usage.local.json`（Git 忽略），格式如下：

```json
{
  "timeZone": "Asia/Shanghai",
  "chatTextEstimates": true,
  "includeDefaultRoots": true,
  "extraCodeRoots": [
    { "path": "/absolute/path/exported-desktop-code-logs", "surface": "desktop-code" },
    { "path": "/absolute/path/vscode-profile/projects", "surface": "vscode" }
  ]
}
```

`extraCodeRoots` 填本机实际存在的绝对目录；`surface` 可用 `desktop-code`、`vscode`、`cli`、`unknown`。记录自己的 `entrypoint` 优先于目录提示。远程日志需先由用户放到配置的本地目录。`includeDefaultRoots: false` 用于只统计指定的归档，不扫描默认本机日志。时区应与 Tokscale 现有分日设置保持一致；更换时区须使用新 Chat ledger 重新导入，不能混合已有日期分桶。

## 发布与定时任务接入

本次只准备了新版，未推送、未运行上传、未切换旧任务。先审阅并将代码部署到目标仓库分支，再使用 v5；旧的定时任务仍指向原项目 v4。

```bash
npm run sync:tokens -- --dry-run  # 审阅完整计划
npm run sync:tokens -- --publish  # 在部署分支发布已准备的聚合文件，再采集、上传 Tokscale、刷新并推送 GitHub
```

默认部署目标是 `origin/main`，可用现有 `TOKSCALE_PROFILE_REMOTE` / `TOKSCALE_PROFILE_BRANCH` 指定。发布会检查当前分支和工作区；导入/扫描产生的已知聚合文件允许先单独提交保存，代码修改、删除和既有暂存内容会阻止发布。冲突、测试失败或采集失败时停止，不使用自动“选择某一方”策略。无新变化时跳过空提交。原有登录方式继续使用，Chat 导入和本地扫描不需要账户凭据。

若之后将 macOS 定时任务切换到新版，执行入口必须是本项目的 `scripts/sync-token-now-v5.mjs --publish`，工作目录也须指向部署后的新版；仅替换脚本路径而漏掉 `--publish` 会变成预览。不要同时让多个旧任务和新版向同一工作副本写入。

GitHub Actions 无法读取你电脑上的日志，只能保留/展示本机先前推送的聚合快照。三个现有刷新工作流调用的 README 生成器现已保留 Claude 分区；Chat 新数据仍需本机重新导入并发布。

## 依据

- [Tokscale 数据源和扫描路径说明](https://github.com/junhoyeo/tokscale/blob/main/README.md)
- [Claude Code：VS Code 与 CLI 共享会话历史](https://code.claude.com/docs/en/vs-code#switch-between-extension-and-cli)
- [Claude 官方数据导出说明](https://support.claude.com/en/articles/9450526-export-your-claude-data)

普通个人账户 Chat 尚无本项目可用的、自动提供完整实际 token 账单的官方来源。这个限制不能通过把套餐使用百分比或文本估算改名为“真实 tokens”解决。
