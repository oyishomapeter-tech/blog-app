const jwt = require('jsonwebtoken')
const User = require('../models/user')

const requireAuth = (req, res, next)=>{
  const token = req.cookies.jwt
  if(token){
    jwt.verify(token, 'oyishomasecret', (err, decodedToken)=>{
      if(err){
        console.log(err.message)
        res.redirect('/landing')
      }else{
        console.log(decodedToken)
        next()
      }
    })
  }else{
    res.redirect('/landing')
  }
}

//check current user
const checkUser = (req, res, next)=>{
  const token = req.cookies.jwt
  if(token){
    jwt.verify(token, 'oyishomasecret', async(err, decodedToken)=>{
      if(err){
        console.log(err.message)
        res.locals.user = null
        next()
      }else{
        console.log(decodedToken)
        let user = await User.findById(decodedToken.id)
        res.locals.user = user
        next()
      }
    })
  }else{
    res.locals.user = null 
    next()
  }
}

module.exports = {requireAuth, checkUser}