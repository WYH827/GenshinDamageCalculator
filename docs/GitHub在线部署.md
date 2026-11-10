# GitHub 在线部署准备

本仓库使用GitHub Actions发布Pages。下方记录首次部署与后续维护步骤。

仓库：`https://github.com/WYH827/GenshinDamageCalculator`

网站：`https://wyh827.github.io/GenshinDamageCalculator/`

## 发布前

1. 将当前项目上传至上述仓库，使用 `main` 或 `master` 分支。
2. 仓库 Settings → Pages → Source 选择 **GitHub Actions**。
3. `.github/workflows/pages.yml` 会安装锁定依赖、运行单元测试、构建并发布 `dist`。也可从 Actions 手动运行。
4. Vite 使用相对资源路径，支持项目子目录；头像、SVG、计算 Worker 和懒加载模块随构建输出，浏览器计算不需要服务器。

## UID 查询接口

GitHub Pages 没有后端，不能运行本地的 Vite Enka 中间件。计算、保存、JSON导入及导出仍可使用；要启用UID查询，另外部署 `deploy/enka-worker.ts`：

1. 使用自己的 Cloudflare 账号，在项目根目录运行 `npx wrangler deploy --config deploy/wrangler.toml`（首次使用会要求登录）。此命令会发布服务，留到实际发布时执行。
2. `ALLOWED_ORIGIN` 默认只允许 `https://wyh827.github.io`。换自定义域名时一并更新。
3. 获取生成的 Worker 地址，在 GitHub 仓库 Settings → Secrets and variables → Actions → Variables 添加 `VITE_ENKA_API_BASE`，值为服务根地址，如 `https://teyvat-enka-api.<子域>.workers.dev`，不要附 `/api/enka`。
4. 重新运行 Pages workflow。代码不会包含密码或令牌；客户端只需要公开的接口地址。

转发服务只接受规定路径的UID查询，保留Enka缓存TTL、请求合并、429退避和超时控制。UID会发送给该服务和Enka，用于读取公开展柜。生产公开服务可按访问量配置平台限流。

## 本地与其他托管

- `npm ci`，`npm run dev`：本地编辑和自带UID接口。
- `npm run build`，`npm run preview`：验证生产构建，同样提供本地UID接口。
- 静态构建设置 `VITE_STATIC_HOST=true`；没有 `VITE_ENKA_API_BASE` 时明确提示UID接口未配置，继续支持JSON导入。
- 作者页地址通过 `VITE_SITE_URL` / `VITE_REPOSITORY_URL` 配置。Pages workflow 自动使用当前仓库生成地址，并标为已发布；本地未设置时显示预设地址与未发布状态。
- 浏览器数据按域名隔离，从本地迁移到网站请先导出方案再导入。

## 核对清单

网站资源加载、计算Worker、快速导入懒加载模块、作者头像与元素SVG；手动开始计算；方案导入导出；UID查询（已配置服务时）；手机布局与常驻多选；站点地址和仓库链接。

发布内容不包括 `node_modules`、`verification`、临时截图、测试报告或用户下载目录中的方案。作者头像和第三方素材说明见 `THIRD_PARTY_NOTICES.md`，代码许可见 `LICENSE`。
