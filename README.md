# Unum

[![Build Status](https://travis-ci.org/FrozenCow/unum.png)](https://travis-ci.org/FrozenCow/unum)

Unum is an [Express](http://expressjs.com/)-like framework that unifies better integration of websockets and server-side events, next to the usual HTTP requests. It is based around passing a context-object around, instead of individual request and response objects. This allows the framework to be more flexible in what information is passed to handlers. With the context-objects, not only HTTP requests can be passed, but also also websocket requests.

Note that at the moment the project is mostly used for personal projects where websockets play a big role. It is therefore not very well documented, tests are lacking and you might also come across various bugs.

## Installation

```js
npm install unum
```

## Usage

Here is a minimal example of how to use Unum. It shows how to handle normal HTTP requests (just like Express) and websocket requests.

```js
var unum = require('unum');

var app = new unum.WebApplication();

// Handle HTTP requests
app.get('/hellohttprequest',function(ctx) {
  ctx.res.end('Hello world');
});

// Handle Websocket requests
app.ws('/hellowebsocket',function(ctx) {
  var connection = ctx.accept();
  connection.send('Hello world');
  connection.close();
});
```

Look in [examples/](examples/) for more examples.

## Context

In Unum handlers are defined as `function(ctx){...}`. `ctx` is the context of the handler. The context can contain properties like `req`, `res` and `next`, but also things like `params`.

This method is used to pass along more information to handlers, not just a request and response. This was needed for websockets: websockets do not have a response object, but only a request where connections are accepted or rejected.

Contexts also allow the user to pass along their own information. Often it is nice to have the database in handlers or let handlers know how the server is configured. These things can be defined in the context at server-level. Request-level contexts inherit from the server-level context:

```js
var unum = require('unum');

var app = new unum.WebApplication({
  // This is the server-level context
  database: { a: 1, b: 2, c: 3}
});

app.get('/',function(ctx) {
  // Here 'ctx' is the request-level context.

  ctx.res.end(ctx.database.a);
  // This results in '1' as the HTTP response.
});
```

Lastly, in Express most properties are put into the request object. In some cases this did not seem fitting, like the `session` property. In Unum these properties can be set in the context where applicable, instead of the request.

Note that changes that are made on the request-level do not effect the context on server-level: these are 2 objects where the request-level inherits from the server-level using prototypes.

