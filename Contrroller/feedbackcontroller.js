const express = require('express')
const { PrismaClient } = require('../generated/prisma')
const { authenticate, authorizeRole } = require('../middleware/auth')

const router = express.Router()
const prisma = new PrismaClient()

// ==================== ADMIN ROUTES ====================

// POST /api/feedback/templates - Create feedback template (ADMIN only)
router.post('/templates', authenticate, authorizeRole('ADMIN'), async (req, res) => {
  const { title, question } = req.body

  if (!title || !question) {
    return res.status(400).json({ error: 'Title and question are required' })
  }

  try {
    const template = await prisma.feedbackTemplate.create({
      data: { title, question, isActive: true }
    })
    return res.status(201).json({ message: 'Feedback template created', template })
  } catch (err) {
    console.error('create template error', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/feedback/templates - List all templates (ADMIN only)
router.get('/templates', authenticate, authorizeRole('ADMIN'), async (req, res) => {
  try {
    const templates = await prisma.feedbackTemplate.findMany({
      include: {
        _count: {
          select: { responses: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    return res.json(templates)
  } catch (err) {
    console.error('list templates error', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/feedback/templates/:id - Delete template (ADMIN only)
router.delete('/templates/:id', authenticate, authorizeRole('ADMIN'), async (req, res) => {
  const { id } = req.params
  try {
    await prisma.feedbackTemplate.delete({ where: { id } })
    return res.json({ message: 'Template deleted' })
  } catch (err) {
    console.error('delete template error', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/feedback/responses - View all user responses (ADMIN only)
router.get('/responses', authenticate, authorizeRole('ADMIN'), async (req, res) => {
  try {
    const responses = await prisma.feedbackResponse.findMany({
      include: {
        user: {
          select: { id: true, name: true, email: true }
        },
        template: {
          select: { id: true, title: true, question: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    return res.json(responses)
  } catch (err) {
    console.error('list responses error', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// ==================== USER ROUTES ====================

// GET /api/feedback/active - Get active feedback templates (all authenticated users)
router.get('/active', authenticate, async (req, res) => {
  try {
    const templates = await prisma.feedbackTemplate.findMany({
      where: { isActive: true },
      select: {
        id: true,
        title: true,
        question: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    })
    return res.json(templates)
  } catch (err) {
    console.error('get active templates error', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/feedback/submit - Submit response to a template (authenticated users)
router.post('/submit', authenticate, async (req, res) => {
  const { templateId, answer, rating } = req.body
  const userId = req.user?.id

  if (!templateId || !answer || !userId) {
    return res.status(400).json({ error: 'Template ID, answer, and authentication required' })
  }

  try {
    // Verify template exists and is active
    const template = await prisma.feedbackTemplate.findUnique({
      where: { id: templateId }
    })

    if (!template) {
      return res.status(404).json({ error: 'Feedback template not found' })
    }

    if (!template.isActive) {
      return res.status(400).json({ error: 'This feedback is no longer accepting responses' })
    }

    // Create the response
    const response = await prisma.feedbackResponse.create({
      data: {
        templateId,
        userId,
        answer,
        rating: rating ? parseInt(rating, 10) : 5
      },
      include: {
        template: {
          select: { title: true, question: true }
        }
      }
    })

    return res.status(201).json({ message: 'Feedback submitted successfully', response })
  } catch (err) {
    console.error('submit feedback error', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/feedback/my-responses - Get current user's responses
router.get('/my-responses', authenticate, async (req, res) => {
  const userId = req.user?.id

  try {
    const responses = await prisma.feedbackResponse.findMany({
      where: { userId },
      include: {
        template: {
          select: { id: true, title: true, question: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    return res.json(responses)
  } catch (err) {
    console.error('get my responses error', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router
