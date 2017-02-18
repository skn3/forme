'use strict';

//module imports
const crypto = require('crypto');
const url = require('url');
const querystring = require('querystring');

//local imports
const FormeBase = require('./base');
const FormeGroup = require('./group');

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
    for (let key of Object.keys(query)) {
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
    info.search = build.length == 0?'':'?' + build.join('&');
    return url.format(info);
}

function removeQuery(path, keys) {
    const info = url.parse(path, false);
    const query = querystring.parse(info.query);

    const build = [];
    if (Array.isArray(keys)) {
        for (let key of Object.keys(query)) {
            if (keys.indexOf(key) == -1) {
                build.push(querystring.escape(key) + '=' + querystring.escape(query[key]));
            }
        }
    } else {
        for (let key of Object.keys(query)) {
            if (key != keys) {
                build.push(querystring.escape(key) + '=' + querystring.escape(query[key]));
            }
        }
    }

    //update info
    info.query = null;
    info.search = build.length == 0?'':'?' + build.join('&');
    return url.format(info);
}

function containsQuery(path1, path2) {
    if (path1 === null || path2 === null) {
        return false;
    }

    const info1 = url.parse(path1, true);
    const info2 = url.parse(path2, true);

    for(let key2 of Object.keys(info2.query)) {
        if (info1.query[key2] === undefined) {
            return false;
        }
    }

    return true;
}

function urlPath(path) {
    return url.parse(path).pathname;
}

function compareUrlPaths(path1, path2) {
    return urlPath(path1) == urlPath(path2);
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

function addGroupToStructure(structure, name, group, value) {
    //this function assumes the structure has not been tampered with

    //find the destination
    let destination = structure;
    if (group !== null) {
        for (let targetIndex = 0; targetIndex < group.length; targetIndex++) {
            const segment = group[targetIndex];

            //verify structure
            if (!(destination[segment] instanceof FormeGroup)) {
                destination = null;
                break;
            }

            //next in chain
            destination = destination[segment];
        }
    }

    //we should now have a destination
    if (destination) {
        destination[name] = value;
    }
}

function addGroupsToLookup(groups, lookup) {
    lookup = lookup || {};

    function recurse(parent, group) {
        for(let key of Object.keys(parent)) {
            const child = parent[key];

            group.push(key);

            if (child instanceof FormeGroup) {
                //recurse
                recurse(child, group);
            } else {
                //endpoint
                lookup[key] = group.slice();
            }

            group.pop();
        }
    }

    recurse(groups, []);

    return lookup;
}

function getBool(value, defaultValue) {
    //param is optional. if no param provided then defaults to true
    let result = defaultValue;

    if (value != undefined) {
        result = value == true;
    }

    return result;
}

function findGroupedValueWithLookup(state, lookup, name, defaultValue) {
    //lookup is a key/value pair, probably generated in the _fetchValues function
    if (lookup[name] === undefined) {
        //not found
        return defaultValue;
    } else {
        //find path, continue until lookup path is exhausted
        let pointer = state.values;
        let lookupItem = lookup[name];

        for(let index = 0; index < lookupItem.length;index++) {
            if (pointer[lookupItem[index]] === undefined) {
                return defaultValue;
            } else {
                pointer = pointer[lookupItem[index]];
            }
        }

        //we now have the value
        return pointer;
    }
}

//expose
module.exports = {
    string: {
        token: generateToken,
    },
    url: {
        addQuery: addQuery,
        removeQuery: removeQuery,
        containsQuery: containsQuery,
        path: urlPath,
        comparePaths: compareUrlPaths,
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
    group: {
        addGroup: addGroupToStructure,
        addToLookup: addGroupsToLookup,
        findValue: findGroupedValueWithLookup,
    },
    value: {
        bool: getBool,
    }
};
