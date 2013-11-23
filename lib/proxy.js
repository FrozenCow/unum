var http = require('http');
var debug = require('debug')('unum:proxy');
var URL = require('url');
module.exports = function(options) {
  var proxyUrl = URL.parse(options.target);
  return function(ctx) {
    var req = ctx.req;
    var res = ctx.res;
    if (!req || !res) { return ctx.next(); }

    var headers = {};
    for(var k in req.headers) {
      if (k === 'connection') { continue; }
      if (k === 'host') { continue; }
      headers[k] = req.headers[k];
    }

    var proxyReq = http.request({
      host: proxyUrl.host,
      port: proxyUrl.port,
      hostname: proxyUrl.hostname,
      method: req.method,
      path: req.url,
      headers: headers
    },function(proxyRes) {
      for(var k in proxyRes.headers) {
        if (k === 'connection') { continue; }
        if (k === 'host') { continue; }
        res.setHeader(k,proxyRes.headers[k]);
      }
      res.writeHead(proxyRes.statusCode);
      proxyRes.pipe(res);
    });
    proxyReq.on('error',function(e) {
      debug('Error proxying:',e);

      if (!res.headersSent) {
        res.writeHead(500);
        res.end();
      }

      proxyReq.end();
    });
    req.pipe(proxyReq);
  };
};