const {object} = require('webidl-conversions')
const User = require('../models/user')
const jwt = require('jsonwebtoken')

//error handler
const errorHandler = (err) => {
  console.log(err.message, err.code)
  let errors = {email: '', password: ''}

 //incorrect email
 if(err.message === 'Incorrect Email'){
  errors.email = 'Email is not registered'
 }

  //incorrect password
  if(err.message === 'Incorrect Password'){
    errors.password = 'Password is incorrect'
  }

  //validate errrors
  if(err.code === 11000){
    errors.email= 'This email is already in use'
    return errors
  }

  if(err.message.includes('user validation failed')){
    Object.values(err.errors).forEach(({properties})=>{
      errors[properties.path] = properties.message
    })
  }
  return errors
}

//implementing jwt
const createToken = (id) => {
  return jwt.sign({id}, 'oyishomasecret', {expiresIn: 3*24*60*60})
}

//route authentication controller actions
module.exports.signup_get = (req, res) => {
  res.render('signup')
}

module.exports.login_get = (req, res) => {
  res.render('login')
}

module.exports.signup_post = async (req, res) => {
  const {firstname, lastname, email, password} = req.body

  try{
    const user = await User.create({firstname, lastname, email, password})
    const token = createToken(user._id)
    res.cookie('jwt', token, {httpOnly: true, maxAge: 1*24*60*60*1000}) // 1 day in milliseconds
    res.status(201).json({user: user.id})
  }catch(err){
    const errors = errorHandler(err)
    res.status(400).json({errors})
  }
}

module.exports.login_post = async (req, res) => {
  const {email, password} = req.body

  try{
    const user = await User.login(email, password)
    const token = createToken(user.id)
    res.cookie('jwt', token, {httpOnly: true, maxAge: 3*24*60*60*1000}) // 3 days in milliseconds
    res.status(200).json({user: user.id})
  }
  catch(err){
    const errors = errorHandler(err)
    res.status(400).json({errors})
  }
} 

module.exports.logout_get = (req, res) => {
   res.cookie('jwt', '', {maxAge: 1})
   res.redirect('/landing')
}