# XxJjTt6 GitHub Profile Setup

这是一套可直接放进 `XxJjTt6/XxJjTt6` 个人主页仓库的 Tokscale 风格 README 方案。
主页顶部使用 Tokscale 官方动态 Embed，而不是仓库里的本地静态 SVG。

## 文件用途

- `README.md`：GitHub 个人主页正文，顶部引用 Tokscale 官方动态 Embed：`https://tokscale.ai/api/embed/XxJjTt6/svg?theme=light&compact=1`。
- `assets/tokscale-ai-usage-card.svg`：旧版本地预览卡片，README 不再引用。
- `assets/tokscale-ai-token-heatmap.svg`：旧版本地热力图，README 不再引用；真实交互热力图请打开 Tokscale 公开页。
- `data/tokscale-graph.json`：Tokscale 原始聚合图数据，只包含日期、client、model、token、cost、messages 等聚合信息。
- `data/tokscale-summary.json`：本项目渲染 README 和 SVG 用的摘要数据。
- `scripts/update-from-tokscale.mjs`：从本机 Tokscale 重新导出 Codex + Claude Code 用量，并重新生成 README/SVG。
- `scripts/fetch-tokscale-public.mjs`：从 `https://tokscale.ai/u/XxJjTt6` 拉取公开真实数据，并重新生成 GitHub 主页需要的数据。
- `.github/workflows/refresh-tokscale-profile.yml`：GitHub Actions 定时刷新公开 Tokscale 数据并提交更新。

## 首次发布

1. 克隆你的个人主页仓库：

```bash
git clone git@github.com:XxJjTt6/XxJjTt6.git
```

2. 把本目录中的这些内容复制到仓库根目录：

```bash
cp README.md /path/to/XxJjTt6/
cp package.json /path/to/XxJjTt6/
cp -R assets data scripts tests /path/to/XxJjTt6/
```

3. 在个人主页仓库里验证：

```bash
npm test
npm run generate -- --graph data/tokscale-graph.json --rank "#453"
```

4. 提交并推送：

```bash
git add README.md package.json assets data scripts tests
git commit -m "feat: add AI usage profile"
git push
```

## 日常更新

在你的电脑上运行：

```bash
npm run refresh -- --rank "#453"
```

如果只想使用 Tokscale 公开页的数据刷新 GitHub 主页：

```bash
npm run refresh:public
```

## 真实动态机制

- README 顶部卡片使用 Tokscale 官方动态接口 `tokscale.ai/api/embed/...`，读取 Tokscale 公开页数据，呈现形式与 gaofeng21cn 的主页一致。
- GitHub README 不能运行 Tokscale 页面里的交互式 JavaScript，因此不再把本地生成的热力图放到主页里；需要看真实交互热力图时点击顶部 Tokscale 卡片进入公开页。
- GitHub Actions 每小时从 Tokscale 公开页拉取一次真实聚合数据，用于刷新 README 下方的每日/每周/每月表格。
- 本机 Codex / Claude Code 的最新用量需要先提交到 Tokscale，GitHub Actions 才能拿到公开数据。

## Tokscale 公开排名

公开排名需要你显式登录并提交数据：

```bash
npx -y tokscale@latest login
npx -y tokscale@latest submit --client codex,claude
```

当前数据已用 Tokscale 提交过一次，公开页为 `https://tokscale.ai/u/XxJjTt6`。以后 Tokscale 排名变化时，公开刷新脚本会自动读取新排名。
