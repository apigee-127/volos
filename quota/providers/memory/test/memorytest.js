var assert = require('assert');
var spi = require('..');

describe('Memory quota test', function() {
 var pm;
 var ph;

 before(function() {
   pm = new spi({
     timeInterval: 2000,
     allow: 2
   });
   ph = new spi({
     timeInterval: 10000,
     allow: 2
   });
 });

 it('Basic per-minute', function(done) {
   pm.apply({
     identifier: 'One',
     weight: 1
   }, function(err, result) {
     assert(!err);
     checkResult(result, 2, 1, true);

     pm.apply({
       identifier: 'Two',
       weight: 1
     }, function(err, result) {
       assert(!err);
       checkResult(result, 2, 1, true);

       pm.apply({
         identifier: 'One',
         weight: 1
       }, function(err, result) {
         assert(!err);
         checkResult(result, 2, 2, true);

         pm.apply({
           identifier: 'One',
           weight: 1
         }, function(err, result) {
           assert(!err);
           checkResult(result, 2, 3, false);
           done();
         });
       });
     });

   });
 });

 it('Quota weight', function(done) {
   pm.apply({
     identifier: 'WeightOne',
     weight: 1
   }, function(err, result) {
     assert(!err);
     checkResult(result, 2, 1, true);

     pm.apply({
       identifier: 'WeightOne',
       weight: 3
     }, function(err, result) {
       assert(!err);
       checkResult(result, 2, 4, false);
       done();
     });
   });
 });

 it('Dynamic', function(done) {
   pm.apply({
     identifier: 'DynOne',
     weight: 1
   }, function(err, result) {
     assert(!err);
     checkResult(result, 2, 1, true);

     pm.apply({
       identifier: 'DynOne',
       weight: 1,
       allow: 1
     }, function(err, result) {
       assert(!err);
       checkResult(result, 1, 2, false);
       done();
     });
   });
 });

 it('Timeout', function(done) {
   this.timeout(30000);
   pm.apply({
     identifier: 'TimeOne',
     weight: 1
   }, function(err, result) {
     assert(!err);
     checkResult(result, 2, 1, true);

     // Ensure quota is reset within a minute
     setTimeout(function() {
       pm.apply({
         identifier: 'TimeOne',
         weight: 1
       }, function(err, result) {
         assert(!err);
         checkResult(result, 2, 1, true);
         done();
       });
     }, 2001);
   });
 });

  it('Timeout Cleanup', function(done) {
   this.timeout(30000);
   pm.apply({
     identifier: 'TimeTwo',
     weight: 1
   }, function(err, result) {
     assert(!err);
     checkResult(result, 2, 1, true);

     // Just let timeout thread run and actually do something
     setTimeout(function() {
       done();
     }, 4001);
   });
 });

 it('Hour', function(done) {
   this.timeout(30000);
   ph.apply({
     identifier: 'HourOne',
     weight: 1
   }, function(err, result) {
     assert(!err);
     checkResult(result, 2, 1, true);

     // Ensure quota is not reset within an hour
     setTimeout(function() {
       ph.apply({
         identifier: 'HourOne',
         weight: 1
       }, function(err, result) {
         assert(!err);
         checkResult(result, 2, 2, true);
         done();
       });
     }, 5002);
   });
 });
});

function checkResult(result, allowed, used, isAllowed) {
  assert(result);
  assert.equal(result.used, used);
  assert.equal(result.allowed, allowed);
  assert.equal(result.isAllowed, isAllowed);
}