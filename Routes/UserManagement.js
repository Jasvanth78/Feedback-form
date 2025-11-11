const express = require('express')
const { PrismaClient } = require('../generated/prisma')
const { authenticate, authorizeRole } = require('../middleware/auth')

const router = express.Router()
const prisma = new PrismaClient()

// GET /api/users - Get all users (ADMIN only)
router.get('/', authenticate, authorizeRole('ADMIN'), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { feedbackResponses: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    return res.json(users)
  } catch (err) {
    console.error('list users error', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// PATCH /api/users/:id/role - Update user role (ADMIN only)
router.patch('/:id/role', authenticate, authorizeRole('ADMIN'), async (req, res) => {
  const { id } = req.params
  const { role } = req.body

  if (!role || !['ADMIN', 'USER'].includes(role)) {
    return res.status(400).json({ error: 'Valid role (ADMIN or USER) is required' })
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    })
    return res.json({ message: 'User role updated successfully', user })
  } catch (err) {
    console.error('update user role error', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/users/:id - Delete user (ADMIN only)
router.delete('/:id', authenticate, authorizeRole('ADMIN'), async (req, res) => {
  const { id } = req.params
  const currentUserId = req.user?.id

  // Prevent admin from deleting themselves
  if (id === currentUserId) {
    return res.status(400).json({ error: 'You cannot delete your own account' })
  }

  try {
    await prisma.user.delete({ where: { id } })
    return res.json({ message: 'User deleted successfully' })
  } catch (err) {
    console.error('delete user error', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router
