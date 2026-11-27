# Signal Rush — Cloud9 × JetBrains 参赛交付包

本文件是本地参赛交付说明，覆盖公开仓库要求、Demo 启动、方法、视频、素材和 JetBrains 证据。当前只做本地整理：未公开仓库、未上传视频、未提交新增文件、未安装依赖、未付费。

## 1. 交付状态与赛事核对

| 项目 | 当前状态 | 说明 |
|---|---|---|
| 赛事主项 | Event minigame | 对应 Cloud9 × JetBrains: Sky’s The Limit Hackathon 2026 |
| 作品 | Signal Rush | 45 秒反应小游戏，适合活动现场快速轮换 |
| 代码许可 | 已具备 | 根目录 `LICENSE` 为 MIT |
| 可运行 Demo | 本地可用 | 一键 Windows 启动器、Python 标准库服务器、静态站点均可运行 |
| 方法说明 | 已具备 | 根目录英文 `README.md` 与本文件第 4 节 |
| JetBrains 工具 | 已使用 | IntelliJ IDEA 2025.3，build IU-253.28294.334 |
| 自动测试 | 26/26 通过 | Node 内置测试，含 100 局 booth 连续重置压力测试 |
| 视频素材 | 已有 52 秒素材 + 2:40 最终本地成片 | `media/signal-rush-demo.mp4`；`media/signal-rush-demo-final.mp4`，160.000 秒、H.264、1280×720、AAC |
| 正式参赛视频 | 本地 2:40 最终素材已完成并验证，待授权上传 | 使用真实 Demo、截图、JetBrains 文本/JSON 证据与重跑测试；无可听旁白，不伪造 IDE 画面。SHA256 `bba14a9ee7c2fd4ee9d939faf764e0a509a49d8939c00a6d5ad9ed38c43a3739`，完整解码通过 |
| 公开仓库 / 公网 Demo / 视频链接 | 待用户授权后执行 | 当前本地 Git 为 `main`，未配置远程仓库 |

官方时间：2026-11-17 开始，提交截止为 **2027-01-12 11:00 PT**，即北京时间 **2027-01-13 03:00**。报名、资格、奖项协议和最终提交动作由用户确认。

### 要求来源与核对边界

- JetBrains 官方博客确认：至少使用一种符合条件的 JetBrains 工具；提交需公开代码仓库、开源许可证、可运行 Demo 或可访问构建、方法说明、JetBrains 工具说明，以及不超过 3 分钟的视频。
- 公开仓库白名单按 **GitHub / GitLab / Bitbucket** 准备。JetBrains 官方博客只写了 “public code repository”，未逐一列出主机；白名单另据 Devpost 公开检索摘要与参赛 checklist 交叉核对。
- 本轮直接读取 Devpost 时遇到 403，未绕过验证。正式提交前请以登录后的 Devpost Rules 为准，尤其复核仓库主机、视频可见性和类别细则。

## 2. 公开仓库白名单与发布前清单

### 白名单

1. **GitHub** — 推荐，README、MIT、静态 Demo 和视频链接最容易集中展示。
2. **GitLab** — 可用，确认仓库 Visibility 为 Public。
3. **Bitbucket** — 可用，确认仓库为 Public。

未列入白名单的平台不要作为主参赛仓库。仓库必须公开可访问，不能只给评委私有链接。

### 用户授权发布后需检查

- [ ] 选定一个白名单主机，创建公开仓库并配置远程地址。
- [ ] 确认 `LICENSE` 的 MIT 版权主体符合实际权利归属。
- [ ] 根目录保留 `README.md`、`LICENSE`、`index.html`、`run-windows.bat`、`SUBMISSION.md`。
- [ ] 保留 `evidence/jetbrains/`；原 `.idea/inspection-results*` 被 `.gitignore` 忽略，不能只依赖那些目录作为公开证据。
- [ ] 不提交账号、Cookie、API Key、`.env`、个人浏览器数据或本机绝对路径。
- [ ] 推送前在干净环境执行 `python scripts/verify_local.py`。
- [ ] 以未登录浏览器打开公网 Demo，确认无需账号或密钥。
- [ ] 提交 Devpost 前再次检查 Rules、类别、资格和截止时间。

## 3. Demo 启动说明

### 环境

- 运行游戏：Python 3.10+ 与现代浏览器；不需要 `npm install`。
- 运行测试：Node.js 18+；只使用 Node 内置测试模块。
- 网络：首次本地加载不需要联网；没有第三方字体、图片、音乐、追踪器或网络 API。

### Windows 一键启动

双击根目录：

```text
run-windows.bat
```

脚本会启动 `http://127.0.0.1:8010/` 并打开默认浏览器。若 8010 被占用，先关闭占用进程，或使用命令行指定其他端口。

### 命令行启动

在项目根目录执行：

```bash
python server.py --port 8010
```

Windows 若 `python` 未映射，可尝试：

```bash
py -3 server.py --port 8010
```

也可使用现有 npm 脚本，无需安装依赖：

```bash
npm run serve -- --port 8010
```

### 地址

| 用途 | 地址 |
|---|---|
| 正常游戏 | `http://127.0.0.1:8010/` |
| Booth 自动轮换 | `http://127.0.0.1:8010/index.html?booth=1` |
| 独立排行榜 | `http://127.0.0.1:8010/leaderboard.html` |
| 排行榜管理入口 | `http://127.0.0.1:8010/leaderboard.html?manage=1` |

Booth 模式在每局结束后倒数 15 秒自动开始下一局；打开本地排行榜时暂停倒数。排行榜基于同一设备、同一 origin 的 `localStorage`，不是跨设备网络排行榜。

### 静态托管

项目没有构建步骤。将仓库根目录作为静态站点发布，`index.html` 即为入口。Python 服务器只是本地便利工具，不是游戏后端。首次成功加载后，Service Worker 会缓存应用外壳以支持离线重载。

### 本地复核

```bash
python scripts/verify_local.py
```

脚本仅使用 Python 标准库和本机 Node，检查必需文件、MIT、HTML 资源引用、Service Worker 外壳、截图、视频时长、Node 测试，以及临时本地服务器上的 7 个 HTTP 端点与安全响应头。可选：

```bash
python scripts/verify_local.py --report evidence/local-verification.txt
```

## 4. 方法说明

### 面向现场的设计

- **短局循环：** 每局固定 45 秒，规则一眼可懂，结算后立即复玩。
- **清晰反馈：** 青色信号、蓝色奖励、红色噪声使用不同形状、颜色和合成音效。
- **摊位模式：** 15 秒自动重置，减少工作人员介入；独立屏幕显示本地前十。
- **零门槛：** 无登录、无 API Key、无安装、无外部素材。

### 工程方法

- `game-core.js` 是确定性规则核心，独立负责计分、目标寿命、倍率、命中率、暂停和回合状态；随机源可注入，便于稳定测试。
- `renderer.js`、`audio.js`、`game.js`、`leaderboard.js` 分别负责 Canvas 渲染、Web Audio 合成、输入与界面、本地排行榜。
- 长帧间隔最多推进 100ms；切到后台或窗口失焦会自动暂停，避免隐藏时间偷偷耗尽回合。
- 信号基础分 100、奖励 200、噪声 −75、空点 −25；4/9/16/25 连击依次解锁 1.5×/2×/3×/4×。
- 排行榜最多保留 10 条，清洗呼号与数值，按分数、准确率、时间排序；存储损坏或被禁用时退化为当前页面内存排行榜。
- 用户呼号通过 `textContent` 渲染，不使用 `innerHTML`。
- Service Worker 缓存本地应用外壳；页面 CSP 设置 `connect-src 'none'`，游戏不发起业务网络请求。

### 可访问性与原创性

- 支持鼠标、触屏和键盘；方向键选择，Space/Enter 锁定，P/Escape 暂停，M 静音。
- 提供可见焦点、减少动态、高对比、状态播报和响应式布局。Canvas 内容并非完整屏幕阅读器可操作，键盘选择与状态播报是替代交互路径。
- 名称、SVG/CSS/Canvas 图形与 Web Audio 音效均为项目原创；未使用 Cloud9 官方标志、第三方音乐或外部素材。

## 5. 视频交付与分镜存档

### 规格

- **目标时长：2:40（160 秒）**，为 3 分钟上限预留 20 秒。
- 建议 1920×1080、30fps、H.264 MP4、AAC 旁白；现有 52 秒草案可作画面素材。
- 中文旁白配中文字幕；游戏内保留英文界面。只使用游戏合成音效或不使用背景音乐。
- 录制前清空本地排行榜，呼号使用 `DEMO`，隐藏书签、通知和个人信息。
- 必须展示真实操作与真实得分，不伪造排行榜或测试结果。

### 分镜

| 时间 | 时长 | 画面 / 操作 | 中文旁白 |
|---|---:|---|---|
| 0:00–0:10 | 10s | 快剪：开始界面、命中信号、连击、结算。标题 `SIGNAL RUSH`。 | Signal Rush：45 秒，接住信号，甩开噪声。这是为 Cloud9 与 JetBrains 活动现场准备的即开即玩小游戏。 |
| 0:10–0:25 | 15s | 展示一键启动、开始页、呼号与操作提示。 | 没有登录，没有安装。玩家点击或轻触开始，鼠标、触屏和键盘都能操作。每局固定 45 秒，成绩立刻可见，天然适合摊位排队和连续挑战。 |
| 0:25–1:15 | 50s | 完整真实一局：青色信号、蓝色奖励、红色噪声、倍率提升；偶尔放大 HUD。 | 青色信号加 100 分，蓝色奖励加 200 分，红色噪声扣 75 分。连续命中会提升倍率，从 1.5 倍一路到 4 倍。接下来是一局真实对战：看信号、避噪声、保持连击。后半段让真实游戏声与字幕接管，不持续说话。 |
| 1:15–1:35 | 20s | 结算特写：等级、分数、准确率、最佳连击、本地排名；点击 `RUN IT BACK`。 | 时间到，等级、准确率、最佳连击和本地排名一次呈现。一键再来，现场下一位玩家无需等待。 |
| 1:35–1:55 | 20s | 切换 Booth 模式，展示 15 秒倒数；打开排行榜时倒数暂停；切到独立排行榜屏幕。 | Booth 模式在结算后 15 秒自动重置；打开排行榜时倒计时暂停。同一设备的第二块屏幕能实时显示本地前十，全程无需账号或网络。 |
| 1:55–2:15 | 20s | 键盘方向键选择、Space 锁定、P 暂停/恢复；切到减少动态选项与手机竖屏。 | 键盘方向键选择、空格锁定，P 键暂停；同时提供减少动态、可见焦点和状态播报。画面与音效由 Canvas、SVG 和 Web Audio 实时生成。 |
| 2:15–2:30 | 15s | IntelliJ IDEA：项目树、检查配置、修复前问题、`node --test` 的 26/26。 | 项目在 IntelliJ IDEA 2025.3 中开发检查。IDE 发现 CSS 变量和 Service Worker Promise 问题，修复后最终检查零问题，Node 测试 26 项全部通过。 |
| 2:30–2:40 | 10s | 回到游戏主视觉；叠字 `45 SEC · OFFLINE READY · PLAY AGAIN`，结尾仓库/Demo 链接。 | Signal Rush，简单操作，短局，高分复玩。公开仓库、启动说明和完整证据都在提交包中。 |

旁白约 460 字，配合 50 秒真实 gameplay 段落，自然语速可在 2:40 内完成。若录音超时，优先压缩方法段，不加速到难以听清。

## 6. 截图与录屏素材清单

### 已有素材

| 文件 | 尺寸 / 时长 | 用途 | 状态 |
|---|---|---|---|
| `media/01-start.png` | 762×975 | 开始页、规则与一键入口 | 已有 |
| `media/02-gameplay.png` | 762×975 | 目标形状、色彩与场景构图 | 已有；正式视频需另录有得分操作 |
| `media/03-results.png` | 762×975 | 结算、等级与本地排名 | 已有 |
| `media/04-leaderboard.png` | 762×975 | 游戏内本地前十 | 已有 |
| `media/05-booth-display.png` | 762×1515 | 独立 Booth 排行榜 | 已有 |
| `media/signal-rush-demo.mp4` | 52s，H.264，1280×720 | 无声字幕画面草案 | 已有；非正式旁白版 |
| `media/signal-rush-demo-final.mp4` | 160s，H.264，1280×720，AAC | 2:40 最终本地参赛素材 | 已验证；真实 Demo/截图/JetBrains 文本证据，待授权上传 |

### 建议补录

| 建议文件 | 内容 | 必需性 |
|---|---|---|
| `media/06-keyboard-pause.png` | 键盘锁定与暂停覆盖层 | 建议 |
| `media/07-booth-countdown.png` | 15 秒自动重置倒数 | 建议 |
| `media/08-intellij-inspection.png` | IntelliJ 检查配置与修复前后证据 | 视频必需 |
| `media/09-intellij-tests.png` | IntelliJ 终端 `node --test` 26/26 | 视频必需 |
| `media/10-mobile-gameplay.png` | 手机竖屏真实操作 | 建议 |
| `media/signal-rush-demo-final.mp4` | 2:40 真实 Demo、字幕、JetBrains 文本/JSON 证据 | 已完成；待授权上传 |

所有补充素材只保存本地，上传与公开展示由用户决定。

## 7. JetBrains 工具使用证据清单

### 已有证据

| 证据 | 路径 | 说明 |
|---|---|---|
| IDE 版本 | `evidence/jetbrains/idea-version.txt` | IntelliJ IDEA 2025.3，IU-253.28294.334 |
| 检查配置 | `evidence/jetbrains/inspection-profile.xml` | `Signal Rush Checks` 配置副本 |
| 修复前 CSS 问题 | `evidence/jetbrains/before-css-unresolved.json` | 未解析 CSS 自定义属性 |
| 修复前 Promise 问题 | `evidence/jetbrains/before-ignored-promises.json` | `skipWaiting()` 与 `clients.claim()` 返回值未纳入生命周期 |
| 修复前 CSS 复审项 | `evidence/jetbrains/before-css-unused.json` | 动态类名等未使用符号警告，已人工复审 |
| 最终检查摘要 | `evidence/jetbrains/final-inspection-summary.txt` | 干净输出目录无具体问题文件；环境警告单独注明 |

复现命令：

```bash
idea64.exe inspect <project> .idea/inspectionProfiles/Signal_Rush_Checks.xml <empty-output-dir> -format json -v2
```

### 视频中需展示

- IntelliJ 项目树与 `Signal Rush Checks` 配置。
- 修复前 JSON 中的 CSS / Promise 问题。
- 修复后的 `leaderboard-display.css` 与 `sw.js`。
- 终端执行 `node --test`，定格 26/26。
- 不声称使用未实际使用的 Air、Junie 或 AI Agent；如要申请 Best AI-Powered Workflow Story，需另行补真实工作流证据。

## 8. 本轮验收结果

- `node --test`：**26/26 通过，0 失败**；包含 100 局连续 booth 重置测试。
- 本地服务器：根页面、Booth 入口、独立排行榜、Service Worker、核心 JS、CSS、manifest 共 7 个端点返回 200，内容类型与安全头有效。
- 静态包：HTML 本地资源引用、Service Worker 外壳、MIT、5 张 PNG、52 秒 MP4 均通过本地脚本检查。
- IntelliJ IDEA：最终干净检查未产生具体问题文件；WSL、配色方案和无关数据库检查描述缺失属于工具环境警告，不作为源码问题。
- 真实浏览器：仓库 README 已记录完整一局、重载后成绩保留、独立排行榜、停服务器后离线重载和 Booth 自动重启。本轮外部 Browser Connector 未连接，因此未重复浏览器自动化；上传前建议人工再复核一次。

## 9. 剩余需用户确认的动作

- [ ] 登录 Devpost，确认报名、资格、队伍信息、Event minigame 类别与最终 Rules。
- [ ] 选择 GitHub / GitLab / Bitbucket 中一个主机，确认仓库名、公开可见性和 MIT 版权主体。
- [ ] 授权后才创建远程、提交新增交付文件、推送和公开仓库。
- [ ] 决定公网 Demo 方案；发布后以无痕窗口验证无需登录。
- [ ] 按第 5 节录制 2:40 正式视频，补拍 JetBrains 镜头，确认最终时长和旁白可听性。
- [ ] 确认 YouTube 上传与 Public/Unlisted 可见性要求，授权后才上传。
- [ ] 最终人工浏览器复核；如继续使用 Browser Connector，请先连接扩展。
- [ ] 涉及新协议、付费、账号权限或公开发布的动作，均等待用户明确授权。

## 10. 参考链接

- [JetBrains 官方赛事说明](https://blog.jetbrains.com/blog/2026/11/17/sky-s-the-limit-the-cloud9-jetbrains-global-hackathon-is-back/)
- [Devpost 官方赛事页](https://cloud9.devpost.com/)
- [Devpost 官方 Rules](https://cloud9.devpost.com/rules)
- [仓库白名单与提交 checklist 交叉参考](https://www.startupgrantsindia.com/cloud9-jetbrains-hackathon-2026)
- [参赛准备 secondary playbook](https://dev.to/hrlpavan/cloud9-x-jetbrains-hackathon-2026-step-by-step-winning-playbook-51gc)
