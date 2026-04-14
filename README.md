# 🏸 菜狗羽球 (VegDog Badminton)

<p align="center">
  <img src="docs/vegdog_logo.svg" alt="VegDog Logo" width="160" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Framework-Next.js%2015-black?style=flat&logo=next.js" alt="Next.js 15">
  <img src="https://img.shields.io/badge/Database-Supabase-3ECF8E?style=flat&logo=supabase" alt="Supabase">
  <img src="https://img.shields.io/badge/Language-TypeScript-3178C6?style=flat&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Styling-Tailwind%20CSS-06B6D4?style=flat&logo=tailwindcss" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/Deployment-Vercel-000000?style=flat&logo=vercel" alt="Vercel">
</p>


**菜狗（VegDog）** 是一个基于 **Next.js + Supabase** 构建的全栈 Web 应用，旨在为菜狗羽毛球群提供简洁、高效的约球管理方案。

本项目通过自动化流程取代传统的社交软件群接龙，解决了报名统计混乱、并发冲突、晚退判定困难以及收款对账繁琐等核心痛点。

<p align="left">
  <a href="https://vegedog-badminton-webapp.vercel.app/">
    <img src="docs/open_app_btn.svg" alt="打开菜狗 App">
  </a>
</p>

## 📱 应用截图

<p align="center">
  <img src="docs/screen_1.png" width="30%" alt="接龙列表" />
  &nbsp;&nbsp;&nbsp;
  <img src="docs/screen_2.png" width="30%" alt="场次详情" />
  &nbsp;&nbsp;&nbsp;
  <img src="docs/screen_3.png" width="30%" alt="付款详情" />
</p>

---

## ✨ 核心功能

- **自动化接龙**：一键参与报名，内置自动候补（Waitlist）机制。当正选名额空缺时，候补人员将按先后顺序自动填充。
- **并发冲突保护**：数据库层面采用 PostgreSQL 咨询锁（Advisory Locks），确保在高并发点击场景下，报名顺序与剩余名额的绝对准确。
- **智能晚退判定**：支持自定义"撤回截止时间"。系统自动判定退出行为属于"正常退出"还是"晚退"，并自动核算相应的违约费用。
- **收款流程优化**：集成 Venmo 收款信息展示，支持管理员一键标记付款状态，极大缩短了财务对账路径。
- **轻量化接入**：无需安装客户端，完美适配移动端浏览器。支持 Google OAuth 与无密码 Magic Link 登录。

---

## 🗺️ 产品路线图

### 第一阶段：核心闭环 (MVP) — 已完成
- [x] Google / 邮件 Magic Link 登录集成
- [x] 活动创建、加入、退出及自动候补逻辑
- [x] 响应式移动端 UI 适配
- [x] 个人资料页：绑定 Venmo 账号信息
- [x] 历史记录：查看过去的活动

### 第二阶段：功能完善 (V1) — 开发中
- [ ] 系统通知：通过微信或邮件推送报名状态变更
- [ ] 自动付费统计
- [ ] 后台活跃度、对战历史统计

### 第三阶段：增强模块
- [ ] 菜狗杯：自动配对、ELO 排名、积分追踪

---

## 🚀 快速开始

### 1. 安装依赖

```bash
git clone https://github.com/leotralino/vegedog_badminton_webapp.git
cd vegedog_badminton_webapp
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env.local
```

在 `.env.local` 中填入 Supabase 项目 URL 和 Anon Key：

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. 初始化数据库

在 Supabase SQL 编辑器中依次运行：

1. `supabase/schema.sql` — 建表、RLS 策略、触发器
2. `supabase/patches.sql` — 功能补丁与修复

### 4. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)
