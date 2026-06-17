const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const Blog = require('../models/Blog');

const generateSlug = (text) => {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);
};

// ─── PUBLIC ROUTES ──────────────────────────────────────────────────────

// GET all blogs with filters (public) - COMBINED
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 9;
    const skip = (page - 1) * limit;
    const { category, featured } = req.query;

    // Build query - removed TypeScript syntax
    const query = {};
    if (category && category !== 'All posts') {
      query.category = category;
    }
    if (featured === 'true') {
      query.isFeatured = true;
    }

    const blogs = await Blog.find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Blog.countDocuments(query);

    res.json({
      blogs,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// GET blog by slug (public)
router.get('/slug/:slug', async (req, res) => {
  try {
    const blog = await Blog.findOne({ slug: req.params.slug }).lean();

    if (!blog) {
      return res.status(404).json({ msg: 'Blog not found' });
    }

    if (!blog.images) {
      blog.images = { thumbnail: '', cover: '', gallery: [] };
    }
    if (!blog.images.gallery) {
      blog.images.gallery = [];
    }

    res.json(blog);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// GET featured blog (public)
router.get('/featured', async (req, res) => {
  try {
    const featured = await Blog.findOne({ isFeatured: true })
      .sort({ date: -1 })
      .lean();
    res.json(featured || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// GET categories with counts (public)
router.get('/categories/stats', async (req, res) => {
  try {
    const categories = ['All posts', 'Pet Law', 'Health & Vax', 'How-to Guides', 'News', 'Pet Tips', 'Enforcement'];
    const stats = await Promise.all(categories.map(async (cat) => {
      const count = cat === 'All posts' 
        ? await Blog.countDocuments()
        : await Blog.countDocuments({ category: cat });
      return { name: cat, count };
    }));
    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// GET popular blogs (public)
router.get('/popular', async (req, res) => {
  try {
    const popular = await Blog.find()
      .sort({ date: -1 })  // Changed from views: -1 since views doesn't exist
      .limit(3)
      .lean();
    res.json(popular);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// ─── ADMIN ROUTES ──────────────────────────────────────────────────────

// GET all blogs (admin)
router.get('/admin/all', auth, async (req, res) => {
  try {
    const blogs = await Blog.find().sort({ date: -1 }).lean();
    res.json(blogs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// GET blog by ID (admin)
router.get('/admin/:id', auth, async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id).lean();

    if (!blog) {
      return res.status(404).json({ msg: 'Blog not found' });
    }

    if (!blog.images) {
      blog.images = { thumbnail: '', cover: '', gallery: [] };
    }
    if (!blog.images.gallery) {
      blog.images.gallery = [];
    }

    res.json(blog);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Blog not found' });
    }
    res.status(500).json({ msg: 'Server error' });
  }
});

// CREATE blog (admin)
router.post('/', auth, async (req, res) => {
  try {
    console.log('REQ BODY BLOG CREATE:', req.body);

    let { slug, title, summary, content, images, faqs, date, seoFocusKeyword, seoTitle, seoMetaDescription, category, author, readTime, tags, isFeatured } = req.body;

    // Validate required fields
    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Title is required'
      });
    }

    if (!summary) {
      return res.status(400).json({
        success: false,
        message: 'Summary is required'
      });
    }

    const finalSlug = generateSlug(slug || title);

    const existingBlog = await Blog.findOne({ slug: finalSlug });
    if (existingBlog) {
      return res.status(400).json({
        success: false,
        message: `Slug "${finalSlug}" already exists. Please choose another or use "Generate" button.`,
        available: false
      });
    }

    const blog = new Blog({
      slug: finalSlug,
      title: title,
      summary: summary || '',
      content: content || '',
      images: images || { thumbnail: '', cover: '', gallery: [] },
      faqs: faqs || [],
      date: date || new Date(),
      category: category || 'Pet Tips',
      author: author || 'Tailio Editorial',
      readTime: readTime || 5,
      tags: tags || [],
      isFeatured: isFeatured || false,
      seoFocusKeyword: seoFocusKeyword || '',
      seoTitle: seoTitle || '',
      seoMetaDescription: seoMetaDescription || ''
    });

    await blog.save();
    res.status(201).json(blog);
  } catch (err) {
    console.error('Error creating blog:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// UPDATE blog (admin)
router.put('/:id', auth, async (req, res) => {
  try {
    let { slug, title, summary, content, images, faqs, date, seoFocusKeyword, seoTitle, seoMetaDescription, category, author, readTime, tags, isFeatured } = req.body;

    let imagesObj = {};
    if (images) {
      imagesObj = {
        thumbnail: images.thumbnail || images.cover || '',
        cover: images.cover || images.thumbnail || '',
        gallery: images.gallery || []
      };
    }

    const updateData = {
      title: title || '',
      summary: summary || '',
      content: content || '',
      images: imagesObj,
      faqs: faqs || [],
      date: date || new Date(),
      category: category || 'Pet Tips',
      author: author || 'Tailio Editorial',
      readTime: readTime || 5,
      tags: tags || [],
      isFeatured: isFeatured || false,
      seoFocusKeyword: seoFocusKeyword || '',
      seoTitle: seoTitle || '',
      seoMetaDescription: seoMetaDescription || ''
    };

    if (slug) {
      const finalSlug = generateSlug(slug || title);
      const existingBlog = await Blog.findOne({
        slug: finalSlug,
        _id: { $ne: req.params.id }
      });

      if (existingBlog) {
        return res.status(400).json({
          success: false,
          message: `Slug "${finalSlug}" already exists. Please choose another.`,
          available: false
        });
      }

      updateData.slug = finalSlug;
    }

    const blog = await Blog.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!blog) {
      return res.status(404).json({ msg: 'Blog not found' });
    }

    res.json(blog);
  } catch (err) {
    console.error('Error updating blog:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// DELETE blog (admin)
router.delete('/:id', auth, async (req, res) => {
  try {
    const blog = await Blog.findByIdAndDelete(req.params.id);
    if (!blog) {
      return res.status(404).json({ msg: 'Blog not found' });
    }
    res.json({ msg: 'Blog deleted successfully' });
  } catch (err) {
    console.error('Error deleting blog:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// GET blog categories list (public)
router.get('/categories', async (req, res) => {
  try {
    const categories = ['Pet Law', 'Health & Vax', 'How-to Guides', 'News', 'Pet Tips', 'Enforcement'];
    res.json(categories);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;