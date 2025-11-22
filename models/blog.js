const mongoose = require('mongoose')
const Schema = mongoose.Schema

// blog model configuration
const blogSchema = new Schema({
  title: {
    type: String,
    required: true
  }, 
  snippet: {
    type: String,
    required: true
  },
  body: {
    type: String,
    required: true
  },
  tags: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  author: { 
    type: Schema.Types.ObjectId, 
    ref: 'user', required: true 
  },
  createdAt: { type: Date, default: Date.now }
}, {timestamps: true})


//static method to find similar posts
blogSchema.statics.findSimilar = function(tags, excludeId){
  return this.find({
    tags: {$in: tags},
    _id: {$ne: excludeId}
  }).limit(5)
}

const Blog = mongoose.model('Blog', blogSchema)

module.exports = Blog