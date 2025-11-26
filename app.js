const express = require('express')
require('dotenv').config()
const mongoose = require('mongoose')
const Blog = require('./models/blog')
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
    const blog = await Blog.findById(id).populate('author');
    if (!blog) {
      return res.render('details', { blog: null, title: 'Blog Details', similarBlogs: [] });
    }
    const similarBlogs = await Blog.findSimilar(blog.tags, blog._id);
    res.render('details', { blog, title: 'Blog Details', similarBlogs });
  } catch (err) {
    res.render('details', { blog: null, title: 'Blog Details', similarBlogs: [] });
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
    const userBlogs = await Blog.find({ author: userId }).sort({ createdAt: -1 }).populate('author');
    res.render('profile', { title: 'My Profile', blogs: userBlogs });
  } catch (err) {
    console.error(err);
    res.status(500).render('profile', { title: 'My Profile', blogs: [] });
  }
});

app.use(authRoutes)

app.use((req, res) => {
  res.status(404).render('404');
});

