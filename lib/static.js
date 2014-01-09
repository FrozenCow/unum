var debug = require('debug')('unum:static');
var pause = require('pause');
var send = require('send');
var parseUrl = require('./utils').parseUrl;
var assert = require('assert');

/* WebUtilities.static: sends a specified file back as the response
 * options:
 *  root: function that returns root of file path (required)
 *  path: function that returns the path relative to the root; path cannot get to a parent of root (optional)
 *  if path is not specified here, the full path in the request is taken as path
 *  index: default file name when a directory is requested (optional)
 */
module.exports = function(options) {
  return function(ctx) {
    var req = ctx.req;
    var res = ctx.res;
    var next = ctx.next;

    var root = options.root(ctx);
    assert(root);

    if ('GET' != req.method && 'HEAD' != req.method || !res) return next();
    var path = options.path ? options.path(ctx) : parseUrl(req).pathname;
    if (options.index && path === '/') {
      path = options.index;
    }
    var p = pause(req);

    function resume() {
      debug('not found', path, 'from', root);
      p.resume();
      next();
    }

    function error(err) {
      debug('failed',path,'from',root);
      if (404 == err.status) {
        p.resume();
        return next();
      }
      p.resume();
      return next(err);
    }

    function start() {
      debug('streaming', path, 'from', root);
    }

    debug('hosting', path,'from',root);
    
    send(req,path)
    .maxage(0)
    .root(root)
    .hidden(false)
    .on('error', error)
    .on('directory', resume)
    .on('stream',start)
    .pipe(res);
  };
};