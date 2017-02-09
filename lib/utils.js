'use strict';

//functions
function promiseResult(promise) {
    if (promise instanceof Promise) {
        return promise;
    } else {
        return Promise.resolve(promise);
    }
}

//expose
module.exports = {
    promise: {
        result: promiseResult,
    }
};
