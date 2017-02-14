'use strict';

//local imports
const FormeBase = require('./base');

//functions
function promiseResult(promise) {
    return promise instanceof Promise ? promise : Promise.resolve(promise);
}

function cloneProperty(property, override) {
    if (property === null) {
        return null;
    } else {
        if (Array.isArray(property)) {
            return property.map(item => item instanceof FormeBase ? item._clone(override) : item);
        } else {
            return property;
        }
    }
}

//expose
module.exports = {
    promise: {
        result: promiseResult,
    },
    clone: {
        property: cloneProperty,
    }
};
