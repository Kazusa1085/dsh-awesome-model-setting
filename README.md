# dsh-awesome-model-setting

> GitHub: https://github.com/Kazusa1085/dsh-awesome-model-setting

A DeepSeek Harness web plugin that adds a **Model Capabilities** page to the settings panel, so model capabilities can be edited graphically instead of hand-writing `settings.yaml`.

一个用于 DeepSeek Harness 的网页插件：在设置面板里增加一页 **模型能力**，用图形界面编辑模型能力，不用再手写 `settings.yaml`。

It lists every model of every registered provider route and edits the four things that decide whether a model is usable as declared:

它列出每条已注册路由下的全部模型，并可编辑决定「这个模型能不能按你想要的方式用」的四类设置：

1. **Input modalities / 输入模态** — declare that a model accepts images (and any future modality DSH adds).
   — 声明模型支持图像输入（以及 DSH 将来新增的任何模态）。
2. **Context window / 上下文窗口** — the token budget used for compaction and request sizing.
   — 用于压缩与请求预算的上下文容量。
3. **Output cap / 最大输出 token** — the per-request output limit.
   — 单次请求的输出上限。
4. **Image request budgets / 图像请求预算** — pixel budget and per-image byte cap (DeepSeek adapter only).
   — 图像像素预算与单图字节上限（仅 DeepSeek 适配器）。

## Install / 安装

From GitHub / 从 GitHub 安装：

```bash
dsh plugin --profile web add github:Kazusa1085/dsh-awesome-model-setting
```

Or from a local checkout / 或从本地目录安装：

```bash
dsh plugin --profile web add ./dsh-awesome-model-setting
```

Then restart `dsh web` and open **Settings → 模型能力 / Model Capabilities**.

然后重启 `dsh web`，打开 **设置 → 模型能力**。

## Behavior / 行为

### Effective values, not just your file / 显示的是生效值，不只是你文件里的值

The page shows what a model **actually accepts right now**: your settings document merged with the adapter's own model catalog.

页面显示模型**当前实际生效**的能力：你的设置文档与适配器自带模型目录合并后的结果。

This distinction matters. `llm-pi-ai` routes ship a built-in catalog, so a catalog route can already be multimodal with nothing in `settings.yaml`. The native `llm-deepseek` adapter ships no catalog of its own, so there you must declare everything yourself. The row's expanded view says which one applies:

这个区别很重要。`llm-pi-ai` 的路由自带内置目录，所以**目录路由**即使 `settings.yaml` 里什么都没写，也可能已经是多模态；而 `llm-deepseek` 原生适配器没有目录，必须自己声明。展开一行可以看到值来自哪里：

| Hint / 提示 | Meaning / 含义 |
| --- | --- |
| 配置文件声明 | Written in your `settings.yaml` / 你写在配置文件里 |
| 供应商目录声明 | Inherited from the provider catalog / 来自 pi-ai 内置目录 |
| 路由默认值 | No catalog entry either; the route's `defaultInput` applies / 目录也不认识这条路由，退回路由默认值 |

A **「路由声明」** tag next to a model's icon means its multimodal capability comes from the provider catalog rather than from you. It disappears once you declare the modality yourself.

模型图标后面的 **「路由声明」** 标签表示该模型的多模态能力来自供应商目录，而不是你声明的。你一旦显式声明并保存，标签就消失。

### Clearing a field means "use the default" / 清空字段 = 使用默认值

Numeric inputs (context window, output cap, image pixel budget, image byte cap):

数字输入框（上下文窗口、最大输出 token、图像像素预算、单图字节上限）：

- **A value in the box** = the value is written in your settings document.
  — **框里有数字** = 这个值写在了你的设置文档里。
- **An empty box** = the field is removed from your document, so the default applies. The box shows the placeholder **「使用路由默认值」** to make this explicit.
  — **框是空的** = 该字段会从你的文档中删除，改用默认值；此时框里显示占位文案 **「使用路由默认值」**。
- The effective value is still visible: the field label shows `继承 <value>` and the collapsed row shows it in its summary.
  — 生效值仍然可见：字段标签显示 `继承 <value>`，收起状态的行摘要也会显示它。

### 「恢复路由默认值」/ Restore route defaults

This button clears the capability fields this page manages (`input` / `inputModalities`, context window, output cap, image budgets) from the model's entry, so the model falls back to its default declaration.

该按钮会清掉此模型条目上本页管理的能力字段（`input` / `inputModalities`、上下文窗口、最大输出、图像预算），让它回到默认声明。

- It **does not** clear the display `name` — a name is a label (often the provider's own, e.g. a usage multiplier), not a capability.
  — 它**不会**清掉显示名称——名称是标签（常常是供应商自己的，例如计费倍率），不是能力。
- It appears only when your declared input modalities **really differ** from what the adapter ships. Writing a field is not the same as changing it: `deepseek-v4-pro` and `deepseek-v4-flash-vision-exp` declare fields identical to the adapter defaults, so the button stays hidden for them.
  — 它只在**你声明的输入模态确实不同于适配器自带默认**时出现。「写了字段」不等于「改了字段」：`deepseek-v4-pro` 与 `deepseek-v4-flash-vision-exp` 写的值和默认完全一样，所以不会出现这个按钮。
- For `llm-pi-ai` catalog routes the button appears when you declared `input` explicitly (the catalog's own values are not readable from the browser, so an exact comparison is not possible there).
  — 对 `llm-pi-ai` 目录路由，只要显式写了 `input` 就会出现该按钮（浏览器读不到目录本身的值，因此无法做精确比较）。
- The restore is **staged, not immediate**: it is written when you press **保存**.
  — 恢复是**暂存的、不是立即写盘**：点 **保存** 时才生效。

### Editing a catalog-declared capability asks first / 修改目录声明的能力会先确认

Toggling a modality on a model whose capability comes from the provider catalog shows a confirmation: *“供应商声明此模型支持 X，您正在试图改为 Y，确定吗？”*

对能力来自供应商目录的模型切换模态时，会先弹出确认：*「供应商声明此模型支持 X，您正在试图改为 Y，确定吗？」*

### Saving / 保存

- Writes go through the official settings wire (`settings.mutate`) with the namespace revision, so a concurrent edit from another tab or an external `settings.yaml` edit is refused as a conflict instead of being overwritten.
  — 写入走官方设置通道（`settings.mutate`）并携带命名空间 revision；来自另一个标签页或外部编辑 `settings.yaml` 的并发写入会以冲突被拒绝，而不是被覆盖。
- Only the **user layer** is rewritten, and only the fields you actually changed. Schema defaults are never materialized into your document.
  — 只回写**用户层**，而且只回写你真正改过的字段；schema 默认值绝不会被固化进你的文档。
- Changes take effect immediately; no restart.
  — 改动立即生效，无需重启。

### Finding a model among many / 模型很多时怎么找

Search by model id, display name or route name; filter by **全部 / 仅多模态 / 仅未保存**; collapse whole groups; and toggle all rows with one button. Long ids are ellipsized — hover to see the full text.

可按模型 id、显示名或路由名搜索；按 **全部 / 仅多模态 / 仅未保存** 筛选；整组折叠；一个按钮展开或收起全部。过长的 id 会省略号截断，悬停可见完整文本。

## Security / Audit / 安全与审计

- The plugin **never reads or writes your API keys**. It does not touch the credentials service at all.
  — 本插件**从不读写你的 API 密钥**，完全不接触凭据服务。
- The host half registers exactly one **read-only** JSON route (`/plugins/dsh-awesome-model-setting/effective-models`) that reports effective model capabilities. It returns detached leaf data (ids, names, modality strings, numbers) and performs no writes and no network requests.
  — Host 半只注册**一个只读** JSON 路由（`/plugins/dsh-awesome-model-setting/effective-models`），返回生效的模型能力。它只返回分离出的叶子数据（id、名称、模态字符串、数字），不写任何东西，也不发起任何网络请求。
- All settings writes happen in the browser through DSH's own settings API, exactly as the shipped Models page does.
  — 所有设置写入都在浏览器里通过 DSH 自己的设置 API 完成，与官方「模型」页完全一致。
- **We encourage you to audit the code before using it. / 我们鼓励你在使用前审计本插件代码。**

## Known limitations / 已知限制

- **DSH currently supports only `text` and `image` as input modalities.** The harness content model, both LLM adapters, the underlying `@earendil-works/pi-ai` library and the attachment pipeline all agree on this. Audio, video and PDF input do not exist yet. The checkboxes are read from the live settings schema, so a future modality would appear automatically without a plugin update.
  — **DSH 目前的输入模态只有 `text` 和 `image`**：harness 内容模型、两个 LLM 适配器、底层 `@earendil-works/pi-ai` 库与附件管线一致如此。音频、视频、PDF 输入目前并不存在。勾选框的值域是从实时设置 schema 读取的，所以将来新增模态会自动出现，无需更新插件。
- A route whose `models` list you have narrowed only serves the models you listed; catalog models outside that list are not reachable and are therefore not shown.
  — 一旦你收窄了某条路由的 `models` 列表，适配器只服务你列出的模型；列表之外的目录模型无法访问，因此也不会显示。
- The page edits model entries only. Provider lifecycle (adding/removing a provider, storing an API key) stays in the shipped **Models** page.
  — 本页只编辑模型条目。供应商的增删与 API 密钥录入仍由官方 **模型** 页负责。
- Chinese UI strings are currently hard-coded.
  — 界面文案目前是中文硬编码。

## Acknowledgements / 致谢

- The image icon is [Font Awesome Free](https://fontawesome.com) v7.3.1's `image` icon, inlined as SVG because the DSH frontend ships no icon font.
  — 图像图标取自 [Font Awesome Free](https://fontawesome.com) v7.3.1 的 `image` 图标，以内联 SVG 形式内嵌，因为 DSH 前端没有打包图标字体。
- Page structure follows the patterns of the shipped `@deepseek-ai/dsh-client-ui-settings-models` plugin and of [dsh-deepseek-status](https://github.com/M0rt1s0114/dsh-deepseek-status).
  — 页面结构参考了官方 `@deepseek-ai/dsh-client-ui-settings-models` 插件与 [dsh-deepseek-status](https://github.com/M0rt1s0114/dsh-deepseek-status) 的做法。

## License / 许可证

MIT
