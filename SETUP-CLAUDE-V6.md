# Claude 多入口采集 v6

v6 在 v5 的新副本中实现，旧项目与原始 Claude 数据不改动。它解决 Desktop IndexedDB 漏采、缓存清理导致历史丢失、跨入口重复统计、上传故障阻断采集，以及没有数据却被当作零的问题。**不能保证一个消费级 Claude 账户的全部真实 token 均可恢复。**

## 入口和当前边界

| 入口 | 自动采集来源 | 不能据此保证的内容 |
|---|---|---|
| Claude Code CLI | `.claude/projects`、`transcripts`、`.config/claude`、`CLAUDE_CONFIG_DIR` 和额外目录中的 JSONL | 远程主机、禁用日志、删除且未采过的历史 |
| VS Code 官方扩展 | 共享 Claude Code 日志，支持 `claude-vscode` 入口标记 | 远程 SSH / 容器日志须先落到配置目录；无入口标记的消息不猜测归属 |
| Desktop Code | 官方 `Claude/claude-code-sessions` 中的 JSONL；支持缓存里标记为 code 的事件 | 未下载到本机的云端会话不能保证覆盖 |
| Desktop Cowork | `Claude/IndexedDB/https_claude.ai_0.indexeddb.leveldb` 与 blob 中的真实消息 usage | 缓存只保留部分历史，输出可能为流式中间计数；`hasOlder` 会显示缺失 |
| 普通 Chat | 手动官方导出后，自动导入收件目录的新 JSON/ZIP；命令行导入同样支持 | 尚未验证到普通 Chat 的自动实时真实 usage 数据源；导出无 usage 时只能记录聊天数量和独立文本估算 |

CLI 和 VS Code 的日志路径依据官方文档与本机扩展检查。当前机器实测有 Cowork usage；CLI、官方 Desktop Code 与 VS Code **尚未发现可归属的 Claude 模型真实记录**，支持解析不等于已验证实际使用。第三方客户端中的 DeepSeek 用量单列，不充当官方 Desktop 验收样本。

## 统计规则

- 同一 provider message ID 在 Desktop、VS Code 和 CLI 出现时只计一次；`requestId` / `request_id` / 缺失的传输 ID 不制造新回复。同一回复的流式字段取已观测最大值。
- 只加 input、output、cache-read、cache-creation 四个字段；不再加 cache_creation 的细分字段。
- `result.modelUsage` 是会话累计量，不逐条相加，不与消息 usage 混加。缺少周初基线时不拿累计量伪造周用量。
- 本地只保留哈希标识、日期、模型、入口与数字。台账为 `.private/claude-numeric-ledger-v6.json`，权限 0600；公共 JSON 仅有聚合，不含消息标识、正文和本机路径。
- 台账持续合并，所以清理源缓存后已采数字保留；每天保存一个私有台账备份，保留 14 天。缓存被删除前从未采到的数字无法补回。
- GitHub 的 Claude 分区展示新增台账；与顶部 Tokscale 总量可能重叠，二者不相加。Desktop 新增缓存用量没有伪装成 JSONL 上传 Tokscale 排名。

## 运行

Node.js 18+、Python 3.10+ 和 uv。Desktop 解析依赖固定 Git 提交及版本：

```bash
uv venv .private/desktop-python
uv pip install --python .private/desktop-python/bin/python -r scripts/desktop-requirements.txt
npm test                  # 回归、跨入口去重、隐私、缓存丢失和 Chat 自动导入
npm run collect:claude     # 本地采集并生成报告，不上传
npm run sync:claude        # 先保存台账，再按小时发布聚合数据
npm run doctor:claude      # 最近扫描、来源覆盖和发布健康状态
```

重复扫描不会累加；异常时不清空已有台账。台账损坏、时区不一致、并发进程会停止写入。Desktop 单源读取失败时仍保留其他来源的有效记录，并将状态改为异常。

首次配置可新建 `.private/claude-usage.local.json`；v5 的 `timeZone`、`extraCodeRoots`、`includeDefaultRoots` 等仍兼容。还可设置 `desktopIndexedDB`（IndexedDB 父目录）、`desktopPython`（解释器绝对路径）、`desktopEnabled`。默认时区 Asia/Shanghai。VS Code 的 `claudeCode.environmentVariables`、项目设置、远程主机若另设了 `CLAUDE_CONFIG_DIR`，把其 projects/transcripts 路径加入 extraCodeRoots；后台进程无法自动继承所有编辑器窗口的环境。

## 普通 Chat 的实际接入步骤

1. 在 Claude 官方 Settings → Privacy 导出数据。
2. 把 `conversations.json` 或官方导出 ZIP 放入新版项目的 `.private/chat-imports/`。
3. 下一次采集自动导入并去重；也可运行 `npm run import:claude-chat -- /absolute/path/export.zip`。

原导出保留在私有收件目录，不上传。新文件按内容哈希检测；坏文件会报告导入错误，不覆盖已有台账。有真实 usage 时单列真实数字；没有时标明“不可获取”。文本估算不等于完整消耗、不与真实 tokens 相加。收件目录不会替用户向 Claude 发起导出申请。

## 自动运行及 GitHub

`python3 scripts/install-collector-macos-v6.py --install` 新建独立 macOS LaunchAgent。每 5 分钟运行，先采集、入账、生成本地报告；最多每小时尝试发布一次。网络失败不丢本地数据，下次重试；不强制推送或自动解决冲突。

发布阶段也会继续提交 Codex/Claude 本地日志到 Tokscale、刷新公开图和更新 DeepSeek 聚合；Tokscale 失败单独记录，不阻断已采 Claude 数据的 GitHub 发布。`TOKSCALE_BINARY` 可指定已安装的 CLI，未指定则使用 npx。

发布用 `.private/github-outbox` 独立 Git 副本，只暂存聚合快照和生成的展示文件。代码部署与定时聚合发布分开，避免把主工作区未提交的其他修改推走。发布之前需要将 v6 的生成器部署至远端，否则旧 GitHub Actions 可能删掉 Claude 分区。

`doctor:claude` 将超过 20 分钟没有新扫描标记为过期；公开页面显示采集时间、最近记录日期、缺失来源和缓存不完整状态。电脑关机、睡眠或未登录期间不会采集；下次登录继续扫描可读取的记录，不能保证保住休眠期间被远端删除的历史。

暂停新版：`launchctl bootout gui/$(id -u)/ai.claude-usage.collector-v6`。旧 plist 保留，回退时恢复旧服务；不要让旧 v4 和新版同时生成并推送同一统计页。

## 依据

- [Claude Code 会话文档](https://code.claude.com/docs/en/sessions)
- [VS Code 与 CLI 共享会话](https://code.claude.com/docs/en/vs-code#switch-between-extension-and-cli)
- [Claude 官方数据导出](https://support.claude.com/en/articles/9450526-export-your-claude-data)
- [Chromium 离线读取器源码](https://github.com/cclgroupltd/ccl_chromium_reader)

IndexedDB 是应用内部格式，升级可能变化。解析失败或出现未知树格式会报告异常/不完整，不宣称采集成功。
