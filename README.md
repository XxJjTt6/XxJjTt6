<!--
The project narrative below is intentionally evidence-first.
Only the AI activity section is generated from Tokscale public profile data.
Tokscale graphs are official live embeds; click targets open the public profile.
DeepSeek Desktop tables use provider-reported local DSH session logs when present.
-->

<div align="center">

# XxJjTt6

**LLM / Agent Infra · Evaluation · Multimodal RAG**

把 Agent 从“能跑的 Demo”推进到**可执行、可评测、可审计、可回退**的工程系统。

<p>
  <a href="https://github.com/XxJjTt6/AI-Hackahton_meituan"><strong>AutoSolver · 10/10 合法提交</strong></a>
  ·
  <a href="https://github.com/XxJjTt6/nowogen-knowledge-assistant"><strong>Enterprise RAG · 48 个公开来源</strong></a>
  ·
  <a href="https://github.com/XxJjTt6/feishu-ai-pioneer-competition"><strong>Trend2SKU · 400 条合成样本</strong></a>
</p>

</div>

## 我在做什么

我专注于 LLM / Agent 系统的工程化落地，主线不是堆叠模型名，而是解决三个可验证的问题：

- **运行时是否可靠**：工具调用、状态流、并发、超时、进程隔离与失败回退是否真正闭环；
- **结果是否可信**：答案或决策是否有证据、可复评、可追踪，并明确区分官方数据、合成数据与演示结果；
- **系统是否可交付**：是否提供可运行入口、测试、验收脚本、审计记录和清晰的结果边界。

## 代表项目

### AutoSolver · 受控代码生成与可执行评测

> 美团 AI Hackathon AutoSolver 决赛项目。把 LLM 生成代码放进受约束的候选链路，而不是直接进入正式求解热路径。

- 构建“代码生成 → AST 策略门 → 独立 Worker 试跑 → 父进程复评 → Critic 修正 → best-so-far 晋升 / 回退”闭环；
- 对导入、危险调用、环境变量、网络、墙钟时间和进程组回收设置约束，Worker 分数由父进程按官方目标函数重新计算；
- **官方记录：平均分 706.197（越低越好），10 / 10 个用例全部合法。**

[项目仓库](https://github.com/XxJjTt6/AI-Hackahton_meituan) · [官方提交记录](https://github.com/XxJjTt6/AI-Hackahton_meituan/blob/main/archive/runs/official_submit_20260520_132026_70222083.json) · [测试目录](https://github.com/XxJjTt6/AI-Hackahton_meituan/tree/main/tests)

### 氢擎智服 · 多模态企业知识 Agent

> 面向燃料电池产品问答与初步选型的 RAG 工作台，目标是“答案可用、证据可查、边界可控、过程可审”。

- 组织 9 类协作角色，以 Parent / Child 分块、中文词法、可选稠密向量、RRF 融合与重排构成混合检索链路；
- 在回答前后执行证据覆盖检查与事实核验，对价格、交期、认证和故障根因等高风险事项拒绝无据承诺；
- **交付证据：13 份发布知识文档、48 条公开来源、25 项后端测试通过，并提供统一验收脚本。**

[项目仓库](https://github.com/XxJjTt6/nowogen-knowledge-assistant) · [在线演示](http://47.93.220.66/qingqingrag/) · [项目自检报告](https://github.com/XxJjTt6/nowogen-knowledge-assistant/blob/main/docs/project-audit.md)

[![氢擎智服系统架构](https://raw.githubusercontent.com/XxJjTt6/nowogen-knowledge-assistant/main/docs/architecture/system-overview.png)](https://github.com/XxJjTt6/nowogen-knowledge-assistant)

### Trend2SKU · 可审计产品决策 Agent

> 独立完成的决策原型：结构化输入 → VOC / 趋势 / 竞品证据 → 动态候选 → 八维评分 → HITL → 报告。

- 使用稳定候选 ID 串联概念、评分、模拟访谈和风险，避免多候选并发时发生结果串线；
- 提供 CLI、同步 API、SSE 事件流、人工复核、运行 trace、报告下载与远程模型失败后的离线降级；
- **数据边界明确：400 条评论是固定种子的合成离线演示数据，不包装成真实用户研究或爆款概率。**

[项目仓库](https://github.com/XxJjTt6/feishu-ai-pioneer-competition) · [测试目录](https://github.com/XxJjTt6/feishu-ai-pioneer-competition/tree/main/backend/tests)

## 公开证据标准

- 代表项目均保留源码、提交历史、测试或审计材料；数字主张优先链接到公开记录，而不是只写在个人介绍中；
- 官方评测、离线回归、合成数据和在线演示使用不同口径，不把一种结果替换成另一种结果；
- 更完整的“主张 → 公开证据 → 适用边界”映射见 [PROFILE_EVIDENCE.md](./PROFILE_EVIDENCE.md)。

## 工程能力地图

| 方向 | 可落地能力 | 项目证据 |
| --- | --- | --- |
| Agent Runtime | 状态流、工具注册、SSE、HITL、会话与并发隔离 | [Trend2SKU](https://github.com/XxJjTt6/feishu-ai-pioneer-competition)、[氢擎智服](https://github.com/XxJjTt6/nowogen-knowledge-assistant) |
| Reliability | AST 静态门禁、进程沙箱、超时回收、失败分类、稳定回退 | [AutoSolver](https://github.com/XxJjTt6/AI-Hackahton_meituan) |
| Retrieval | Parent / Child 分块、词法 / 向量混合检索、RRF、重排、型号路由 | [氢擎智服](https://github.com/XxJjTt6/nowogen-knowledge-assistant) |
| Evaluation | 官方目标函数复评、场景回归、证据覆盖、可审计 trace | [AutoSolver](https://github.com/XxJjTt6/AI-Hackahton_meituan)、[氢擎智服](https://github.com/XxJjTt6/nowogen-knowledge-assistant) |

## AI 工程活动

<details>
<summary><strong>展开 Tokscale 动态记录</strong>：这是工具使用强度，不等同于代码质量或项目成果</summary>

<p align="center">
  <a href="https://tokscale.ai/u/XxJjTt6">
    <img src="https://tokscale.ai/api/embed/XxJjTt6/svg?theme=light&graph=1&color=blue&tokens=compact&cost=compact" alt="XxJjTt6 live Tokscale 2D usage graph" width="680">
  </a>
</p>

<p align="center">
  <a href="https://tokscale.ai/u/XxJjTt6">
    <img src="https://tokscale.ai/api/embed/XxJjTt6/svg?theme=light&view=3d&compact=1&color=blue" alt="XxJjTt6 live Tokscale 3D usage graph" width="680">
  </a>
</p>

<p align="center"><a href="https://tokscale.ai/u/XxJjTt6">在 Tokscale 查看逐日明细</a></p>

> The live 2D/3D graphs above are official Tokscale embeds and currently cover Codex and Claude Code. The tables below also include provider-reported DeepSeek Desktop usage from the [auditable snapshot](./data/deepseek-desktop-usage.json).

### 使用窗口

| Window | Tokens | Known cost |
| --- | ---: | ---: |
| Today | 63,107,632 | $50.61 |
| This week | 979,112,353 | $674.77 |
| This month | 1,642,528,785 | $1,347.75 |
| Last 7 days | 994,998,264 | $688.51 |
| Last 30 days | 6,104,090,965 | $5,035.36 |
| All time | 22,091,662,946 | $20,217.71 |

### 工具来源

| Source | Tokens | Cost | Messages |
| --- | ---: | ---: | ---: |
| Codex | 18,022,240,172 | $15,885.36 | 125,785 |
| Claude Code | 3,961,270,270 | $4,332.35 | 22,978 |
| DeepSeek Desktop | 89,206,539 | — | 597 |

### 模型

| Model | Tokens | Cost | Messages |
| --- | ---: | ---: | ---: |
| gpt-5.5 | 8,813,080,292 | $8,375.99 | 67,930 |
| gpt-5.6-sol | 8,701,496,412 | $7,197.08 | 53,241 |
| claude-opus-4-8 | 3,074,580,747 | $2,848.57 | 19,369 |
| claude-fable-5 | 858,469,301 | $1,475.99 | 2,788 |
| gpt-5.4 | 495,644,618 | $295.88 | 4,165 |
| deepseek-v4-pro | 87,905,623 | — | 557 |
| claude-haiku-4-5 | 28,024,020 | $6.87 | 653 |
| gpt-5.3-codex | 22,779,318 | $10.82 | 235 |
| gpt-5.2-codex | 4,885,099 | $3.21 | 123 |
| gpt-5.6-terra | 3,205,029 | $2.29 | 85 |
| deepseek-v4-flash | 1,300,916 | — | 40 |
| claude-sonnet-4-6 | 196,202 | $0.92 | 8 |

<sub>Updated 2026-08-22. Codex and Claude Code aggregate data from Tokscale 4.13.0; live graphs served by Tokscale. DeepSeek Desktop logs contain token usage but no billing amount, so known cost excludes DeepSeek Desktop.</sub>

</details>

---

**目标方向：LLM / Agent Infra、AI 平台工程、模型与 Agent 评测。**
