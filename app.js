var express = require('express');
var logview = require('leveldb-logview');
var config = require('./config');
var bodyParser = require('body-parser');
var request = require('request');

var app = express();

app.use(express.static('public'));
app.use(bodyParser.urlencoded({extended:true}));
app.use(bodyParser.json());
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

var stream = require('./stream');
logview.config({
  'url':'https://maas.nuqlis.com:9000/api/log/students_care',
  'jwtToken':config.token,
  'mainDb':stream.db,
  'streamHandler':stream.createStreamHandlers(config)
});

app.use(logview.handle_match);
app.use(logview.monitor);
app.post('/login',function(req,res) {
  //console.log(req.body.user,req.body.pass);
  request({
   'method':'POST',
   'url':'https://maas.nuqlis.com:9000/login',
   'headers':{
    'user':req.body.user,
    'pass':req.body.pass
   }
  },function(err,response,body) {
    if(response.headers && response.headers.authorization) {
      res.json({success:true,'token':response.headers.authorization});
    } else {
      res.json({success:false});
    }
  });
});
app.get('/view',logview.serve);
app.post('/view',logview.serve);

app.listen(config.port, function () {
  console.log('Example app listening on port !',config.port)
})
