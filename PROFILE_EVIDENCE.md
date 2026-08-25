# GitHub Profile Claim-Evidence Ledger

更新日期：2026-08-25

本文件记录个人主页中的强主张、公开证据和适用边界。目的不是把项目写得保守，而是确保每个结果都能被继续追问、被链接验证，并且不会把团队或平台能力误写成个人独立产出。

| 主页主张 | 公开证据 | 可验证结论 | 边界 |
| --- | --- | --- | --- |
| AutoSolver 官方平均分 706.197，10 / 10 用例合法 | [官方提交记录](https://github.com/XxJjTt6/AI-Hackahton_meituan/blob/main/archive/runs/official_submit_20260520_132026_70222083.json) 中的 `avg_score`、`case_count`、`success_count` 与逐例 `validity` | 数字和合法性可由原始 JSON 直接复核 | 706.197 的指标方向是越低越好；网页端或本地分数不作为官方成绩 |
| AutoSolver 包含 AST 门禁、Worker 沙箱、父进程复评、Critic 与回退 | [项目 README](https://github.com/XxJjTt6/AI-Hackahton_meituan) 与 [测试目录](https://github.com/XxJjTt6/AI-Hackahton_meituan/tree/main/tests) | 公开代码和测试可验证系统组成 | 仓库归属与提交历史能证明持续产出，但不能单独证明比赛团队中每一项工作的成员分工 |
| 氢擎智服使用 9 类角色和混合检索链路 | [项目 README](https://github.com/XxJjTt6/nowogen-knowledge-assistant) | README、目录结构与源码可交叉核对角色、分块、RRF 和重排实现 | “9 类角色”是系统角色数量，不等于 9 个同时运行的独立模型 |
| 氢擎智服交付 13 份知识文档、48 条公开来源，25 项后端测试通过 | [项目自检报告](https://github.com/XxJjTt6/nowogen-knowledge-assistant/blob/main/docs/project-audit.md) | 自检报告列出终验口径，仓库保留对应数据与测试目录 | 这是项目交付与回归口径，不包装成企业生产环境流量、准确率或商业收益 |
| Trend2SKU 为单人项目，使用 400 条合成评论 | [项目 README](https://github.com/XxJjTt6/feishu-ai-pioneer-competition) | README 明确记录成员人数、固定种子和数据组成 | 合成评论不是企业内部数据、真实用户研究、销量或 ROI；评分也不是爆款概率 |
| Tokscale 展示多工具 AI 使用活动 | [Tokscale 公开页](https://tokscale.ai/u/XxJjTt6) 与 [生成数据](./data/tokscale-summary.json) | README 中的图表和表格由公开数据定时生成 | Token、成本和消息数是工具使用强度，不等同于工程产出、代码质量或个人能力排名 |

## 动词规则

- **构建 / 实现**：有公开源码、提交、测试或运行记录支撑具体模块。
- **主导 / 负责**：除代码证据外，还应能说明目标、关键决策、成员分工和交付结果；主页默认少用。
- **参与 / 支持**：用于个人边界无法由公开材料完整证明的团队能力。
- **结果数字**：必须说明指标口径、方向、样本量和是否来自官方、离线或合成数据。

## 暂不公开的内容

个人联系方式、未公开实习信息、私有仓库或私有 PR 数据、无法公开的业务数据，以及缺少公开链接或可展示材料的强主张，不从本地求职材料自动同步到 GitHub。
