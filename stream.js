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
      //  console.log(chunk);
      // console.log(chunk._value==null,chunk.value==null); 
        this.push(chunk);
        cb();
      });
      return stream;
    };
    
    var reverse = function() {
      return through2.obj(function(chunk,enc,cb) {
        var self = this;
        if(chunk._value) {
          var tmp = chunk._value;
          var value_changes = {};
          value_changes[tmp.status] = -1;
          self.push({
            '_view':'by_host',
            'change':{
              'key':[tmp.dmc.host],
              'value':value_changes
            }
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
          var value_changes = {};
          if(tmp.status) {
            value_changes[tmp.status] = 1;
            self.push({
              '_view':'by_host',
              'change':{
                'key':[tmp.dmc.host],
                'value':value_changes
              }
            });
          }
        }
        self.push(chunk);
        cb();
      })
    }

    var endStream = function() {
      return through2.obj(function(chunk,enc,cb) {
        if(chunk._view) {
          var obj = {
            'key':bytewise.encode([chunk._view].concat(chunk.change.key),'hex'),
            'value':chunk.change.value
          };
          viewdb.get(obj.key,function(err,_obj) {
            if(err) {
              console.log('new',obj.value);
              viewdb.put(obj.key,obj.value,function(err) {
                cb();
              });
            } else {
              for(var _key in obj.value) {
                if(!_obj[_key]) _obj[_key] = 0;
                _obj[_key] += obj.value[_key];
              }
              console.log('put',obj.value,_obj);
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
