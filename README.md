# MotionLab v0.9.2 — 重复提问 / 残缺回答修复

针对真实反馈：同一日语问题第一次回答正常，第二次可能出现英文技术笔记或在 `pH` 后直接中断。问题不是用户重复点击错误。此前每次单独请求Gemini，但后端 `max_output_tokens=650`、没有检查 `finish_reason`、也没有验证输出语言/完整性。

## 本版修复

- 针对Gemini 3.5 Flash采用 `thinking_level=low`，并扩大输出token预算，减少内部推理耗尽输出上限的概率。
- 检测 `MAX_TOKENS`、空结果、缺少完整结束符或回答语言不匹配；后台最多自动重试一次，不将残缺回答显示给学生。超时/失败会显示可理解的多语言错误消息。
- 输入日语/中文/英语问题时，优先按照问题所用语言回答，即使顶部UI语言不同。
- 对用户未提问的虚拟分子动力学实现细节不再主动输出；先直接回答当前实验的科学问题。
- 后端记录失败类别、输出字符数和结束原因，**不会记录提问内容、API密钥或生成文本**。
- 3D与2D都使用同一个修复后的后台服务，不改动摄像头识别和科学实验模块。

## 从旧版升级并启动

```bash
cd ~/intern/hackason/motionlab-v0.9.2-ai-reliability
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
export GOOGLE_CLOUD_PROJECT="$(gcloud config get-value project)"
export GOOGLE_CLOUD_LOCATION="global"
export MOTIONLAB_AI_PROVIDER="vertex"
export GEMINI_MODEL="gemini-3.5-flash"
python -m uvicorn app.main:app --reload --port 8019
```

访问 http://127.0.0.1:8019/ （3D）或 http://127.0.0.1:8019/classic （2D）。打开 http://127.0.0.1:8019/api/version 核对版本为 `0.9.2`。同一个问题点击两遍；应收到完整回答，或明确提示无法完成，不应出现英文残句。

自动重试可能增加Gemini调用次数与费用，请注意Google Cloud额度；应用有每客户端6次/分钟的基本限流，不是费用硬上限。已使用本地模拟响应验证重复点击和截断恢复；**尚未使用用户Google Cloud账号验证真实重试，也无法在本环境完成Mac摄像头端到端测试**。

---

# MotionLab v0.9.2 — Gemini AI 实验导师接入版

在 v0.9.0 上新增了 **Gemini AI 科学解释与实验反馈**，2D/3D 均有提问入口；3D完成实验可自动生成AI评价，2D增加显式“使用Gemini评价这次实验”按钮。实验数值依旧由本地科学规则引擎计算，视频帧不上传到Gemini。未配置云端时，其余实验可以继续运行，教学反馈降级为规则说明。

## 用 Vertex AI 接入（推荐，无需API Key）

**以下命令需用户本人在 Mac Terminal 执行。** 需要安装Google Cloud CLI（`gcloud`），选择已开启结算的Google Cloud项目。不要把密码、密钥或登录token提供给他人。`PROJECT_ID` 指 **项目ID**，不一定与项目显示名称相同。

```bash
cd ~/intern/hackason/motionlab-v0.9.2-ai
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt

# 下面替换成自己Google Cloud Console里看到的项目ID
export GOOGLE_CLOUD_PROJECT="YOUR_PROJECT_ID"
export GOOGLE_CLOUD_LOCATION="global"
export MOTIONLAB_AI_PROVIDER="vertex"
export GEMINI_MODEL="gemini-3.5-flash"

gcloud auth login
gcloud config set project "$GOOGLE_CLOUD_PROJECT"
gcloud services enable aiplatform.googleapis.com --project "$GOOGLE_CLOUD_PROJECT"
gcloud auth application-default login
gcloud auth application-default set-quota-project "$GOOGLE_CLOUD_PROJECT"

python -m uvicorn app.main:app --reload --port 8019
```

如果提示 `gcloud: command not found`，先安装Google Cloud CLI： https://cloud.google.com/sdk/docs/install 。如果报 `PERMISSION_DENIED`，确认本人有该项目的Vertex AI访问权限（例如 `roles/aiplatform.user`）、Service Usage所需权限，且已启用结算和API。不要为了绕过权限而把账号凭据写进源码。

打开 `http://127.0.0.1:8019/api/ai/status`：应显示 `configured:true`、`provider:vertex`。**注意这只能验证环境变量，不能证明实际调用成功。** 然后在 `http://127.0.0.1:8019/` 右侧「Gemini AI实验导师」输入一个问题，如「为什么中和过程中pH会变化？」并提交。收到标有 `Gemini:` 的回复，才算实际成功连接。

也可用终端进行本地API调用测试（不能绕过后端授权）：

```bash
curl -s -X POST http://127.0.0.1:8019/api/ai/ask \
  -H 'Content-Type: application/json' \
  -d '{"scenario":"neutralization","language":"zh","question":"为什么pH会变化？","volumeMl":15,"ph":3,"temperatureC":20,"phenomenon":"无色透明","observations":[]}'
```

## Google Cloud Run 部署（使用服务账号授权，推荐）

先确认 `gcloud` 已安装且已登录，项目已开通结算。配置独立服务账号，不上传API Key或JSON私钥：

```bash
export PROJECT_ID="YOUR_PROJECT_ID"
gcloud config set project "$PROJECT_ID"
gcloud services enable aiplatform.googleapis.com run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project "$PROJECT_ID"

gcloud iam service-accounts create motionlab-ai --display-name="MotionLab AI Runner" --project="$PROJECT_ID"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:motionlab-ai@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

gcloud run deploy motionlab --source . --region asia-northeast1 \
  --service-account "motionlab-ai@${PROJECT_ID}.iam.gserviceaccount.com" \
  --set-env-vars "MOTIONLAB_AI_PROVIDER=vertex,GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GOOGLE_CLOUD_LOCATION=global,GEMINI_MODEL=gemini-3.5-flash" \
  --allow-unauthenticated --max-instances 2
```

此部署的Web页面可公开访问，意味着**公开的AI提问接口也可被访问**。MVP加入了进程内限流，但这不是跨实例的预算保障；比赛演示请注意结算、配额和Cloud Run的预算提醒，正式公开上线应增加Firebase Authentication、API Gateway或Cloud Armor等访问控制。`--max-instances 2` 不是费用封顶。Cloud Run默认可能有费用，Google Cloud预算告警也不会自动停止消费。

如果服务账号已存在，可以跳过 `create`；如果提示你没有 `iam.serviceAccounts.create`、`setIamPolicy` 或 `run.admin` 的权限，请使用项目拥有者账号授予恰当权限，不要随意扩大权限。

## 备用方案：Google AI Studio API Key

如果只是暂时测试，可在Google AI Studio创建Gemini API Key，然后在**本机终端**设置：

```bash
export MOTIONLAB_AI_PROVIDER=developer
export GEMINI_API_KEY="<在本机设置的KEY>"
export GEMINI_MODEL=gemini-3.5-flash
```

不推荐把真实key写入代码、网页、README或GitHub，也不要发到聊天中。这个Developer API是否使用Google Cloud比赛抵用金，取决于API计费设置，**不要假定一定自动扣除你的Google Cloud credits**。

## API与技术边界

- `GET /api/ai/status` 返回 `configured`、`provider`、`model`，不包含密钥；仅表示配置已提供，是否真实调用成功要以测试请求为准。
- `POST /api/feedback` 读取已验证的模拟数据，返回 `source=gemini`（真实调用成功）或 `source=rules` / `rules-fallback`（未启用或失败）。
- `POST /api/ai/ask` 允许学生就当前五种实验提出问题；错误或未配置时返回本地化说明。
- 仅以科学规则引擎为正确数值来源。Gemini不能访问摄像头视频、不能证明实际动作发生、不能执行危险的真实实验指导。
- 对单个客户端约6次/分钟、单实例约50次/分钟的最佳努力限流；正式部署应增加认证、集中限流与预算上限策略。
- AI模型可用性、所在地区、IAM权限、账单额度必须由用户在自己的Cloud项目中验证。本代码未连接真实账号进行过在线API实测。

## 旧版功能和操作

# MotionLab v0.9.0 — 实时微观观察 / 日本語・English・中文

这是在 MotionLab v0.8.1 上继续开发的教育游戏 MVP，包含固定平视的 3D 实验台、2D 实验台、摄像头手势操作、简化的刚体/倾倒/化学反应引擎。**本版重点是持续显示微观变化、三语言运行中切换，以及容器内容物数据的一致性。**

> **使用范围：教学原型。** 反应模型只覆盖预设的五种实验，显微粒子是依据化学计量构建的教学示意，**不是真实分子动力学、流体力学或化学安全认证软件**。不要用本程序代替教师监督或真实实验操作规程。

## 本版新增

1. **微观始终可见**：3D 实验室右侧顶部是永久显示的「LIVE MICROSCOPY」区域；2D 右侧数据栏顶部也同时显示微观画面。**不必点击弹窗按钮**，微观粒子会随着实验状态自动更新。
2. **中文 / 日文 / 英文即时切换**：顶部新增 `Language / 言語 / 语言` 下拉框。切换后不重载网页、不重置实验、也不主动关闭摄像头。2D和3D共享语言偏好（浏览器 localStorage）。主要按钮、实验标题、试剂标签、五种课程的指导步骤、微观说明、技术帮助、课程目录与本地学习报告都有三语言内容。语言切换后再次请求AI学习反馈时，后端也要求以当前语言回答；没有密钥时的规则反馈提供三语言版本。**部分源自早期物理交互模块的动态故障日志仍可能以中文显示；该部分尚不能宣称已完全本地化。**
3. **每个3D容器保留独立化学状态**：试管、烧杯和锥形瓶分别持有模型，记录体积、来源组分、温度、pH（适用时）和实验现象。鼠标悬停可看内容物，并显示部分溶液的**分析浓度**（来源成分的物质的量除以当前体积）。分析浓度不同于反应后自由离子的实际活度或浓度。
4. **改善倒液组分守恒**：两个容器之间的转移除了体积外，还更新来源组分和温度。溶解实验中**不溶解的食盐颗粒不会作为澄清液体被自动倒出**；被转移的已溶食盐按守恒规则计入目标容器。
5. **2D ↔ 3D 主实验容器状态交接**：在同一个浏览器标签页切换2D/3D，主接收容器的实验类别与化学状态可通过 sessionStorage 交接。**3D中其他器材的位置、多只附加容器、手部追踪状态不会跨页面完整恢复**，仍属于后续开发项目；切换时游戏场景可重新布置。

## Mac 本地启动

首先把 ZIP 解压到一个新目录，不要把新版覆盖旧文件。进入解压后的 `motionlab-v0.9.0`：

```bash
cd ~/intern/hackason/motionlab-v0.9.0
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
python -m uvicorn app.main:app --reload --port 8017
```

如果你解压到了 `~/Downloads/`，请把第一行替换为：

```bash
cd ~/Downloads/motionlab-v0.9.0
```

浏览器地址：

- **3D固定平视实验室**：http://127.0.0.1:8017/
- **2D实验室**：http://127.0.0.1:8017/classic
- **摄像头自检**：http://127.0.0.1:8017/camera-check
- **版本校验**：http://127.0.0.1:8017/api/version —— 必须看到 `0.9.0`

网页顶部应显示 `v0.9.0 · LIVE MICRO / 3 LANGUAGES`。如果显示旧版，确认新终端是否使用了 `8017` 端口，再用 Mac Chrome 的 `⌘ + Shift + R` 刷新。

## 5分钟验收流程

1. 打开3D页面，不点「微观观察」。右侧顶部就应看到微观画布和当前实验现象；在2D页面也应直接看到右侧微观画面。
2. 在3D右侧选择酸碱中和，点击「辅助对准并倾倒 3mL」。检查 pH、容器内容物、液量、微观粒子是否同步变化。
3. 把页面顶部语言从「中文」切到「日本語」，再切到「English」。观察课程选择、操作向导、器材名称、微观说明是否更新。**切换语言不能重置液量、pH或正在进行的实验**。
4. 在3D里选中一只装有液体的试管，悬停查看内容物；将液体倒入另一容器后，再悬停两只容器检查不同的液量、分析浓度及来源组分。
5. 在3D里加入一些NaOH后，通过顶部入口切换到2D，查看主容器的体积和反应状态是否延续。再从2D返回3D，对照同一主容器状态。器材位置不会同步恢复。
6. 通过「生成学习反馈」检查当前语言的学习报告。可任选加热、气体、沉淀、溶解实验继续验证。

> 如果摄像头暂时不可用，可以直接用鼠标、按钮或自动实验模式完成内容测试。MediaPipe、Three.js、Cannon-es 资源来自外网CDN，离线运行时可能无法启动手势和3D模块。

## 技术结构

- `app/static/experiment-engine.js`：预设化学实验模型、各容器组分、分析浓度、微观状态、可序列化快照、等比例倒液。
- `app/static/lab3d.js`：Three.js + Cannon-es 实验台、器材物理、可见倒液、摄像头抓取交互。
- `app/static/studio2d.js`：Canvas 2D 游戏式实验台，共享化学引擎。
- `app/static/app3d.js`：3D主界面、实验操作向导与始终更新的微观画面。
- `app/static/i18n.js`：三语言词典、DOM更新与即时切换，不调用在线翻译服务。
- `app/static/lab-session.js`：浏览器标签页内的2D/3D主容器状态交接。
- `app/main.py`：FastAPI服务、版本接口和支持三种语言的Gemini/规则学习反馈。

## 验证

```bash
node --test tests/*.test.mjs
python -m pytest -q
```

构建时自动测试结果：**75项JavaScript测试、15项Python测试通过**。包括语言基础词典、独立容器转移与质量守恒、未溶盐、状态快照、API语言回退、2D/3D页面存在性。

**尚未验证：** 本环境的自动浏览器访问 `localhost` 遭到管理员网络策略阻止，所以**没有完成真实Mac摄像头、MediaPipe抓取、WebGL画面和多语言实际点击的端到端验收**。你在自己的Mac上第一次运行时，请特别看是否有白屏、缺失3D依赖、微观画布溢出或菜单布局问题。如有问题请附浏览器控制台报错。

## Google Cloud Run 部署

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
gcloud run deploy motionlab --source . --region asia-northeast1 --allow-unauthenticated
```

Gemini解释功能是可选的。要使用它，需要安全配置 `GEMINI_API_KEY`，不要把密钥写入源代码或提交到GitHub。没有密钥时也可使用本地规则反馈。注意 Cloud Run 预算提醒不等同于硬性支出上限。
