const express = require('express');
const router = express.Router();
const Faq = require('../models/FAQ');
const { auth, requireRole } = require('../middleware/auth');

// ============================================
// HELPER FUNCTIONS
// ============================================

const getPageIds = () => {
  return [
    'home', 
    'about', 
    'services', 
    'products', 
    'contact', 
    'support', 
    'pricing', 
    'blog', 
    'careers',
    'how-it-works',
    'why-tailio',
    'delhi',
    'noida',
    'faridabad',
    'gurugram',
    'ghaziabad'
  ];
};

const isValidPageId = (pageId) => {
  return getPageIds().includes(pageId);
};

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================

// ✅ Get FAQs by page
router.get('/page/:pageId', async (req, res) => {
  try {
    const { pageId } = req.params;
    const { limit = 20, category } = req.query;

    console.log(`📄 Fetching FAQs for page: ${pageId}`);

    if (!isValidPageId(pageId)) {
      return res.status(400).json({
        success: false,
        message: `Invalid pageId. Must be one of: ${getPageIds().join(', ')}`
      });
    }

    let filter = { pageId, isActive: true };
    if (category) filter.category = category;

    const faqs = await Faq.find(filter)
      .sort({ order: 1, createdAt: -1 })
      .limit(parseInt(limit))
      .select('question answer category order');

    // Increment view count (async)
    Faq.updateMany(
      { pageId, isActive: true },
      { $inc: { views: 1 } }
    ).exec();

    console.log(`✅ Found ${faqs.length} FAQs for page: ${pageId}`);

    res.status(200).json({
      success: true,
      count: faqs.length,
      data: faqs,
      page: pageId
    });
  } catch (error) {
    console.error('❌ Get FAQs by page error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch FAQs'
    });
  }
});

// ✅ Get FAQs by category
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { pageId, limit = 20 } = req.query;

    console.log(`📂 Fetching FAQs for category: ${category}`);

    let filter = { category, isActive: true };
    if (pageId) {
      if (!isValidPageId(pageId)) {
        return res.status(400).json({
          success: false,
          message: `Invalid pageId. Must be one of: ${getPageIds().join(', ')}`
        });
      }
      filter.pageId = pageId;
    }

    const faqs = await Faq.find(filter)
      .sort({ order: 1, createdAt: -1 })
      .limit(parseInt(limit))
      .select('question answer pageId');

    console.log(`✅ Found ${faqs.length} FAQs for category: ${category}`);

    res.status(200).json({
      success: true,
      count: faqs.length,
      data: faqs,
      category
    });
  } catch (error) {
    console.error('❌ Get FAQs by category error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch FAQs'
    });
  }
});

// ✅ Get all categories
router.get('/categories', async (req, res) => {
  try {
    console.log('📂 Fetching all categories');

    const categories = await Faq.distinct('category');
    
    const filteredCategories = categories
      .filter(cat => cat && cat.trim() !== '')
      .sort();

    console.log(`✅ Found ${filteredCategories.length} categories`);

    res.status(200).json({
      success: true,
      data: filteredCategories
    });
  } catch (error) {
    console.error('❌ Get categories error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch categories'
    });
  }
});

// ✅ Get page options
router.get('/page-options', async (req, res) => {
  try {
    const pageIds = getPageIds();
    const pageOptions = pageIds.map(id => ({
      value: id,
      label: id.charAt(0).toUpperCase() + id.slice(1)
    }));

    res.status(200).json({
      success: true,
      data: pageOptions
    });
  } catch (error) {
    console.error('❌ Get page options error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch page options'
    });
  }
});

// ============================================
// ADMIN ROUTES (Authentication required)
// ============================================

// ✅ Create FAQ
router.post('/', auth, requireRole('admin'), async (req, res) => {
  try {
    const { question, answer, pageId, category, order, isActive } = req.body;

    console.log('📝 Creating FAQ:', { question, pageId });

    if (!question || !answer) {
      return res.status(400).json({
        success: false,
        message: 'Question and answer are required'
      });
    }

    if (pageId && !isValidPageId(pageId)) {
      return res.status(400).json({
        success: false,
        message: `Invalid pageId. Must be one of: ${getPageIds().join(', ')}`
      });
    }

    const faq = await Faq.create({
      question,
      answer,
      pageId: pageId || 'home',
      category: category || 'General',
      order: order || 0,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user._id
    });

    console.log('✅ FAQ created:', faq._id);

    res.status(201).json({
      success: true,
      data: faq,
      message: 'FAQ created successfully'
    });
  } catch (error) {
    console.error('❌ Create FAQ error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create FAQ'
    });
  }
});

// ✅ Get all FAQs (with filters)
router.get('/', auth, requireRole('admin'), async (req, res) => {
  try {
    const { 
      pageId, 
      category, 
      isActive, 
      search,
      page = 1, 
      limit = 10,
      sortBy = 'order',
      sortOrder = 'asc'
    } = req.query;

    console.log('🔍 Fetching FAQs with filters:', { pageId, category, search });

    let filter = {};
    if (pageId) {
      if (!isValidPageId(pageId)) {
        return res.status(400).json({
          success: false,
          message: `Invalid pageId. Must be one of: ${getPageIds().join(', ')}`
        });
      }
      filter.pageId = pageId;
    }
    if (category) filter.category = category;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    
    if (search) {
      filter.$or = [
        { question: { $regex: search, $options: 'i' } },
        { answer: { $regex: search, $options: 'i' } }
      ];
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const [faqs, total] = await Promise.all([
      Faq.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email'),
      Faq.countDocuments(filter)
    ]);

    console.log(`✅ Found ${faqs.length} FAQs (total: ${total})`);

    res.status(200).json({
      success: true,
      data: faqs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('❌ Get FAQs error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch FAQs'
    });
  }
});

// ✅ Get FAQ statistics
router.get('/stats', auth, requireRole('admin'), async (req, res) => {
  try {
    console.log('📊 Fetching FAQ statistics');

    const totalFAQs = await Faq.countDocuments();
    const activeFAQs = await Faq.countDocuments({ isActive: true });
    const totalViews = await Faq.aggregate([
      { $group: { _id: null, total: { $sum: '$views' } } }
    ]);
    
    const pageWiseCount = await Faq.aggregate([
      { $group: { _id: '$pageId', count: { $sum: 1 } } }
    ]);

    const categoryWiseCount = await Faq.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    const stats = {
      totalFAQs,
      activeFAQs,
      inactiveFAQs: totalFAQs - activeFAQs,
      totalViews: totalViews[0]?.total || 0,
      pageWiseCount,
      categoryWiseCount
    };

    console.log('✅ Stats fetched');

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ Get stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch statistics'
    });
  }
});

// ✅ Bulk delete FAQs
router.post('/bulk-delete', auth, requireRole('admin'), async (req, res) => {
  try {
    const { ids } = req.body;

    console.log(`🗑️ Bulk deleting FAQs: ${ids?.length || 0} items`);

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of FAQ IDs'
      });
    }

    const result = await Faq.deleteMany({ _id: { $in: ids } });

    console.log(`✅ Deleted ${result.deletedCount} FAQs`);

    res.status(200).json({
      success: true,
      message: `${result.deletedCount} FAQs deleted successfully`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('❌ Bulk delete error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete FAQs'
    });
  }
});

// ✅ Reorder FAQs
router.put('/reorder', auth, requireRole('admin'), async (req, res) => {
  try {
    const { pageId, orderedIds } = req.body;

    console.log(`🔄 Reordering FAQs for page: ${pageId}`);

    if (!pageId || !isValidPageId(pageId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid pageId is required'
      });
    }

    if (!orderedIds || !Array.isArray(orderedIds) || orderedIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'orderedIds array is required'
      });
    }

    const updatePromises = orderedIds.map((id, index) => 
      Faq.findByIdAndUpdate(id, { order: index }, { new: true })
    );

    const updatedFAQs = await Promise.all(updatePromises);

    console.log(`✅ Reordered ${updatedFAQs.length} FAQs`);

    res.status(200).json({
      success: true,
      message: 'FAQs reordered successfully',
      data: updatedFAQs
    });
  } catch (error) {
    console.error('❌ Reorder error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to reorder FAQs'
    });
  }
});

// ✅ Get FAQ by ID
router.get('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🔍 Fetching FAQ: ${id}`);

    const faq = await Faq.findById(id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!faq) {
      return res.status(404).json({
        success: false,
        message: 'FAQ not found'
      });
    }

    res.status(200).json({
      success: true,
      data: faq
    });
  } catch (error) {
    console.error('❌ Get FAQ error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch FAQ'
    });
  }
});

// ✅ Update FAQ
router.put('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { question, answer, pageId, category, order, isActive } = req.body;

    console.log(`📝 Updating FAQ: ${id}`);

    if (pageId && !isValidPageId(pageId)) {
      return res.status(400).json({
        success: false,
        message: `Invalid pageId. Must be one of: ${getPageIds().join(', ')}`
      });
    }

    const faq = await Faq.findById(id);
    if (!faq) {
      return res.status(404).json({
        success: false,
        message: 'FAQ not found'
      });
    }

    if (question) faq.question = question;
    if (answer) faq.answer = answer;
    if (pageId) faq.pageId = pageId;
    if (category) faq.category = category;
    if (order !== undefined) faq.order = order;
    if (isActive !== undefined) faq.isActive = isActive;
    faq.updatedBy = req.user._id;

    await faq.save();

    console.log('✅ FAQ updated:', faq._id);

    res.status(200).json({
      success: true,
      data: faq,
      message: 'FAQ updated successfully'
    });
  } catch (error) {
    console.error('❌ Update FAQ error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update FAQ'
    });
  }
});

// ✅ Delete FAQ
router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🗑️ Deleting FAQ: ${id}`);

    const faq = await Faq.findByIdAndDelete(id);

    if (!faq) {
      return res.status(404).json({
        success: false,
        message: 'FAQ not found'
      });
    }

    console.log('✅ FAQ deleted:', id);

    res.status(200).json({
      success: true,
      message: 'FAQ deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete FAQ error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete FAQ'
    });
  }
});

// ✅ Toggle FAQ status
router.patch('/:id/toggle', auth, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🔄 Toggling FAQ status: ${id}`);

    const faq = await Faq.findById(id);
    if (!faq) {
      return res.status(404).json({
        success: false,
        message: 'FAQ not found'
      });
    }

    faq.isActive = !faq.isActive;
    faq.updatedBy = req.user._id;
    await faq.save();

    console.log(`✅ FAQ status toggled to: ${faq.isActive}`);

    res.status(200).json({
      success: true,
      data: faq,
      message: `FAQ ${faq.isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('❌ Toggle status error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to toggle FAQ status'
    });
  }
});

module.exports = router;