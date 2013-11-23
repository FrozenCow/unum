var unum = require('../index.js');

var app = new unum.WebApplication();

app.use(unum.jsonHelpers);

app.get('/helloworld.json',function(ctx) {
  ctx.res.json({
    message: 'hello world'
  });
});

app.listen(8080);