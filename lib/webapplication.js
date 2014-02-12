var debug = require('debug')('unum:webapplication');
var WebSocketRequest = require('websocket').request;
var events = require('events');
var util = require('util');
var URL = require('url');

function Context() {
}
util.inherits(Context,events.EventEmitter);
Context.prototype.createContextFrom = function(obj) {
  obj.__proto__ = this;
  obj._events = {};
  this.emit('contextCreated',obj);
  return obj;
};

function merge(a, b){
  if (a && b) {
    for (var key in b) {
      a[key] = b[key];
    }
  }
  return a;
}
function pathRegexp(path, keys) {
  if (path instanceof RegExp) return path;
  if (Array.isArray(path)) path = '(' + path.join('|') + ')';
  path = path
    .replace(/\/\(/g, '(?:/')
    .replace(/(\/)?(\.)?:(\w+)(?:(\(.*?\)))?(\?)?(\*)?/g, function(_, slash, format, key, capture, optional, star){
      keys.push(key);
      slash = slash || '';
      return '' +
        slash +
        '(?:' +
        (format || '') + (capture || (format && '([^/.]+?)' || '([^/]+?)')) + ')' +
        (star ? '(/*)?' : '');
    })
    .replace(/([\/.])/g, '\\$1')
    .replace(/\*/g, '(.*)');
  return new RegExp('^' + path + '$', '');
}

// WebApplication class definition
// Accepts HTTP requests and sends them through the handler-chain.
function WebApplication(serverContext) {
  var me = this;
  me.context = new Context().createContextFrom(serverContext || {});
  me.stack = [];
  me.errorStack = [];
  this.handleUpgrade = this.handleUpgrade.bind(this);
  this.handleRequest = this.handleRequest.bind(this);
}

(function(p) {
  p.attachServer = function(server) {
    server.on('request',this.handleRequest);
    server.on('upgrade',this.handleUpgrade);
  };
  p.detachServer = function(server) {
    server.removeListener('request',this.handleRequest);
    server.removeListener('upgrade',this.handleUpgrade);
  };

  function getRequestURL(req) {
    var protocol = req.connection.encrypted ? 'https' : 'http';
    return URL.parse(protocol + '://' + req.headers.host + req.url);
  }

  // Handle normal HTTP requests.
  function closeRequestContext() {
    if (this.error) {
      this.res.statusCode = this.error.status ? this.error.status : 500;
    }
    this.res.end();
  }
  p.handleRequest = function(req,res) {
    var requestContext = this.context.createContextFrom({
      req: req,
      res: res,
      url: getRequestURL(req),
      close: closeRequestContext
    });
    this.handle(requestContext);
  };

  // Handle upgrade requests (for websockets).
  function closeSocketContext() {
    this.socket.destroy();
  }
  p.handleUpgrade = function(req,socket,head) {
    var upgradeContext = this.context.createContextFrom({
      req: req,
      socket: socket,
      url: getRequestURL(req),
      close: closeSocketContext
    });
    this.handle(upgradeContext);
  };
})(WebApplication.prototype);

// Define the basic functions of WebApplication
(function(p){
  // Add a handler to the end of the handler-chain.
  p.use = function(fn) {
    if (typeof fn !== 'function') {
      debug('Invalid handler:',fn);
      throw new Error('Invalid handler');
    }
    this.stack.push(fn);
    return this;
  };
  // Executes the handler-chain with the specified context.
  // This is used internally from WebApplication.
  p.handle = function(context) {
    var app = this;

    var appRequestContext = context.createContextFrom({
      next: next
    });

    var stack = this.stack;
    var index = 0;
    function next(err) {
      if (err) {
        debug('Error occured in handler:',err);
        app.handleError(err,stack[index],appRequestContext);
        return;
      }
      if (index >= stack.length) {
        debug('Handler chain ended');
        app.handleError(new Error('Handler chain ended'),null,appRequestContext);
        return;
      }
      var handler = stack[index++];
      debug('Handling',handler);
      handler(appRequestContext, next);
    }
    next();
  };
}(WebApplication.prototype));

// Define error handling functions
(function(p){
  p.error = function(fn) {
    if (typeof fn !== 'function') {
      debug('Invalid handler:',fn);
      throw new Error('Invalid handler');
    }
    this.errorStack.push(fn);
    return this;
  };
  p.handleError = function(err,handler,context) {
    var app = this;

    var errorContext = context.createContextFrom({
      next: next,
      error: err,
      handler: handler,
      context: context
    });

    var stack = this.errorStack;
    var index = 0;
    function next(err) {
      if (err) {
        return;
      }
      if (index >= stack.length) {
        debug('End of error handler chain: continueing request-chain');
        return context.__proto__.next();
      }
      var handler = stack[index++];
      debug('Handling error',handler);
      handler(errorContext, next);
    }
    next();
  };
}(WebApplication.prototype));

// Define routing functions on top of 'use'.
(function(p){
  function all(conditions) {
    return function(context) {
      return conditions.every(function(condition) {
        return condition(context);
      });
    };
  }
  function isReqRes(context) {
    return context.req && context.res;
  }
  function isMethod(method) {
    return function(context) {
      return context.req.method.toLowerCase() === method;
    };
  }
  var isGet = isMethod('get');
  var isPost = isMethod('post');
  var isDelete = isMethod('delete');
  var isPut = isMethod('put');
  function isUpgrade(context) {
    return context.req && !context.res && context.socket;
  }
  p.useIf = function(condition,fn) {
    this.stack.push(function(context) {
      if (!condition(context)) {
        return context.next();
      }
      fn(context);
    });
  };
  var routeIf = this.routeIf = function(condition) {
    return function(path,fn) {
      var keys = [];
      var regexp = pathRegexp(path,keys);
      this.useIf(condition,function(context){
        var match = regexp.exec(context.url.pathname);
        debug(context.url.pathname,'matches',path,!!match);
        if (!match) { return context.next(); }
        var params = {};
        var n = 0;
        for (var i = 0; i < match.length; i++) {
          var key = keys[i-1];
          var val;
          try {
            val = (typeof match[i] === 'string'
              ? decodeURIComponent(match[i])
              : match[i]
            );
          } catch(e) {
            var error = new Error('Invalid parameter '+key+' at group '+i+': '+match[i]);
            error.status = 400;
            return context.next(error);
          }
          if (key) {
            params[key] = val;
          } else {
            params[n++] = val;
          }
        }
        fn(context.createContextFrom({
          params: params
        }));
      });
    };
  };
  p.get = routeIf(all([isReqRes,isGet]));
  p.post= routeIf(all([isReqRes,isPost]));
  p.del = routeIf(all([isReqRes,isDelete]));
  p.put = routeIf(all([isReqRes,isPut]));
  p.upgrade = routeIf(isUpgrade);
}(WebApplication.prototype));

// Define the websocket routing function.
(function(p) {
  var wsConfig = {
        maxReceivedFrameSize: 0x10000,
        maxReceivedMessageSize: 0x100000,
        fragmentOutgoingMessages: true,
        fragmentationThreshold: 0x4000,
        keepalive: true,
        keepaliveInterval: 20000,
        dropConnectionOnKeepaliveTimeout: true,
        keepaliveGracePeriod: 10000,
        useNativeKeepalive: false,
        assembleFragments: true,
        autoAcceptConnections: false,
        disableNagleAlgorithm: true,
        closeTimeout: 5000
    };

  p.ws = function(path,fn) {
    this.upgrade(path,function(context) {
      var wsReq = new WebSocketRequest(context.socket,context.req,wsConfig);
      try {
        wsReq.readHandshake();
      } catch(e) {
        debug('Error in websocket handshake:',e);
        return context.next();
      }
      fn({
        __proto__: context,
        socket: undefined,
        wsreq: wsReq
      });
    });
  };
}(WebApplication.prototype));

// Define the server-side event routing function.
(function(p) {
  function ServerSideEvents(req,res) {
    var me = this;
    events.EventEmitter.call(me);
    me.req = req;
    me.res = res;
    res.on('close',function() {
      debug('sse response closed');
      me.emit('close');
    });
  }
  util.inherits(ServerSideEvents, events.EventEmitter);
  ServerSideEvents.prototype.send = function(msg) {
    var res = this.res;
    ['id','event','data'].forEach(function(name) {
      var value = msg[name];
      if (!value) { return; }
      value.split('\n').forEach(function(line) {
        var l = name + ': ' + line + '\n';
        res.write(l);
      });
    });
    res.write('\n');
  };
  ServerSideEvents.prototype.close = function() {
    var res = this.res;
    try {
      res.end();
    } catch(e) { }
  };

  p.sse = function(path,fn) {
    this.get(path,function(context) {
      var req = context.req;
      var res = context.res;
      if (req.headers.accept && req.headers.accept === 'text/event-stream') {
        var sseContext = {
        __proto__: context,
          sse: {
            accept: function() {
              res.setHeader('Content-Type','text/event-stream');
              res.writeHead(200);
              return new ServerSideEvents(req,res);
            },
            reject: function reject(code,msg) {
              res.writeHead(code||403,msg);
              res.end();
            }
          }
        };
        
        fn(sseContext);
      } else {
        context.next();
      }
    });
  };
})(WebApplication.prototype);
module.exports = WebApplication;