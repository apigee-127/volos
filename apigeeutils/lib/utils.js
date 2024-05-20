/* jshint node: true  */
'use strict';

function cleanResults(results) {
    var tempResults = [];
    
    for(var i = 0; i < results.length; i++) {
        if (results[i] !== null && results[i] !== undefined) {
            if (Array.isArray(results[i])) {
                var cleanedItem = cleanResults(results[i])
                if (cleanedItem.length === 0) {
                    continue; // skip null arrays from subseries
                }
            }

            tempResults.push(results[i])
        }
    }

    return tempResults
}

module.exports.cleanResults = cleanResults