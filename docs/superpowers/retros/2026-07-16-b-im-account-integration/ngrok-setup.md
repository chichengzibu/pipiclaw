# ngrok 内网穿透引导(IM 回调 URL 用)

## 为什么需要 ngrok?
飞书 / 钉钉 / 企微 都需要公网可达的回调 URL(消息接收 URL / 事件订阅 URL)。本机 `http://localhost:5173` 不行,需要用 ngrok 把本机端口暴露到公网。

## 安装 ngrok

### macOS
```bash
brew install ngrok
```

### Windows
```bash
choco install ngrok
# 或下载 https://ngrok.com/download 解压
```

### Linux
```bash
snap install ngrok
```

## 注册 ngrok 账号
1. 访问 https://dashboard.ngrok.com/signup 注册
2. 拿 authtoken:`ngrok config add-authtoken <your-token>`

## 启动 ngrok
```bash
ngrok http 5173
```

Expected output:
```
Session Status  online
Account         [你的账号](Plan: Free)
Version         3.x.x
Region          United States (us)
Latency         90ms
Web Interface   http://127.0.0.1:4040
Forwarding      https://xxxx-xxx-xxx-xxx-xxx.ngrok-free.app → http://localhost:5173
```

**记下 Forwarding 的 `https://xxxx.ngrok-free.app` URL**(公网回调 URL)。

## 配置 IM 平台回调 URL
- **飞书**:开发后台 → 应用 → 事件订阅 → 请求 URL 填 `https://xxxx.ngrok-free.app/im/webhook/feishu`
- **钉钉**:开放平台 → 应用 → 机器人 → 消息接收 URL 填 `https://xxxx.ngrok-free.app/im/webhook/dingtalk`
- **企微**:管理后台 → 应用 → 接收消息服务器 URL 填 `https://xxxx.ngrok-free.app/im/webhook/wechat-work`

**注意**:
- ngrok 免费版 URL 每次启动变,**重启 ngrok 后需重新配 IM 平台**
- ngrok 免费版限速,适合开发调试,生产用 ngrok 付费版或公网服务器

## 验证
在浏览器打开 `https://xxxx.ngrok-free.app`,应看到 PiPiClaw 主界面或 Vite 默认页(说明 ngrok 工作正常)。