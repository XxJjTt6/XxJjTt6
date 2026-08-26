# XxJjTt6 GitHub Profile Setup

这是一套可直接放进 `XxJjTt6/XxJjTt6` 个人主页仓库的个人介绍 README 方案。
主页采用 LofiSu 风格的紧凑个人信息、教育/实习、获奖与技术方向双栏结构，并保留可见的 Tokscale 2D Embed 和用量汇总表。

## 文件用途

- `README.md`：GitHub 个人主页正文，由个人介绍和动态 AI 使用统计组成。
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

- README 中直接可见的 2D 热力图使用 Tokscale 官方动态接口 `tokscale.ai/api/embed/...`；通过 `tokens=compact&cost=compact` 显示短数字。
- GitHub README 不能运行 Tokscale 页面的交互式 JavaScript，因此逐日 token 悬浮明细通过图表链接跳转到 Tokscale 公开页查看。
- GitHub Actions 每小时从 Tokscale 公开页拉取聚合数据并重新生成 README；个人介绍由生成器中的固定模板保留。
- 本机 Codex / Claude Code 的最新用量需要先提交到 Tokscale，GitHub Actions 才能拿到公开数据。

## Tokscale 公开排名

公开排名需要你显式登录并提交数据：

```bash
npx -y tokscale@latest login
npx -y tokscale@latest submit --client codex,claude
```

当前数据已用 Tokscale 提交过一次，公开页为 `https://tokscale.ai/u/XxJjTt6`。以后 Tokscale 排名变化时，公开刷新脚本会自动读取新排名。
