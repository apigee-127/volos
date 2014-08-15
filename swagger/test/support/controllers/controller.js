'use strict';

module.exports = {
  run: run
};

var counter = 1;

function run(req, res) {
  res.json({ count: counter++ });
}
