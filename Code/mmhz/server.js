// server.js
console.log(">>> 当前 server.js 已加载成功 <<<");

const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = 3000;

// 解析 JSON 数据
app.use(express.json());

// 提供静态文件（前端页面）
app.use(express.static(path.join(__dirname, 'public')));

// 初始化数据库
const db = new sqlite3.Database(path.join(__dirname, 'revenue.db'));

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      service_type TEXT,
      product_name TEXT,
      amount REAL,
      created_at TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS revenue_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      revenue_type TEXT,
      amount REAL,
      created_at TEXT
    )
  `);
});

// 模拟产品数据
const vaccinePackages = [
  { id: 1, name: '基础免疫套餐', amount: 199 },
  { id: 2, name: '全套防疫套餐', amount: 399 }
];

const foodProducts = [
  { id: 11, name: '皇家幼猫粮 2kg', amount: 128 },
  { id: 12, name: '伯纳天纯全价犬粮 5kg', amount: 239 }
];

const insurancePlans = [
  { id: 21, name: '基础健康险', amount: 199 },
  { id: 22, name: '高级医疗险', amount: 399 }
];

// API：获取各类套餐列表
app.get('/api/vaccine', (req, res) => {
  res.json(vaccinePackages);
});

app.get('/api/food', (req, res) => {
  res.json(foodProducts);
});

app.get('/api/insurance', (req, res) => {
  res.json(insurancePlans);
});

// API：支付接口
app.post('/api/payment', (req, res) => {
  const { service_type, product_name, amount } = req.body;

  if (!service_type || !product_name || !amount) {
    return res.status(400).json({ error: '缺少必要字段' });
  }

  const now = new Date().toISOString();
  const userId = 1; // 简化，固定用户 ID

  // 创建订单
  db.run(
    `INSERT INTO orders (user_id, service_type, product_name, amount, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, service_type, product_name, amount, now],
    function (err) {
      if (err) {
        return res.status(500).json({ error: '创建订单失败' });
      }

      const orderId = this.lastID;

      // 记录收益
      db.run(
        `INSERT INTO revenue_records (order_id, revenue_type, amount, created_at)
         VALUES (?, ?, ?, ?)`,
        [orderId, service_type, amount, now],
        (err2) => {
          if (err2) {
            return res.status(500).json({ error: '记录收益失败' });
          }

          res.json({ status: 'success', order_id: orderId });
        }
      );
    }
  );
});

// 获取所有订单（用于查看平台收入）
app.get('/api/orders', (req, res) => {
  console.log(">>> /api/orders 被访问了");

  db.all(`
    SELECT 
      o.id, 
      o.service_type, 
      o.product_name, 
      o.amount, 
      o.created_at,
      r.amount AS revenue
    FROM orders o
    LEFT JOIN revenue_records r
    ON o.id = r.order_id
    ORDER BY o.id DESC
  `, [], (err, rows) => {
    if (err) {
      console.log(">>> SQL 错误：", err);
      return res.status(500).json({ error: '无法读取订单数据' });
    }
    res.json(rows);
  });
});


// 启动服务器
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
