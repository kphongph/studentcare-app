var express = require('express');
var logview = require('leveldb-logview');
var config = require('./config');
var bodyParser = require('body-parser');

var app = express();
app.use(express.static('public'));
app.use(bodyParser.urlencoded({extended:true}));

app.use(bodyParser.json());

var stream = require('./stream');

logview.config({
  'url':'https://maas.nuqlis.com:9000/api/log/students_care',
  'jwtToken':config.token,
  'mainDb':stream.db,
  'streamHandler':stream.createStreamHandlers(config)
});

app.use(logview.handle_match);
app.use(logview.monitor);
app.get('/mirror',logview.mirror);
app.get('/view',logview.serve);
app.post('/view',logview.serve);


app.listen(3002, function () {
  console.log('Example app listening on port 3002!')
})
