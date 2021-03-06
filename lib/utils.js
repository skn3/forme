'use strict';

//module imports
const crypto = require('crypto');
const url = require('url');
const querystring = require('querystring');

//cyclic pattern
const utils = {};
module.exports = utils;

//local imports
const FormeError = require('./errors').FormeError;
const FormeGroup = require('./group');

//functions
function compareValues(value1, value2, strict) {
    if (strict) {
        return value1 === value2;
    } else {
        //noinspection EqualityComparisonWithCoercionJS
        return value1 == value2;
    }
}

function generateToken(size, errorFactory) {
    return new Promise((resolve, reject) => {
        crypto.randomBytes(Math.ceil(size/2), (err, buffer) => {
            if (err) {
                if (errorFactory) {
                    return reject(errorFactory(err));
                } else {
                    return new FormeError(err);
                }
            } else {
                return resolve(buffer.toString('hex').slice(0, size));
            }
        });
    })
}

function getString(value) {
    if (typeof value === 'string') {
        return value;
    } else if(value === true) {
        return '1';
    } else if (value === false) {
        return '0';
    } else if (value === null || value === undefined) {
        return '';
    } else {
        if (Array.isArray(value)) {
            return value.join(',');
        } else if (typeof value === 'object') {
            return value.toString();
        } else {
            return '';
        }
    }
}

function promiseResult(promise) {
    //real wrapper
    return new Promise((resolve, reject) => {
        if (promise instanceof Promise) {
            return promise
            .then(result => {
                resolve(result);
            })
            .catch(err => reject(err));
        } else {
            if (promise instanceof Error) {
                //fail
                return reject(promise);
            } else {
                //success
                return resolve(promise);
            }
        }
    });
}

function upperCaseFirst(text) {
    if (typeof text === 'string' && text.length > 0) {
        return text.slice(0,1).toUpperCase()+text.slice(1);
    } else {
        return text;
    }
}

//url functions
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
    info.search = build.length === 0?'':'?' + build.join('&');
    return url.format(info);
}

function extractQuery(path) {
    const info = url.parse(path, false);
    return querystring.parse(info.query);
}

function removeQuery(path, keys) {
    const info = url.parse(path, false);
    const query = querystring.parse(info.query);

    const build = [];
    if (Array.isArray(keys)) {
        for (let key of Object.keys(query)) {
            if (keys.indexOf(key) === -1) {
                build.push(querystring.escape(key) + '=' + querystring.escape(query[key]));
            }
        }
    } else {
        for (let key of Object.keys(query)) {
            if (key !== keys) {
                build.push(querystring.escape(key) + '=' + querystring.escape(query[key]));
            }
        }
    }

    //update info
    info.query = null;
    info.search = build.length === 0?'':'?' + build.join('&');
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
    //noinspection Annotator
    return url.parse(path).pathname;
}

function compareUrlPaths(path1, path2) {
    return urlPath(path1) === urlPath(path2);
}

//call functions
function callInvalid(context) {
    throw new Error(`invalid call to ${context}`);
}

function callUnsupported(context) {
    throw new Error(`unsupported call to ${context}`);
}

function callCheckInactive(form, context) {
    if (form && (form._request === null || !form._request._started)) {
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
    if (form && form._request !== null && form._request._started && !form._request._building) {
        return true;
    }

    callInvalid(context);
}

function callCheckNotInactive(form, context) {
    if (form && form._request !== null && (form._request._started || form._request._loading)) {
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

//group functions
function createGroupStructure(inputs, out=null) {
    //if we dont have a structure to output, then we obviously need one!
    out = out || {};

    //iterate over all inputs
    for (let input of inputs) {
        const group = input._group;

        //add segments to the group structure
        if (group !== null) {
            let parent = out;
            for (let segmentIndex = 0; segmentIndex < group.length; segmentIndex++) {
                const segment = group[segmentIndex];

                //check if segment exists in parent
                if (parent[segment] === undefined) {
                    parent[segment] = new FormeGroup();
                }

                //update parent pointer
                parent = parent[segment];
            }
        }
    }

    //winner
    return out;
}

function applyGroups(output, groups) {
    //merges the groups and ensures that new groups are all FormeGroup
    function recurse(output, parent) {
        if (parent !== null) {
            for (let key of Object.keys(parent)) {
                const child = parent[key];

                if (child !== null && typeof child === 'object') {
                    //group
                    let newOutput = output[key];

                    if (!(newOutput instanceof FormeGroup)) {
                        newOutput = new FormeGroup();
                        output[key] = newOutput;
                    }

                    recurse(newOutput, child);
                } else {
                    //value
                    output[key] = child;
                }
            }
        }

        return output;
    }

    //do it
    output = output || {};
    if (!groups || typeof groups !== 'object') {
        return output;
    } else {
        return recurse(output, groups);
    }
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

function findGroupPath(groups, path) {
    //skip
    if (!path || path.length === 0) {
        return groups;
    }

    //make sure path is an array of segments
    if (typeof path === 'string') {
        path = path.split('.');
    }

    //get the initial pointer
    let pointer = groups;

    //walk the path?
    if (path.length > 0) {
        let index = 0;
        while (pointer && index < path.length) {
            pointer = pointer[path[index++]];
        }

        //cancel if we didnt get to the end of the scan
        if (index < path.length) {
            pointer = undefined;
        }
    }

    //found it?
    return pointer || undefined;
}

function findGroupValue(groups, path, defaultValue=undefined) {
    //skip
    if (!path || path.length === 0) {
        return defaultValue;
    }

    //use the path find func and check for unfound
    const value = findGroupPath(groups, path);
    if(value === undefined || value === groups) {
        return defaultValue;
    }

    //found it!
    return value;
}

//expose
utils.string = {
    token: generateToken,
    upperCaseFirst: upperCaseFirst,
};

utils.url = {
    addQuery: addQuery,
    removeQuery: removeQuery,
    containsQuery: containsQuery,
    path: urlPath,
    comparePaths: compareUrlPaths,
    extractQuery: extractQuery,
};

utils.promise = {
    result: promiseResult,
};

utils.call = {
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
    unsupported: callUnsupported,
};

utils.group = {
    create: {
        structure: createGroupStructure,
    },
    apply: applyGroups,
    addGroup: addGroupToStructure,
    addToLookup: addGroupsToLookup,
    find: {
        path: findGroupPath,
        value: findGroupValue,
    }
};

utils.value = {
    string: getString,
    compare: compareValues,
};
