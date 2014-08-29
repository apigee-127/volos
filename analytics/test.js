var express    = require('express');
var app        = express();
var bodyParser = require('body-parser');
var onResponse = require('on-response');
var onFinished = require('on-finished');
var http       = require('http');
var apigeeAnalytics = require('./apigeeAnalytics');
// var Analytics  = require('./apigeeanalytics');

var port = process.env.PORT || 8080;
var router = express.Router();

var uploadLimit = 2;
var recordsQueue = [];

var uploadQueue = function(numUpload) {
    var recordsToBeUploaded = recordsQueue.slice(0, numUpload);
    var apigee = require('apigee-access');

    console.log(apigee.getMode());
    
    var apigeeAnalytics = apigee.getAnalytics();
    // apigeeAnalytics.push(recordsToBeUploaded, function(err, result) {
    //     if (err) { }
    //     //Remove result.accepted from recordsQueue
    //     recordsQueue.splice(0,result.accepted);
    // });
};

var analyticsMiddleware = function(req, res, next){
    var record = {};
    record['request_uri'] = req.headers.host + req.url;
    record['request_path'] = req.url.split('?')[0];
    record['request_verb'] = req.method;
    record['client_ip'] = req.connection.remoteAddress;
    record['useragent'] = req.headers['user-agent'];
    
    onResponse(req, res, function (err, summary) {
        record['statusCode'] = res.statusCode;
        console.log(record);
        recordsQueue.push(record);
        console.log(recordsQueue.length);

        if(recordsQueue.length % uploadLimit == 0) {
            uploadQueue(uploadLimit);
        }
    });

    next();
};

router.get('/', function(req, res) {
    // setTimeout(function(){
    // 	res.send(201,{ message: 'hooray! welcome to our api!' });
    // },1000);
    res.send(201,{ message: 'hooray! welcome to our api!' });
});

router.post('/', function(req, res){
    res.send(200, req.body)
});

// app.use(analyticsMiddleware);
var analytics = apigeeAnalytics.create();
var middleware = analytics.expressMiddleWare().useAnalytics();
    
app.use(middleware);
app.use('/api', router);

app.listen(port);
console.log('Magic happens on port ' + port);

