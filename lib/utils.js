'use strict';

//functions
function promiseResult(promise) {
    return promise instanceof Promise ? promise : Promise.resolve(promise);
}

//expose
module.exports = {
    promise: {
        result: promiseResult,
    }
};
