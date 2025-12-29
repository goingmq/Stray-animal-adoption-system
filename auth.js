// auth.js
const bcrypt = require("bcryptjs");

function requireLogin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "未登录" });
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ error: "未登录" });
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({ error: "无权限" });
    }
    next();
  };
}

async function hashPassword(pw) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(pw, salt);
}

async function verifyPassword(pw, hash) {
  return bcrypt.compare(pw, hash);
}

module.exports = { requireLogin, requireRole, hashPassword, verifyPassword };
