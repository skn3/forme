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

function callInvalid(context) {
    throw new Error('invalid call to '+context);
}

function callCheckInactive(form, context) {
    if (form && form._request === null) {
        return true;
    }

    callInvalid(context);
}

function callCheckActive(form, context) {
    if (form && form._request !== null) {
        return true;
    }

    callInvalid(context);
}

//expose
module.exports = {
    promise: {
        result: promiseResult,
    },
    clone: {
        property: cloneProperty,
    },
    call: {
        check: {
            inactive: callCheckInactive,
            active: callCheckActive,
        },
        invalid: callInvalid,
    },
};
