# GitHub 在线部署准备

本仓库使用GitHub Actions发布Pages。下方记录首次部署与后续维护步骤。

仓库：`https://github.com/WYH827/GenshinDamageCalculator`

网站：`https://wyh827.github.io/GenshinDamageCalculator/`

## 发布前

1. 将当前项目上传至上述仓库，使用 `main` 或 `master` 分支。
2. 仓库 Settings → Pages → Source 选择 **GitHub Actions**。
3. `.github/workflows/pages.yml` 会安装锁定依赖、运行单元测试、构建并发布 `dist`。也可从 Actions 手动运行。
4. Vite 使用相对资源路径，支持项目子目录；头像、SVG、计算 Worker 和懒加载模块随构建输出，浏览器计算不需要服务器。

## 可选：网页与 Enka 接口一体化部署（Cloudflare Workers）

网站可以内置Enka转发，前提是托管平台能执行后端。已核对GGArtifact公开源码：它的前端调用同域 `/api/enka/uid/`，由Cloudflare Worker请求Enka，浏览器并非直接跨域请求Enka。

参考：[GGArtifact前端](https://github.com/Anyrainel/GenshinTools/blob/main/src/providers/enka/enkaFetcher.ts)、[Worker](https://github.com/Anyrainel/GenshinTools/blob/main/worker/index.ts)。本项目采用相同部署结构，复用自己的转发实现。

根目录 `wrangler.jsonc` 同时发布 `dist` 网页、官方预设库和 `deploy/site-worker.ts` 后端。访问 `/api/enka/{uid}` 时执行后端，其他路径读取静态资源。UID仅交给本站接口与Enka。

```sh
npm ci
npx wrangler login
npm run deploy:cloudflare
```

`deploy:cloudflare` 自动执行 `build:cloudflare`，强制使用同域API。不要把GitHub Pages的 `VITE_STATIC_HOST=true` 用于该站点。部署会输出 `https://teyvat-damage-studio.<实际账号子域>.workers.dev`，也可在Cloudflare控制台绑定自己的域名。需登录站点作者的Cloudflare账号；无需用户购买服务器或配置API。当前仅发布了GitHub Pages地址，Cloudflare地址以实际部署成功输出为准。

可先运行 `npm run check:cloudflare` 构建和检查上传包（不发布），或 `npm run preview:cloudflare` 在Wrangler本地运行网页与接口。发布后检查首页、`/presets/index.json` 和导入窗口的UID读取；公开展柜数据使用Enka TTL缓存、合并同UID并发请求并对429退避。

GitHub仓库仍用于源码、预设PR与版本管理，现有Pages不会被关闭。若以后改用新域名，浏览器数据不会自动迁移，请在原站导出JSON，再到新站导入。

## GitHub Pages 的 UID 查询

UID导入默认直连 `https://profile.microgg.cn/api/uid/{uid}`，可在「UID查询接口」选择Cloudflare：`https://enka-api.wyh827.workers.dev`。Cloudflare地址通过仓库变量 `VITE_ENKA_API_BASE` 设置，仅影响Cloudflare选项；网页地址不变。切换接口后取消旧请求并清空预览，必须重新读取，不自动切换数据来源。

2026-11-12从本站Pages来源实测：MicroGG返回JSON，但当前响应没有 `Access-Control-Allow-Origin`，本机浏览器报CORS读取失败。保留用户要求的MicroGG直连默认选项；遇到此问题手动切换Cloudflare，其接口已实测可读取。两者使用各自的数据与缓存，UID发送至所选服务。Enka官方API也缺少跨域许可，不能用 `no-cors` 读取JSON。

自动读取失败时可展开“从Enka官方读取并粘贴JSON”：打开当前UID的官方接口、复制完整JSON并粘贴预览，保持单角色/四角色选择，无需下载文件。

若要改用自有服务，可部署 `deploy/enka-worker.ts`：

1. 注册Cloudflare并在项目目录运行 `npx wrangler login` 完成浏览器授权，再运行 `npx wrangler deploy --config deploy/wrangler.toml`。这只发布接口，不迁移GitHub Pages网页。
2. `ALLOWED_ORIGIN` 默认只允许 `https://wyh827.github.io`。换自定义域名时一并更新。
3. 获取生成的 Worker 地址，在 GitHub 仓库 Settings → Secrets and variables → Actions → Variables 添加 `VITE_ENKA_API_BASE`，值为服务根地址，如 `https://enka-api.wyh827.workers.dev`，不要附 `/api/enka`。
4. 重新运行 Pages workflow。代码不会包含密码或令牌；客户端只需要公开的接口地址。

转发服务只接受规定路径的UID查询，保留Enka缓存TTL、请求合并、429退避和超时控制。UID会发送给该服务和Enka，用于读取公开展柜。生产公开服务可按访问量配置平台限流。

截至2026-11-12，Workers Free免费额度为账户每天100,000次请求、每次10ms CPU，超过日额度返回1027，不自动升级。CPU时间不包括等待Enka网络响应。付费计划需主动开通，最低5美元/月。此接口不使用数据库、KV或付费域名。参考 [官方定价](https://developers.cloudflare.com/workers/platform/pricing/) 与 [额度说明](https://developers.cloudflare.com/workers/platform/limits/)。

## 本地与其他托管

- `npm ci`，`npm run dev`：本地编辑和自带UID接口。
- `npm run build`，`npm run preview`：验证生产构建，同样提供本地UID接口。
- 静态构建设置 `VITE_STATIC_HOST=true`；默认MicroGG直连；Cloudflare选项使用 `VITE_ENKA_API_BASE`，未设置时使用作者的Cloudflare地址。
- 作者页地址通过 `VITE_SITE_URL` / `VITE_REPOSITORY_URL` 配置。Pages workflow 自动使用当前仓库生成地址，并标为已发布；本地未设置时显示预设地址与未发布状态。
- 浏览器数据按域名隔离，从本地迁移到网站请先导出方案再导入。

## 核对清单

网站资源加载、计算Worker、快速导入懒加载模块、作者头像与元素SVG；手动开始计算；方案导入导出；UID查询；手机布局与常驻多选；站点地址和仓库链接。

发布内容不包括 `node_modules`、`verification`、临时截图、测试报告或用户下载目录中的方案。作者头像和第三方素材说明见 `THIRD_PARTY_NOTICES.md`，代码许可见 `LICENSE`。
