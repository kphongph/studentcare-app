var through2 = require('through2');
var sublevel = require('level-sublevel');
var levelup = require('levelup');
var bytewise = require('bytewise');
var request = require('request');
var _ = require('lodash');

var viewdb = sublevel(levelup('./myView',{'valueEncoding':'json'}));

module.exports.db = viewdb;

module.exports.createStreamHandlers = function(config) {
  return function() {
    var first = function() {
      var stream = through2.obj(function(chunk,enc,cb) {
        if(chunk.value.doc_type == "assignment") {
          this.push(chunk);
        }
        cb();
      });
      return stream;
    };

    var reverse = function() {
      return through2.obj(function(chunk,enc,cb) {
        var self = this;
        if(chunk._value) {
          var tmp = chunk._value;
          // by_host
          self.push({
            '_view':'by_host',
            'key':[tmp.dmc.host,tmp.form_type],
            'update_fn':[{
              'attr':tmp.status,
              'value':0,
              'fn':function(old) {
                 return old - 1;
               }
             }]
          });
          // by_room
          var fn = new Function('old','return "'+tmp.status+'";');
          self.push({
            '_view':'by_room',
            'key':[tmp.dmc.year,tmp.dmc.host,tmp.dmc.level,tmp.dmc.room],
            'update_fn':[{
              'attr':tmp.student.cid+'!'+tmp.student.name+'!'+tmp.form_type,
              'value':tmp.status,
              'fn':fn
             }]
          });
        }
        self.push(chunk);
        cb();
      })
    };

    var forward = function() {
      return through2.obj(function(chunk,enc,cb) {
        var self = this;
        if(chunk.value) {
          var tmp = chunk.value;
          if(tmp.status) {
            self.push({
              '_view':'by_host',
              'key':[tmp.dmc.host,tmp.form_type],
              'update_fn':[{
                'attr':tmp.status,
                'fn':function(value) {
                   return  value + 1;
                 },
                 'value':1
               }]
            });
          }
          // by_room
          var fn = new Function('old','return "'+tmp.status+'";');
          self.push({
            '_view':'by_room',
            'key':[tmp.dmc.year,tmp.dmc.host,tmp.dmc.level,tmp.dmc.room],
            'update_fn':[{
              'attr':tmp.student.cid+'!'+tmp.student.name+'!'+tmp.form_type,
              'value':tmp.status,
              'fn':fn
             }]
          });
        }
        self.push(chunk);
        cb();
      })
    }

    var endStream = function() {
      return through2.obj(function(chunk,enc,cb) {
        if(chunk._view) {
          var obj = {
            'key':bytewise.encode([chunk._view].concat(chunk.key),'hex'),
          };
          viewdb.get(obj.key,function(err,_obj) {
            if(err) {
              var value = {};
              chunk.update_fn.forEach(function(update) {
                value[update.attr] = update.value;
              });
              viewdb.put(obj.key,value,function(err) {
                cb();
              });
            } else {
              chunk.update_fn.forEach(function(update) {
                if(!_obj.hasOwnProperty(update.attr)) {
                  _obj[update.attr] = update.value;
                } else {
                  _obj[update.attr] = update.fn(_obj[update.attr]);
                }
              });

              viewdb.put(obj.key,_obj,function(err) {
                cb();
              });
            }
          });
        } else {
          this.push(chunk); 
          cb();
        }
      })
    }

    return [first,reverse,forward,endStream];
  }
};
