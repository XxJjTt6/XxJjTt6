# XxJjTt6 GitHub Profile Setup

这是一套可直接放进 `XxJjTt6/XxJjTt6` 个人主页仓库的 Tokscale 风格 README 方案。

## 文件用途

- `README.md`：GitHub 个人主页正文，引用下面两个 SVG。
- `assets/tokscale-ai-usage-card.svg`：模仿 gaofeng21cn 截图中的 Tokscale 用量卡片。
- `assets/tokscale-ai-token-heatmap.svg`：模仿 GitHub contributions 的每日 token 热力图。
- `data/tokscale-graph.json`：Tokscale 原始聚合图数据，只包含日期、client、model、token、cost、messages 等聚合信息。
- `data/tokscale-summary.json`：本项目渲染 README 和 SVG 用的摘要数据。
- `scripts/update-from-tokscale.mjs`：从本机 Tokscale 重新导出 Codex + Claude Code 用量，并重新生成 README/SVG。

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

## Tokscale 公开排名

公开排名需要你显式登录并提交数据：

```bash
npx -y tokscale@latest login
npx -y tokscale@latest submit --client codex,claude
```

当前数据已用 Tokscale 提交过一次，公开页为 `https://tokscale.ai/u/XxJjTt6`。以后如果 Tokscale 排名变化，把上面命令里的 `#453` 换成新的排名即可。
