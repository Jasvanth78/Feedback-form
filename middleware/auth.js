const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || process.env.jsonwebtoken || 'change_this_secret'

function authenticate(req, res, next) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })
  const token = auth.split(' ')[1]
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.user = payload
    return next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

function authorizeRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' })
    if (req.user.role !== role) return res.status(403).json({ error: 'Forbidden' })
    return next()
  }
}

module.exports = { authenticate, authorizeRole }
