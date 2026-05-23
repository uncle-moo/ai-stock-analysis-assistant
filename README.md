# ai-stock-analysis-assistant

A 股智能分析工具，基于技术指标和 LLM 对自选股、大盘及涨停板进行自动化分析，并通过飞书机器人推送报告。

## 环境要求

- Node.js >= 18
- pnpm

## 快速开始

```bash
# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入以下配置:
#   LLM_API_KEY  - LLM API 密钥
#   LLM_BASE_URL - LLM API 地址（兼容 OpenAI 格式）
#   LLM_MODEL    - 模型名称（默认 gpt-4o-mini）
#   FEISHU_WEBHOOK_URL - 飞书机器人 Webhook 地址
```

## 可用命令

### `pnpm analyze [筛选关键词...]`

分析自选股列表中的个股，获取实时行情数据，进行技术指标分析（均线、MACD、RSI），再通过 LLM 生成综合报告，最后推送至飞书。

支持按股票名称、代码或拼音首字母筛选指定股票进行分析：

```bash
# 分析全部自选股
pnpm analyze

# 仅分析指定股票（支持多个关键词）
pnpm analyze 爱尔眼科
pnpm analyze 300015
pnpm analyze ae  # 拼音首字母
pnpm analyze 爱尔 600703  # 多个关键词
```

自选股列表在 `watchlist.json` 中配置。

### `pnpm market`

大盘收盘复盘分析。获取主要指数技术数据、两市成交额、涨跌分布、北向资金流向及市场新闻，经 LLM 综合研判后生成包含盘面情绪、消息面解读、技术面研判、走势预测和操作建议的专业分析报告，推送至飞书。

### `pnpm limit-up`

涨停板连板分析。获取当日涨停股票数据，按连板高度分组，通过飞书交互式卡片推送（含统计栏、题材分布、连板梯队、首板板块分布与重点个股）。

```bash
pnpm limit-up
```

### `pnpm typecheck`

TypeScript 类型检查，不输出文件。

```bash
pnpm typecheck
```

## 配置说明

### 自选股列表

编辑 `watchlist.json`：

```json
{
  "name": "我的自选股",
  "stocks": [
    { "code": "300015", "name": "爱尔眼科" },
    { "code": "300866", "name": "安克创新" }
  ]
}
```

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `LLM_API_KEY` | LLM API 密钥 | - |
| `LLM_BASE_URL` | API 地址 | `https://api.openai.com/v1` |
| `LLM_MODEL` | 模型名称 | `gpt-4o-mini` |
| `FEISHU_WEBHOOK_URL` | 飞书机器人 Webhook | - |

## GitHub Actions

项目包含 GitHub Actions 工作流，可定时执行大盘分析（交易日收盘后），需在仓库 Settings > Secrets 中配置上述环境变量。

## 项目结构

```
src/
├── index.ts              # 自选股分析入口
├── market-analysis.ts    # 大盘分析入口
├── limit-up-analysis.ts  # 涨停板分析入口
├── lib/
│   ├── types.ts          # 类型定义
│   ├── fetch-stock.ts    # 个股行情数据获取
│   ├── fetch-limit-up.ts # 涨停板数据获取
│   ├── market-indices.ts # 大盘指数、市场概览、北向资金、新闻获取
│   ├── analyze-stock.ts  # 技术指标分析
│   ├── ai-analyzer.ts    # LLM 分析
│   ├── limit-up-formatter.ts # 涨停数据文本格式化
│   ├── limit-up-card.ts      # 飞书交互式卡片构建
│   └── feishu-notifier.ts    # 飞书推送
```
