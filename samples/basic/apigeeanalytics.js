var express    = require('express');
var app        = express();
var apigeeAnalytics = require('../../analytics/apigee/lib/apigeeanalytics');

var port = process.env.PORT || 8080;
var router = express.Router();

router.get('/', function(req, res) {
    res.send(200,{ message: 'hooray! welcome to our api!' });
});

router.post('/', function(req, res){
    res.send(200, req.body)
});

var analytics = apigeeAnalytics.create({
    key: process.env.APIGEE_KEY,
    uri: process.env.APIGEE_URI,
    flushInterval: 50,
    bufferSize: 1000,
    proxy: "analyticsproxy"
});
var middleware = analytics.expressMiddleWare().apply();
    
app.use(middleware);
app.use('/api', router);

app.listen(port);
console.log('Magic happens on port ' + port);

