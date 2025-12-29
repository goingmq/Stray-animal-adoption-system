const express = require("express");
const path = require("path");
const session = require("express-session");

const { db, init } = require("./db");
const { requireLogin, requireRole, hashPassword, verifyPassword } = require("./auth");

const app = express();
const PORT = 3000;

init();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: "stray-animal-secret-change-me",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(express.static(path.join(__dirname, "public")));

// ====== 兜底建表（防止 db.js 没建齐）======
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password_hash TEXT,
      role TEXT,
      created_at TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS animals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      species TEXT,
      sex TEXT,
      age TEXT,
      status TEXT,
      foster_type TEXT,
      description TEXT,
      location TEXT,
      created_by INTEGER,
      created_at TEXT
    )
  `);

  db.run(`
    ALTER TABLE animals ADD COLUMN foster_type TEXT`, (err) => {
    // SQLite 如果列已存在会报错，直接忽略即可
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS adoption_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      animal_id INTEGER,
      user_id INTEGER,
      contact TEXT,
      reason TEXT,
      status TEXT,
      created_at TEXT,
      reviewed_by INTEGER,
      reviewed_at TEXT
    )
  `);

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

  db.run(`
    ALTER TABLE animals ADD COLUMN foster_type TEXT
  `, (err) => {
    // SQLite 如果列已存在会报错，直接忽略即可
  });

});

// ====== 初始化默认账号 ======
async function seedUsers() {
  const now = new Date().toISOString();

  const ensure = async (username, role, password) =>
    new Promise(async (resolve) => {
      db.get("SELECT id FROM users WHERE username=?", [username], async (err, row) => {
        if (row) return resolve();
        const password_hash = await hashPassword(password);
        db.run(
          "INSERT INTO users (username, password_hash, role, created_at) VALUES (?,?,?,?)",
          [username, password_hash, role, now],
          () => resolve()
        );
      });
    });

  await ensure("admin", "admin", "admin123");
  await ensure("registrar", "registrar", "reg123");
  await ensure("user", "user", "user123");
}
seedUsers();

// ====== 登录/退出/我是谁 ======
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "缺少用户名或密码" });

  db.get("SELECT * FROM users WHERE username=?", [username], async (err, user) => {
    if (err) return res.status(500).json({ error: "数据库错误" });
    if (!user) return res.status(401).json({ error: "用户名或密码错误" });

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "用户名或密码错误" });

    req.session.user = { id: user.id, username: user.username, role: user.role };
    res.json({ status: "ok", user: req.session.user });
  });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => res.json({ status: "ok" }));
});

app.get("/api/auth/me", (req, res) => {
  res.json({ user: req.session.user || null });
});

// ====== 动物：登记/发布/下架/列表 ======
app.post("/api/animals", requireRole("registrar", "admin"), (req, res) => {
  const {
    name,
    species,
    foster_type,
    sex,
    age,
    location,
    description
  } = req.body;

  if (!name || !species) {
    return res.status(400).json({ error: "缺少 name/species" });
  }

  const now = new Date().toISOString();

  db.run(
    `INSERT INTO animals (
      name, species, status, foster_type,
      created_by, created_at,
      sex, age, description, location
    )
    VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      species,
      foster_type || 'family',   // ⭐ 默认家庭寄养
      req.session.user.id,
      now,
      sex || '',
      age || '',
      description || '',
      location || ''
    ],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "创建动物失败" });
      }
      res.json({ status: "ok", animalId: this.lastID });
    }
  );
});

app.get("/api/admin/animals/full", requireRole("admin"), (req, res) => {
  db.all(
    `
    SELECT 
      a.*,
      h.vaccinated,
      h.neutered,
      h.dewormed,
      h.notes,
      h.updated_at AS health_updated_at
    FROM animals a
    LEFT JOIN (
      SELECT *
      FROM health_records
      GROUP BY animal_id
    ) h ON h.animal_id = a.id
    ORDER BY a.id DESC
    `,
    [],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "读取动物列表失败" });
      }
      res.json(rows);
    }
  );
});

// 动物详情 + 最近健康记录（用户/登记/管理员通用）
app.get("/api/animals/:id", (req, res) => {
  const id = Number(req.params.id);

  db.get(
    `SELECT 
       id, name, species, sex, age, location, description, status
     FROM animals
     WHERE id = ?`,
    [id],
    (err, animal) => {
      if (err || !animal) {
        return res.status(404).json({ error: "动物不存在" });
      }

      db.get(
        `SELECT 
           vaccinated, neutered, dewormed, notes, updated_at
         FROM health_records
         WHERE animal_id = ?
         ORDER BY updated_at DESC
         LIMIT 1`,
        [id],
        (err2, health) => {
          res.json({
            animal,
            health: health || {
              vaccinated: 0,
              neutered: 0,
              dewormed: 0,
              notes: "暂无健康记录",
              updated_at: null
            }
          });
        }
      );
    }
  );
});

// 获取动物 + 最新健康信息（给登记端 / 用户端用）
app.get("/api/animals/:id/health", (req, res) => {
  const id = Number(req.params.id);

  db.get(
    `SELECT a.name, a.species, h.vaccinated, h.neutered, h.dewormed, h.notes, h.updated_at
     FROM animals a
     LEFT JOIN health_records h ON a.id = h.animal_id
     WHERE a.id = ?
     ORDER BY h.updated_at DESC
     LIMIT 1`,
    [id],
    (err, row) => {
      if (err || !row) {
        return res.status(404).json({ error: "未找到健康档案" });
      }
      res.json(row);
    }
  );
});

// 发布（draft -> published）
app.post("/api/animals/:id/publish", requireRole("registrar", "admin"), (req, res) => {
  const id = Number(req.params.id);
  db.run("UPDATE animals SET status='published' WHERE id=?", [id], (err) => {
    if (err) return res.status(500).json({ error: "发布失败" });
    res.json({ status: "ok" });
  });
});

// 管理员下架（published -> draft）
app.post("/api/admin/animals/:id/unpublish", requireRole("admin"), (req, res) => {
  const id = Number(req.params.id);
  db.run("UPDATE animals SET status='draft' WHERE id=?", [id], (err) => {
    if (err) return res.status(500).json({ error: "下架失败" });
    res.json({ status: "ok" });
  });
});

// 动物列表：管理员/登记可看全部；普通用户只看 published
app.get("/api/animals", (req, res) => {
  const user = req.session.user;
  const sql =
    user && (user.role === "admin" || user.role === "registrar")
      ? "SELECT * FROM animals ORDER BY id DESC"
      : "SELECT * FROM animals WHERE status='published' ORDER BY id DESC";

  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: "读取动物列表失败" });
    res.json(rows);
  });
});

/**
 * ✅ 管理员专用：动物 + 最近健康信息
 */
app.get("/api/admin/animals/full", requireRole("admin"), (req, res) => {
  db.all(
    `
    SELECT 
      a.id,
      a.name,
      a.species,
      a.sex,
      a.age,
      a.location,
      a.description,
      a.status,
      h.vaccinated,
      h.neutered,
      h.dewormed,
      h.notes,
      h.updated_at AS health_updated_at
    FROM animals a
    LEFT JOIN (
      SELECT *
      FROM health_records
      GROUP BY animal_id
      HAVING MAX(updated_at)
    ) h ON a.id = h.animal_id
    ORDER BY a.id DESC
    `,
    [],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "读取动物健康信息失败" });
      }
      res.json(rows);
    }
  );
});

// 管理员上架（draft/pending -> published）
app.post("/api/admin/animals/:id/publish", requireRole("admin"), (req, res) => {
  const id = Number(req.params.id);
  db.run("UPDATE animals SET status='published' WHERE id=?", [id], function (err) {
    if (err) return res.status(500).json({ error: "上架失败" });
    if (this.changes === 0) return res.status(404).json({ error: "动物不存在" });
    res.json({ status: "ok" });
  });
});

/**
 * ✅ 修复后的重新上架接口：
 * 规则：只要 animals.status 不是 adopted，就允许置为 published。
 * adopted（已领养完成）严格禁止。
 */
app.post("/api/animals/:id/republish", requireRole("admin", "registrar"), (req, res) => {
  const animalId = Number(req.params.id);

  db.get("SELECT id, status FROM animals WHERE id=?", [animalId], (err, animal) => {
    if (err) return res.status(500).json({ error: "查询动物失败" });
    if (!animal) return res.status(404).json({ error: "动物不存在" });

    if (animal.status === "adopted") {
      return res.status(400).json({ error: "该动物已完成领养，无法重新上架" });
    }

    db.run("UPDATE animals SET status='published' WHERE id=?", [animalId], (err2) => {
      if (err2) return res.status(500).json({ error: "重新上架失败" });
      res.json({ status: "ok", message: "动物已重新上架" });
    });
  });
});

// ====== 领养：用户申请 / 管理员查看与审批 ======
app.post("/api/adoptions/apply", requireRole("user"), (req, res) => {
  const { animal_id, contact, reason } = req.body;
  if (!animal_id || !contact) return res.status(400).json({ error: "缺少 animal_id/contact" });

  const now = new Date().toISOString();
  db.run(
    `INSERT INTO adoption_applications (animal_id, user_id, contact, reason, status, created_at)
     VALUES (?, ?, ?, ?, 'submitted', ?)`,
    [Number(animal_id), req.session.user.id, contact, reason || "", now],
    function (err) {
      if (err) return res.status(500).json({ error: "提交申请失败" });
      res.json({ status: "ok", applicationId: this.lastID });
    }
  );
});

app.get("/api/admin/adoptions", requireRole("admin"), (req, res) => {
  db.all(
    `SELECT a.*, u.username, an.name AS animal_name
     FROM adoption_applications a
     JOIN users u ON u.id = a.user_id
     JOIN animals an ON an.id = a.animal_id
     ORDER BY a.id DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "读取失败" });
      res.json(rows);
    }
  );
});

app.post("/api/admin/adoptions/:id/approve", requireRole("admin"), (req, res) => {
  const id = Number(req.params.id);
  const now = new Date().toISOString();

  db.get("SELECT * FROM adoption_applications WHERE id=?", [id], (err, appRow) => {
    if (err) return res.status(500).json({ error: "查询申请失败" });
    if (!appRow) return res.status(404).json({ error: "申请不存在" });

    db.run(
      `UPDATE adoption_applications
       SET status='approved', reviewed_by=?, reviewed_at=?
       WHERE id=?`,
      [req.session.user.id, now, id],
      (err2) => {
        if (err2) return res.status(500).json({ error: "审核失败" });

        // 审核通过 -> 动物状态 adopted
        db.run("UPDATE animals SET status='adopted' WHERE id=?", [appRow.animal_id], (err3) => {
          if (err3) return res.status(500).json({ error: "更新动物状态失败" });
          res.json({ status: "ok" });
        });
      }
    );
  });
});

/**
 * ✅ 修复后的 reject：
 * - 先把该申请置 rejected
 * - 然后检查该动物是否还有 submitted（待审）申请
 * - 如果没有待审申请，且动物当前是 adopted（或其他非 draft），回滚为 published
 *
 * 这样就满足你说的业务规则：
 * “admin 不同意 -> 宠物还可以重新发布出去”
 */
app.post("/api/admin/adoptions/:id/reject", requireRole("admin"), (req, res) => {
  const id = Number(req.params.id);
  const now = new Date().toISOString();

  db.get("SELECT * FROM adoption_applications WHERE id=?", [id], (err, appRow) => {
    if (err) return res.status(500).json({ error: "查询申请失败" });
    if (!appRow) return res.status(404).json({ error: "申请不存在" });

    db.run(
      `UPDATE adoption_applications
       SET status='rejected', reviewed_by=?, reviewed_at=?
       WHERE id=?`,
      [req.session.user.id, now, id],
      (err2) => {
        if (err2) return res.status(500).json({ error: "驳回失败" });

        const animalId = appRow.animal_id;

        // 查该动物是否还有待审核 submitted 申请
        db.get(
          `SELECT COUNT(*) AS cnt
           FROM adoption_applications
           WHERE animal_id=? AND status='submitted'`,
          [animalId],
          (err3, row) => {
            if (err3) return res.status(500).json({ error: "查询待审数量失败" });

            // 有其他待审申请：不回滚动物状态（避免把“正在被其他人申请”的动物强行恢复可领养）
            if (row && row.cnt > 0) {
              return res.json({ status: "ok", message: "已驳回（该动物仍存在其他待审核申请）" });
            }

            // 没有待审申请：回滚动物状态为 published（但不去动 draft）
            db.get("SELECT status FROM animals WHERE id=?", [animalId], (err4, animalRow) => {
              if (err4 || !animalRow) {
                // 申请驳回已成功，动物回滚失败时也别让接口整体炸
                return res.json({ status: "ok", message: "已驳回（动物状态查询失败，未回滚）" });
              }

              if (animalRow.status === "draft") {
                // 管理员自己下架的就保持 draft
                return res.json({ status: "ok", message: "已驳回（动物为下架状态，未自动上架）" });
              }

              // 核心：把 adopted 等状态回滚为 published
              db.run("UPDATE animals SET status='published' WHERE id=?", [animalId], (err5) => {
                if (err5) {
                  return res.json({ status: "ok", message: "已驳回（动物状态回滚失败）" });
                }
                return res.json({ status: "ok", message: "已驳回，动物已恢复可领养（published）" });
              });
            });
          }
        );
      }
    );
  });
});

// 用户查看自己的领养申请
app.get("/api/adoptions/my", requireRole("user"), (req, res) => {
  db.all(
    `
    SELECT 
      a.id,
      a.status,
      a.created_at,
      an.name AS animal_name
    FROM adoption_applications a
    JOIN animals an ON an.id = a.animal_id
    WHERE a.user_id = ?
    ORDER BY a.id DESC
    `,
    [req.session.user.id],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "无法获取领养申请" });
      }
      res.json(rows);
    }
  );
});

// ====== 盈利中心：商品/支付/订单 ======
const vaccinePackages = [
  { id: 1, name: "基础免疫套餐", amount: 199 },
  { id: 2, name: "全套防疫套餐", amount: 399 },
];
const foodProducts = [
  { id: 11, name: "皇家幼猫粮 2kg", amount: 128 },
  { id: 12, name: "伯纳天纯全价犬粮 5kg", amount: 239 },
];
const insurancePlans = [
  { id: 21, name: "基础健康险", amount: 199 },
  { id: 22, name: "高级医疗险", amount: 399 },
];

app.get("/api/vaccine", (req, res) => res.json(vaccinePackages));
app.get("/api/food", (req, res) => res.json(foodProducts));
app.get("/api/insurance", (req, res) => res.json(insurancePlans));

app.post("/api/payment", requireLogin, (req, res) => {
  const { service_type, product_name, amount } = req.body;
  if (!service_type || !product_name || !amount) return res.status(400).json({ error: "缺少必要字段" });

  const now = new Date().toISOString();
  const userId = req.session.user.id;

  db.run(
    `INSERT INTO orders (user_id, service_type, product_name, amount, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, service_type, product_name, amount, now],
    function (err) {
      if (err) return res.status(500).json({ error: "创建订单失败" });
      const orderId = this.lastID;

      db.run(
        `INSERT INTO revenue_records (order_id, revenue_type, amount, created_at)
         VALUES (?, ?, ?, ?)`,
        [orderId, service_type, amount, now],
        (err2) => {
          if (err2) return res.status(500).json({ error: "记录收益失败" });
          res.json({ status: "success", order_id: orderId });
        }
      );
    }
  );
});

// 普通用户只能看自己的订单；管理员也可以看自己的（统计页走 admin 接口）
app.get("/api/orders", requireLogin, (req, res) => {
  const userId = req.session.user.id;
  db.all(
    `SELECT o.id, o.user_id, o.service_type, o.product_name, o.amount, o.created_at,
            r.amount AS revenue
     FROM orders o
     LEFT JOIN revenue_records r ON o.id = r.order_id
     WHERE o.user_id=?
     ORDER BY o.id DESC`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "无法读取订单数据" });
      res.json(rows);
    }
  );
});

// ✅ 管理员盈利统计专用：全站订单
app.get("/api/admin/orders", requireRole("admin"), (req, res) => {
  db.all(
    `SELECT o.id, o.user_id, o.service_type, o.product_name, o.amount, o.created_at,
            r.amount AS revenue
     FROM orders o
     LEFT JOIN revenue_records r ON o.id = r.order_id
     ORDER BY o.id DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "无法读取订单数据" });
      res.json(rows);
    }
  );
});

// ====== 兜底：健康信息写入接口（防止路由未注册）======
app.post("/api/animals/:id/health", (req, res) => {
  if (!req.session.user || !["registrar","admin"].includes(req.session.user.role)) {
    return res.status(403).json({ error: "无权限" });
  }

  const animal_id = Number(req.params.id);
  const { vaccinated, neutered, dewormed, notes } = req.body;
  const now = new Date().toISOString();

  db.run(
    `INSERT INTO health_records
     (animal_id, vaccinated, neutered, dewormed, notes, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      animal_id,
      vaccinated ? 1 : 0,
      neutered ? 1 : 0,
      dewormed ? 1 : 0,
      notes || "",
      req.session.user.id,
      now
    ],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "健康信息保存失败" });
      }
      res.json({ status: "ok", recordId: this.lastID });
    }
  );
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log("admin / admin123");
  console.log("registrar / reg123");
  console.log("user / user123");
});
