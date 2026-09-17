# ShineTools 文档部署与 Zero Trust 访问管理

[返回总导航](./README.md) · [查看全量覆盖审计](./02-coverage-audit.md)

## Navigation

- [发布结论](#发布结论)
- [入口与边界](#入口与边界)
- [发布架构](#发布架构)
- [发布内容](#发布内容)
- [Cloudflare Access 应用](#cloudflare-access-应用)
- [双层保护](#双层保护)
- [构建与部署](#构建与部署)
- [发布验证矩阵](#发布验证矩阵)
- [权限变更流程](#权限变更流程)
- [故障与回滚](#故障与回滚)

## 发布结论

ShineTools 文档发布到现有 `growatt-openapi-docs` Cloudflare Pages 项目，使用独立路径、独立导航和独立 Cloudflare Access 应用。2026-09-17 已将线上策略改为任意邮箱验证码登录，并在后台回读确认，邮箱仅用于身份与登录记录，由内容维护者控制上线内容。本次未使用外部邮箱完成收码及验证码登录的端到端验证。

| 项目 | 约定 |
|---|---|
| 正式入口 | `https://vpp.myshine.online/shinetools/` |
| Pages 入口 | `https://growatt-openapi-docs.pages.dev/shinetools/` |
| 访问方式 | 任意邮箱完成 Cloudflare Access 验证后可阅读，无域名或个人邮箱白名单 |
| 内容来源 | `docs/shinetools-settings/**/*.md` |
| 构建方式 | Next.js 静态导出到 `out/shinetools` |
| Access 应用 | `ShineTools Settings Docs (shinetools-settings-docs)` |
| 默认会话时长 | 7 天 |

ShineTools 与公开的 `/growatt-openapi` 分离。ShineTools 与协议 SSOT 分别维护 Access 应用，两者均允许任意邮箱验证码登录。

## 入口与边界

### 发布入口

- `/shinetools`：专题总览
- `/shinetools/document-conventions`：文档方法
- `/shinetools/source-map`：来源映射
- `/shinetools/coverage-audit`：全量覆盖审计
- `/shinetools/quick-site-setup`：M01
- `/shinetools/direct-settings-platform`：M02
- `/shinetools/reference-quick-setting`：M03
- `/shinetools/reference-direct-mode`：M04
- `/shinetools/layout-annotations-and-legacy-artifacts`：M05
- `/shinetools/source-*`：来源大纲审计页

### 不改变的入口

- `/growatt-openapi` 继续作为公开 Open API contract。
- `/protocol-mapping` 继续使用独立的 Protocol SSOT Access 应用。
- 根路径继续跳转到 `/growatt-openapi`，不把内部 ShineTools 门户暴露为默认首页。

## 发布架构

```text
docs/shinetools-settings/**/*.md
            │ build-time read
            ▼
lib/shinetools-docs.ts
  ├─ 显式发布清单
  ├─ Markdown 内链重写
  └─ HTML 渲染
            │
            ▼
app/shinetools/* → out/shinetools/*
            │
            ▼
Cloudflare Access policy
            │ inject Cf-Access-Jwt-Assertion
            ▼
Pages Function fail-closed guard
            │
            ▼
Authenticated reader
```

显式发布清单防止仓库中新出现的 Markdown 被自动发布。每一份新增文档都必须先加入 `lib/shinetools-docs.ts` 并接受导航和访问控制测试。

## 发布内容

发布以下阅读层内容：

- 总导航、文档约定、来源映射和覆盖审计
- M01–M05 分析文档
- 三个由白板 JSON 生成的来源大纲
- 本部署与访问管理说明

不发布以下原始材料：

- 飞书画板 RAW JSON
- 白板原始图片
- 飞书访问令牌或 API 响应
- Cloudflare 凭据、Access JWT 或邮箱白名单导出

Markdown 源文件只在构建时读取；线上发布的是静态 HTML 和前端资源，不提供 `.md` 原文件下载地址。页面的“复制 Markdown”功能使用构建时嵌入的阅读内容。

## Cloudflare Access 应用

在 Zero Trust Dashboard 创建独立的 `Self-hosted` 应用：

| 字段 | 值 |
|---|---|
| Application name | `ShineTools Settings Docs (shinetools-settings-docs)` |
| Session duration | `7 days` |
| Login method | `One-time PIN` |
| Public hostname 1 | `vpp.myshine.online` + `/shinetools*` |
| Public hostname 2 | `growatt-openapi-docs.pages.dev` + `/shinetools*` |

建议策略：

| 项目 | 建议值 |
|---|---|
| Policy name | `ShineTools Settings Readers` |
| Action | `Allow` |
| Include | `Login Methods → One-time PIN` |
| 邮箱域名 / 个人邮箱 / 读者分组限制 | 无；同时检查并清理 Require / Exclude 中的相关限制 |

保留验证码校验，不使用 `Bypass`。Cloudflare Access 认证日志作为后台登录记录；它不等同于逐页浏览历史，保留期限以账户套餐和日志配置为准。

### 当前生产配置（2026-09-17）

| 项目 | 当前值 |
|---|---|
| Pages project URL | `https://growatt-openapi-docs.pages.dev` |
| Access application ID | `8b90e87d-c986-4671-a42f-f236b22d130c` |
| Access policy ID | `fa80eeb6-dc88-4e2a-a28e-5d039aeea1c2` |
| 允许范围 | `Allow` + `Include: Login Method One-time PIN`，任意邮箱验证码登录 |
| 身份源 | 接受当前账户中所有可用身份源 |
| Session duration | `1 week` |

已验证 `growatt-openapi-docs.pages.dev/shinetools*` 与 `vpp.myshine.online/shinetools*` 在未登录时均返回 `302` 并跳转到 Cloudflare Access；`vpp.myshine.online/growatt-openapi` 仍返回 `200`，未被 ShineTools 策略覆盖。

## 双层保护

### 第一层：Cloudflare Access

未认证用户应被重定向到 Cloudflare Access 登录页；验证成功后，Cloudflare 将 `Cf-Access-Jwt-Assertion` 注入源站请求。

### 第二层：Pages Function fail-closed

`functions/shinetools*` 会检查该 JWT header：

- 有 JWT：继续读取静态页面，并强制返回 `Cache-Control: private, no-store`。
- 无 JWT：返回 `403`，不读取页面内容。
- 所有响应增加 `X-Robots-Tag: noindex, nofollow, noarchive`。

该函数不替代 Access policy。它只防止生产域名漏配 Access 时直接公开文档。

受控的本地或临时环境如需绕过，可设置：

```text
SHINETOOLS_ALLOW_UNPROTECTED=true
```

生产环境禁止设置该变量。

## 构建与部署

### 发布前检查

```bash
npm run docs:check
npm run build
```

### 部署到现有 Pages 项目

```bash
npx wrangler pages deploy out --project-name growatt-openapi-docs
```

部署顺序：

1. 先确认或创建 `/shinetools*` Access Application。
2. 执行本地文档检查和完整构建。
3. 部署 `out` 到 `growatt-openapi-docs`。
4. 验证 Pages 域名和自定义域名。
5. 验证公开 Open API 没有被 ShineTools 策略覆盖。

如果 Access 尚未配置，Pages Function 会让 ShineTools 返回 403，因此可以安全部署，但门户在策略建立前不可用。

## 发布验证矩阵

| 地址 | 未登录预期 | 已登录预期 |
|---|---|---|
| `/shinetools/` | Access 登录页 | `200`，显示总览 |
| `/shinetools/direct-settings-platform` | Access 登录页 | `200`，显示 M02 |
| `/shinetools/source-market-mod-xh` | Access 登录页 | `200`，显示来源大纲 |
| `/shinetools/not-a-doc` | Access 登录页 | 登录后 `404` |
| `/growatt-openapi` | `200`，保持公开 | `200` |
| `/protocol-mapping/` | 由其独立 Access 应用决定 | 不受 ShineTools 策略影响 |

同时检查已登录 ShineTools 响应：

- 含 `Cache-Control: private, no-store`
- 含 `X-Robots-Tag: noindex, nofollow, noarchive`
- 页面内所有 `/shinetools/*` 链接可访问
- 不存在可直接下载的 `.md`、RAW JSON 或画板图片

## 权限变更流程

1. 发布前确认内容可供任意已验证邮箱的读者阅读。
2. 不再申请或维护邮箱域名、个人邮箱和外部评审读者组白名单。
3. 登录仅验证邮箱归属并记录身份；在 Cloudflare Access 认证日志查看登录情况。
4. 调整策略前保存当前应用和策略截图或导出记录。
5. 调整后分别用企业邮箱和外部邮箱验证，并确认错误验证码无法登录。
6. 定期检查上线内容、认证日志及日志保留配置。

文档内容维护者与 Access 管理员应分离：内容合并不自动授予阅读权限，权限变更也不修改 Markdown 内容。

## 故障与回滚

| 症状 | 检查 | 处理 |
|---|---|---|
| 所有人都看到 Access 登录 | Access 正常行为 | 使用任意可接收验证码的邮箱登录 |
| 登录后仍返回 403 | JWT 未到达 Pages Function、hostname/path 不匹配 | 检查 Access 应用目标和代理链路 |
| 未登录直接看到文档 | Access 和 fail-closed 均未生效 | 立即回滚部署并检查 `_routes.json` |
| 只有 Pages 域名暴露 | Access 只配置了自定义域 | 给 `pages.dev` 增加相同 `/shinetools*` 目标 |
| Open API 也被要求登录 | Access path 配置过宽 | 将应用路径收窄到 `/shinetools*` |
| 新文档没有页面 | 未加入显式发布清单 | 更新 `lib/shinetools-docs.ts` 并重新构建 |

需要回滚时，优先在 Cloudflare Pages 中回退到上一个成功部署；不要通过临时关闭 Access 来恢复可用性。
