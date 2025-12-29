// db.js
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database(path.join(__dirname, "app.db"));

function init() {
  db.serialize(() => {
    // 用户表：三种角色
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin','registrar','user')),
        created_at TEXT NOT NULL
      )
    `);

    // 动物登记表
    db.run(`
      CREATE TABLE IF NOT EXISTS animals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        species TEXT NOT NULL,  -- cat/dog/other
        sex TEXT,
        age TEXT,
        status TEXT NOT NULL CHECK(status IN ('draft','pending','published','adopted')) DEFAULT 'draft',
        description TEXT,
        location TEXT,
        created_by INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(created_by) REFERENCES users(id)
      )
    `);

    // 动物健康记录（登记人员维护）
    db.run(`
      CREATE TABLE IF NOT EXISTS health_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        animal_id INTEGER NOT NULL,
        vaccinated INTEGER NOT NULL DEFAULT 0,
        neutered INTEGER NOT NULL DEFAULT 0,
        dewormed INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        updated_by INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(animal_id) REFERENCES animals(id),
        FOREIGN KEY(updated_by) REFERENCES users(id)
      )
    `);

    // 领养申请
    db.run(`
      CREATE TABLE IF NOT EXISTS adoption_applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        animal_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        contact TEXT NOT NULL,
        reason TEXT,
        status TEXT NOT NULL CHECK(status IN ('submitted','approved','rejected')) DEFAULT 'submitted',
        reviewed_by INTEGER,
        created_at TEXT NOT NULL,
        reviewed_at TEXT,
        FOREIGN KEY(animal_id) REFERENCES animals(id),
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(reviewed_by) REFERENCES users(id)
      )
    `);

    // ====== 你原来的盈利模块：订单与收益 ======
    db.run(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        service_type TEXT NOT NULL,     -- vaccine/food/insurance/donation
        product_name TEXT NOT NULL,
        amount REAL NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS revenue_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        revenue_type TEXT NOT NULL,
        amount REAL NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(order_id) REFERENCES orders(id)
      )
    `);
  });
}

module.exports = { db, init };
