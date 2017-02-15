'use strict';

//module imports
const crypto = require('crypto');
const url = require('url');
const querystring = require('querystring');

//local imports
const FormeBase = require('./base');

//functions
function generateToken(size) {
    return new Promise((resolve, reject) => {
        crypto.randomBytes(size, (err, buffer) => {
            if (err) {
                reject(new AppyError(err));
            } else {
                resolve(buffer.toString('hex'));
            }
        });
    })
}

function addQuery(path, values, escape) {
    const info = url.parse(path, false);
    const query = querystring.parse(info.query);
    escape = escape === undefined ? true : escape;

    //add and escape all existing query values that wont get overwritten
    const build = [];
    for (let key in query) {
        if (query[key] !== undefined && values[key] === undefined) {
            build.push(querystring.escape(key) + '=' + querystring.escape(query[key]));
        }
    }

    //add values
    for (let key of Object.keys(values)) {
        if (escape) {
            build.push(querystring.escape(key) + '=' + querystring.escape(values[key]));
        } else {
            build.push(querystring.escape(key) + '=' + values[key]);
        }
    }

    //update info
    info.query = null;
    if (build.length == 0) {
        info.search = '';
    } else {
        info.search = '?' + build.join('&');
    }

    //done
    return url.format(info);
}

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

function callCheckBuilding(form, context) {
    if (form && form._request !== null && form._request._building) {
        return true;
    }

    callInvalid(context);
}

function callCheckActive(form, context) {
    if (form && form._request !== null && !form._request._building) {
        return true;
    }

    callInvalid(context);
}

function callCheckNotInactive(form, context) {
    if (form && form._request !== null) {
        return true;
    }

    callInvalid(context);
}

function callCheckNotBuilding(form, context) {
    if (form && (form._request === null || !form._request._building)) {
        return true;
    }

    callInvalid(context);
}

function callCheckNotActive(form, context) {
    if (form && (form._request === null || form._request._building)) {
        return true;
    }

    callInvalid(context);
}

//expose
module.exports = {
    string: {
        token: generateToken,
    },
    url: {
        addQuery: addQuery,
    },
    promise: {
        result: promiseResult,
    },
    clone: {
        property: cloneProperty,
    },
    call: {
        check: {
            inactive: callCheckInactive,
            building: callCheckBuilding,
            active: callCheckActive,
            not: {
                inactive: callCheckNotInactive,
                building: callCheckNotBuilding,
                active: callCheckNotActive,
            },
        },
        invalid: callInvalid,
    },
};
