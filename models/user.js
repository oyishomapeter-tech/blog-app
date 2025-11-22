const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const Schema = mongoose.Schema

const {isEmail} = require('validator')
const { genSalt } = require('bcrypt')


// User model and pasword configuration
const userSchema = new Schema({
  firstname: {
    type: String,
    required: [true, 'Please enter your first name'],
    lowercase: true
  },
  lastname: {
    type: String,
    required: [true, 'Please enter your last name'],
    lowercase: true
  },
  email: {
    type: String,
    required: [true, 'Please enter email'], 
    unique: true,
    lowercase: true,
    validate: [isEmail, 'Please enter a valid email']
  }, 

  password: {
    type: String,
    required: [true, 'Please enter a password'], 
    minLength: [8, 'Password must be less than 8 characters']
  }
})

//password hashing
userSchema.pre('save', async function(next){
  const salt = await bcrypt.genSalt(10)
  this.password = await bcrypt.hash(this.password, salt)
  next()
})

//static method loginuser
userSchema.statics.login = async function (email, password){
  const user = await this.findOne({ email });
  if(user){
    const auth = await bcrypt.compare(password, user.password)
    if(auth){
      return user
    }throw Error('Incorrect Password')
  }else{ 
    throw Error('Incorrect Email')
  }
}

const User = mongoose.model('user', userSchema)
module.exports = User

