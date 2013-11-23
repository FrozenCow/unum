var debug = require('debug')('unum.jsonhelper');

module.exports = function(ctx) {
  var req = ctx.req;
  var res = ctx.res;

  if (res) {
    res.json = function(obj) {
      this.setHeader('Content-Type', 'application/json');
      this.end(JSON.stringify(obj));
    };
  }

  if (req) {
    req.json = function(callback) {
      // TODO: check for json content-type?
      //req.headers['content-type'] === 'application/json'
      var content = '';
      this.on('data',function(data) {
        debug('data received', data);
        content += data;
      });
      this.on('end',function() {
        
        debug('data assembled', content);
        try {
          callback(null,JSON.parse(content));
        } catch(e) {
          callback(e);
        }
      });
    };
  }

  ctx.next();
};