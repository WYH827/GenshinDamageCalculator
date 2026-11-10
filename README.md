# 提瓦特伤害工作台

原神四人队伍伤害计算与时间轴编辑工具。配置角色、武器、圣遗物、技能和效果，编排战斗循环，查看伤害、DPS、各角色占比与「伤害&效果轴」。

**在线使用：[wyh827.github.io/GenshinDamageCalculator](https://wyh827.github.io/GenshinDamageCalculator/)**

[作者 GitHub](https://github.com/WYH827) · [B站主页](https://space.bilibili.com/544854596) · [反馈问题](https://github.com/WYH827/GenshinDamageCalculator/issues)

> 关注@WYH827喵~

## 功能

- 四人队伍配置，角色与武器预设，整份方案JSON保存与导入。
- GGScanner GOOD JSON / Enka UID快速导入，支持四角色映射、基础面板与图标。
- 全局与实时效果，技能绑定、条件公式、五类层数逻辑、定时增减及自动到期事件。
- 时间轴自动排序、前台切换、批量添加技能、常驻多选、批量移动/复制/删除。
- 手动开始计算，常规与五类星月直伤、逐事件蒸发/融化；支持暴击、非暴击和期望视图。
- 伤害详情、角色伤害圆环、局外/实时面板与交互式伤害&效果轴。
- 官方预设库，可从整队方案、角色、武器导入入口直接浏览、预览并应用。

## 官方预设库与投稿

官方预设位于 [`public/presets`](public/presets)，分为：

| 目录                                | 内容                                    |
| ----------------------------------- | --------------------------------------- |
| [方案预设](public/presets/方案预设) | 整队配置 + 技能效果 + 敌方参数 + 时间轴 |
| [角色](public/presets/角色)         | 单个角色预设                            |
| [武器](public/presets/武器)         | 武器主副词条与效果预设                  |

**欢迎通过 Pull Request 上传预设，作者审核后放入官方预设库。**

请用最新版工作台导出JSON，放入对应目录，并更新 `public/presets/index.json`。PR中注明作者、角色装备条件、机制与循环说明及验证结果。运行 `npm run check:presets` 可校验格式；校验通过后仍需作者审核。详细流程见 [预设库投稿说明](public/presets/README.md)。初始库为空，等待经审核的投稿；本地保存的预设不会自动上传。

## 使用

推荐顺序：角色 → 武器/圣遗物 → 技能与效果 → 时间轴 → 开始计算。详细操作说明可在网页右上角「使用说明」打开，也可阅读 [功能与计算说明](docs/功能与计算说明.md)。

编辑数据保存在当前浏览器，切换设备或清除缓存前请导出JSON备份。网站与本地地址的存储独立。

## 本地运行

需要Node.js 22或更新版本。

```sh
npm ci
npm run dev
```

生产构建与本地预览：

```sh
npm test
npm run build
npm run preview
```

Windows也可运行 `启动工作台.cmd`。`npm run test:e2e` 使用Windows Microsoft Edge进行浏览器测试。

## 在线部署与内置 Enka 接口

GitHub Actions在主分支更新后自动校验预设、测试、构建和发布Pages。部署说明见 [GitHub在线部署](docs/GitHub在线部署.md)。

**在线版可直接输入UID使用Enka，无需自行部署服务。** GitHub Pages版通过 [Jina Reader](https://jina.ai/reader/) 公开接口读取Enka原始JSON，不需要API Key、Cloudflare账号或自行部署后端。UID会发送给Jina与Enka。客户端校验来源地址和UID，原样解析数值，按Enka TTL缓存；Reader缓存容忍时间设为60秒。遇到限流遵守Retry-After，不连续重试。

也可部署项目提供的 `deploy/enka-worker.ts`，把地址设为仓库变量 `VITE_ENKA_API_BASE`；配置后优先使用自有服务。本地dev/preview继续使用内置转发接口。

**支持网页与Enka接口一起部署到Cloudflare Workers，用户直接在网站输入UID即可。** 仓库根目录的 `wrangler.jsonc` 同时发布前端资源和 `/api/enka/{uid}` 接口，不经过公共代理，也不需要为前端填写另一个服务地址：

```sh
npm ci
npx wrangler login
npm run deploy:cloudflare
```

部署需要站点作者的Cloudflare账号；GitHub令牌不能代替Cloudflare登录。命令成功后会输出实际网站地址。GitHub Pages继续保留，但它不支持执行后端，因此不会因为仓库里增加Worker文件而自动拥有内置接口。详细部署与验证步骤见 [GitHub在线部署](docs/GitHub在线部署.md)。

## 公式与许可

公式参考 [Alioth](https://alioth.wiki/gi/formulae)，实现细节见 [伤害计算实装计划](docs/伤害计算实装计划.md)。本工具不自动模拟元素附着、激化、剧变或多人反应。结果取决于输入与已实现机制，请核对倍率、效果和时序。

代码使用 [ISC许可](LICENSE)。作者头像、游戏图片、图标及资料保留各自权利，详见 [第三方素材说明](THIRD_PARTY_NOTICES.md)。本项目为非官方玩家工具，与游戏运营方无隶属关系。
