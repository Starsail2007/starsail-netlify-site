# World Cup Data Pipeline

本文档记录 `/worldcup/` 页面使用的世界杯名单与球员中文名映射流水线。

## 数据源

- 官方名单主表：FIFA `SquadLists-English.pdf`
- 中文名自动来源：Wikidata `zh-hans / zh-hant / zh / en` 标签
- 人工锁定来源：`src/worldcup/data/player-name-overrides.json`

官方名单是主键来源，中文名只作为展示层派生数据。不要用搜索结果反向改写官方名单里的号码、生日、俱乐部等字段。

## 生成命令

更新官方 48 队名单：

```bash
pnpm worldcup:squads
```

重新生成球员中文名主表：

```bash
pnpm worldcup:player-map
```

只复用现有结果并合并人工覆盖表：

```bash
pnpm worldcup:player-map -- --fallback-only
```

对复核队列做小批量补齐：

```bash
pnpm worldcup:player-map -- --fallback-only --fallback-search --fallback-limit 100 --fallback-concurrency 4 --fallback-max-candidates 4 --timeout 6000
```

## 输出文件

- `src/worldcup/data/squad-roster.json`：官方名单结构化结果，包含 48 队、1248 名球员。
- `src/worldcup/data/player-name-map.json`：展示层使用的中文名映射主表。
- `src/worldcup/data/player-name-review.csv`：自动流程无法确认的复核队列。
- `src/worldcup/data/player-name-overrides.json`：人工确认并锁定的中文译名。

## 质量规则

- `player-name-map.json` 必须覆盖 `squad-roster.json` 的全部球员 key。
- 有出生日期冲突的 Wikidata 实体必须淘汰。
- 低置信度结果不能把中文名写入展示字段。
- `needsReview: true` 的行不应有 `zhName`，避免页面误用未确认译名。
- 手工确认译名写入 overrides，不直接改生成后的主表。

## 当前状态

- 名单：48 队 / 1248 人。
- 中文名：660 人已填充。
- 复核队列：588 人。
- 已锁定人工覆盖：姆巴佩、亚马尔。
