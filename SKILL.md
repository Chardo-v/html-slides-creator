---
name: html-slides-creator
description: >
  用于在 html-slides-creator 框架中创建和添加幻灯片页面。当用户说"帮我做一页
  PPT / 幻灯片"、"加一张关于 X 的页面"、"新建介绍 Y 的 slide"、
  "给演示文稿添加内容"、"修改某一页"或"帮我做一套演示"时，必须使用
  本 skill。只要用户在此项目里提到"幻灯片"、"slide"、"PPT"、"演示页"，
  就应激活本 skill。
---

# html-slides-creator

使用本 skill 时，先定位当前 `SKILL.md` 所在目录，记为 `skill_root`。不要假设当前环境是 Codex 还是 Claude Code，也不要硬编码 `~/.codex/skills` 或 `~/.claude/skills`；一律相对 `SKILL.md` 自己定位。

## 初始化模板仓库

模板仓库应缓存为：

```text
skill_root/html-slides-creator/
```

远程仓库地址固定为：

```text
https://github.com/Chardo-v/html-slides-creator.git
```

按下面规则处理：

1. 如果 `skill_root/html-slides-creator/` 不存在，就在该位置执行 clone。
2. 如果该目录存在且包含 `.git/`，就对它执行 `git pull --ff-only`。
3. 如果该目录存在但不是 git 仓库，不要覆盖、不要删除，先向用户说明这是异常状态。

## 读取主指引

完成 clone 或更新后，必须先阅读：

```text
skill_root/html-slides-creator/PROMPT.md
```

后续创建、修改、注册 slide 的具体做法，以 `PROMPT.md` 为准。不要跳过这一步。

## 工作边界

- 模板运行时代码优先从 `skill_root/html-slides-creator/` 读取。
- 当你把模板应用到用户当前项目时，优先保留用户内容，如 `slides/`、`assets/`、`script.md` 等；不要因为模板更新而覆盖用户自己的演示内容，除非用户明确要求。
- 如果用户请求的是“基于现有脚本生成演示”或“修改某一页”，先完成上面的仓库检查与 `PROMPT.md` 读取，再开始实际编辑。
