const express = require('express')
require('dotenv').config()
const mongoose = require('mongoose')
const Blog = require('./models/blog')
const User = require('./models/user')
const authRoutes = require('./routes/authroutes')
const cookie = require('cookie-parser')
const {requireAuth, checkUser} = require('./middlewares/authmiddleware')


const app = express();

app.set('view engine', 'ejs');

app.use(express.static('public'));
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookie())

// //connecting to mongodb

const dbURI = process.env.DB_URI;

mongoose.connect(dbURI)
  .then((result)=> app.listen(3000))
  .catch((err)=>{console.log(err)})


// routes
app.use(checkUser)

app.get('/', (req, res) => {
  res.redirect('/landing')
});

app.get('/index', requireAuth, (req, res) => {
  res.redirect('/blogs');
}); 

app.get('/landing', (req, res) => {
  res.render('landing', {title : "Welcome"});
}); 

app.get('/about', requireAuth, (req, res) => {
  res.render('about', {title : "About"});
});

app.get('/contact', requireAuth,(req, res) => {
  res.render('contact', {title : "Contact"});
});


app.get('/blogs', requireAuth, async (req, res)=> {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = 4; // items per page
    const skip = (page - 1) * limit;
    const q = (req.query.q || '').trim();

    // build search filter
    const filter = {};
    if (q) {
      // escape special regex characters
      const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapeRegex(q), 'i');
      filter.$or = [
        { title: regex },
        { snippet: regex },
        { body: regex },
        { tags: q.toLowerCase() }
      ];
    }

    const [totalCount, blogs, trendingBlogs] = await Promise.all([
      Blog.countDocuments(filter),
      Blog.find(filter).sort({createdAt: -1}).skip(skip).limit(limit).populate('author'),
      Blog.find().sort({createdAt: -1}).limit(5).populate('author')
    ]);

    const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  res.render('index', { title: 'All Blogs', blogs, currentPage: page, totalPages, trendingBlogs, q });
  } catch (err) {
    console.error(err);
    res.status(500).render('index', { title: 'All Blogs', blogs: [], currentPage: 1, totalPages: 1, q: '' });
  }
})

app.post('/blogs', requireAuth, async (req,res)=>{
  const blog = new Blog({
    ...req.body,
    tags: req.body.tags ? req.body.tags.split(',').map(tag => tag.trim().toLowerCase()) : [],
    author: res.locals.user._id
  })
  await blog.save()
    .then((result)=>{
      res.redirect('/blogs')
    })
    .catch((err)=>console.log(err))
    res.status(400).send('Error creating blog')
})


app.get('/blogs/:id', requireAuth, async (req, res) => {
  const id = req.params.id;
  try {
    const blog = await Blog.findById(id).populate('author').populate('comments.author');
    if (!blog) {
      return res.render('details', { blog: null, title: 'Blog Details', similarBlogs: [], articleUrl: '' });
    }
    const similarBlogs = await Blog.findSimilar(blog.tags, blog._id);
    const articleUrl = `${req.protocol}://${req.get('host')}/blogs/${id}`;
    res.render('details', { blog, title: 'Blog Details', similarBlogs, articleUrl });
  } catch (err) {
    console.error(err);
    res.render('details', { blog: null, title: 'Blog Details', similarBlogs: [], articleUrl: '' });
  }
});

// Like (toggle)
app.post('/blogs/:id/like', requireAuth, async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ error: 'Blog not found' });
    const userId = res.locals.user._id;
    const idx = blog.likes.findIndex(l => l.equals(userId));
    let liked = false;
    if (idx === -1) {
      blog.likes.push(userId);
      liked = true;
    } else {
      blog.likes.splice(idx, 1);
      liked = false;
    }
    await blog.save();
    res.json({ liked, likesCount: blog.likes.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// Add a comment
app.post('/blogs/:id/comments', requireAuth, async (req, res) => {
  try {
    const { body } = req.body;
    if (!body || !body.trim()) return res.status(400).json({ error: 'Comment body required' });
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ error: 'Blog not found' });
    const comment = { author: res.locals.user._id, body: body.trim() };
    blog.comments.unshift(comment);
    await blog.save();
    // populate the newly added comment's author for response
    const populatedBlog = await Blog.findById(blog._id).populate('comments.author');
    const newComment = populatedBlog.comments[0];
    res.json({ comment: newComment, commentsCount: populatedBlog.comments.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Increment share count
app.post('/blogs/:id/share', async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ error: 'Blog not found' });
    blog.shares = (blog.shares || 0) + 1;
    await blog.save();
    res.json({ shares: blog.shares });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to increment share count' });
  }
});


//similar posts route
app.get('/blogs/:id/similar', requireAuth, async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ error: 'Blog not found' });

    const similarBlogs = await Blog.findSimilar(blog.tags, blog._id);
    res.render('similar', { title: 'Similar Posts', blogs: similarBlogs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/blogs/:id', (req, res)=>{
  const id = req.params.id

  Blog.findByIdAndDelete(id)
    .then(result => {
      res.json({redirect: '/blogs'})
    })
    .catch(err => console.log(err))
})

app.get('/new-post', requireAuth, (req, res) => {
  res.render('new-post', {title : "New Post"});
});

app.get('/profile', requireAuth, async (req, res) => {
  try {
    const userId = res.locals.user._id;
    console.log('Profile route: userId =', userId);
    
    // Fetch user data dynamically from database
    const user = await User.findById(userId);
    console.log('Fetched user from DB:', user);
    
    if (!user) {
      return res.status(404).render('404', { title: '404 - User Not Found' });
    }
    
    // Fetch user's blogs
    const userBlogs = await Blog.find({ author: userId }).sort({ createdAt: -1 }).populate('author');
    
    console.log('Rendering profile with user:', user.firstname, user.lastname);
    res.render('profile', {
      title: 'My Profile',
      user: user,
      blogs: userBlogs
    });
  } catch (err) {
    console.error('Profile route error:', err);
    res.status(500).render('profile', {
      title: 'My Profile',
      user: res.locals.user || null,
      blogs: []
    });
  }
});

app.use(authRoutes)

app.use((req, res) => {
  res.status(404).render('404');
});

