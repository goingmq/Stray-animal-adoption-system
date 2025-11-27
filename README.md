# 流浪动物救助与领养平台 (Stray-animal-adoption-system)

## 项目简介  
该项目旨在构建一个完整的流浪动物登记、寄养、领养与后续管理系统，覆盖从动物被发现、寄养管理、健康记录、领养申请与审核、到最终领养与后续回访的“领养全流程”。平台同时集成收益系统（疫苗服务、食粮供应、保险合作、捐助渠道等），以支撑平台持续运行与维护。项目目标是建立一个流程规范、角色清晰、信息透明、可长期运行的平台系统。

## 核心功能  
- 流浪动物登记与信息录入  
- 寄养流程管理 —— 支持机构寄养与家庭寄养双路径  
- 健康与行为记录功能（健康档案 / 行为观察 / 回访记录）  
- 领养申请、身份与背景审核、家访流程  
- 领养后回访机制（支持多节点回访）  
- 收益系统模块 —— 包括疫苗服务合作、食粮供应、宠物保险、用户/企业捐助等可选服务  

## 技术栈 / 环境  
- **前端**：JavaScript + HTML / CSS（React 或 Vue 可选）  
- **后端**：C#（例如 ASP.NET / Web API）  
- **数据库**：MySQL  
- **部署环境**：云服务器或校内服务器  
- **通知服务**：可通过邮件 / 短信接口集成  


## 快速开始  

### 前提条件  
- 安装 .NET 运行时 / SDK（支持后端 C#）  
- 配置 MySQL 数据库  
- 安装现代浏览器用于前端测试  

### 本地部署示例流程  

```bash
# 克隆项目
git clone https://github.com/goingmq/Stray-animal-adoption-system.git
cd Stray-animal-adoption-system

# 后端
cd backend
# 使用 .NET CLI / Visual Studio 构建并启动服务
dotnet build
dotnet run   # 启动 Web API 服务

# 前端
cd ../frontend
# 若使用 npm/yarn 的构建方式，安装依赖并启动
npm install
npm run dev  # 或 npm start

# 然后在浏览器访问前端（通常 http://localhost:xxxx），前端通过 API 调用后端 C# 服务，与 MySQL 数据库通信
````

> 注意：数据库连接字符串、API 地址、前端配置等应根据实际环境修改。

## 功能流程 / 使用说明

* 拾主注册 → 登记流浪动物 → 选择寄养方式 → 上传基础资料
* 寄养机构 / 家庭接受寄养 → 记录健康与行为情况 → 上传健康档案
* 宠物进入“可领养”列表 → 领养人查看详情 → 提交申请 → 管理员审核 + 家访
* 审核通过 → 完成领养 → 后续定期回访与数据记录
* 收益系统：领养人 / 寄养机构 / 合作商家可使用附加服务（疫苗、食粮、保险等）

## 当前状态

项目处于开发 / 课程项目阶段 —— 基础架构与模块规划已完成。欢迎贡献代码、提交 issue 或参与测试。

## 贡献 & 参与方式

欢迎任何对本项目感兴趣的开发者／同学参与：

* Fork 仓库
* 创建分支进行功能开发或文档完善
* 提交 Pull Request

请遵守代码规范、补充必要的文档与注释，并说明修改目的。

## 团队信息

* 2351707 马敏慧智
  * 项目组长：项目规划与需求看板管理
  * 测试与文档：测试管线开发与报告撰写
  * UML图，用例图：协助设计
  前、后端代码开发
* 2352191 吴昀洁
  * UI快照：设计
  * UML图，用例图：设计
  * 前、后端代码开发


## 联系方式

如有问题、建议或合作意向，请通过 GitHub Issues 提交，或在仓库中留言。

---


## 项目文件结构

```
Stray-animal-adoption-system/
├── backed/                     # 后端代码目录
├── fronted/                    # 前端代码目录
├── Documents/                  # 项目文档目录
│   ├── Proposal/              # 项目提案文档
│   ├── Requirements/          # 需求文档
│   ├── UI/                    # UI设计文档
│   ├── activity-diagram/      # 活动图
│   ├── flow-chart/            # 流程图
│   └── use-case-diagram/      # 用例图
└── README.md                   # 项目说明文件
```

### 目录说明

- **backed/**: 存放后端服务代码
- **fronted/**: 存放前端应用代码
- **Documents/**: 存放项目相关文档
  - **Proposal/**: 项目提案和计划文档
  - **Requirements/**: 功能需求和技术需求文档
  - **UI/**: 用户界面设计稿和原型
  - **activity-diagram/**: UML活动图
  - **flow-chart/**: 业务流程图
  - **use-case-diagram/**: UML用例图# Stray-animal-adoption-system
