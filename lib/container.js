'use strict';

//module imports
const format = require('string-template');

//local imports
const constants = require('./constants');
const utils = require('./utils');
const {FormeConfigurableMethod, FormeConfigurableOverride, FormeConfigurableParam, FormeConfigurableBool, FormeConfigurableInt, FormeConfigurableFloat, FormeConfigurableString, FormeConfigurableArray, FormeConfigurableObject, FormeConfigurableCallbacks, FormeConfigurableStrings} = require('./configurable');

const FormeError = require('./errors').FormeError;
const FormeBase = require('./base');
const FormeInput = require('./input');

const ContainerValidateHandlerRequire = require('./handlers/container/validate/containerValidateHandlerRequire');
const ContainerValidateHandlerCustom = require('./handlers/container/validate/containerValidateHandlerCustom');

//locals
const handlerLookup = {
    require: ContainerValidateHandlerRequire,
    validate: ContainerValidateHandlerCustom,
};
let configurableMethods = null;

//classes
class FormeContainer extends FormeBase {
    constructor(type, form, name) {
        super(type || 'FormeContainer', form, name || 'undefined');

        this._form = form;
        this._inputs = [];

        this._loadHandlers = [];
        this._buildHandlers = [];
        this._actionHandlers = [];
    };

    //static properties
    static get configurableMethods() {
        //first time call, inherit and create cache for Forme!
        if (configurableMethods === null) {
            configurableMethods = Object.assign({}, super.configurableMethods, {
                //container.name(string)
                name: new FormeConfigurableMethod('name', [
                    new FormeConfigurableOverride([
                        new FormeConfigurableString('name', true),
                    ], true),
                ]),

                //container.load(callback(s))
                load: new FormeConfigurableMethod('load', [
                    new FormeConfigurableOverride([
                        new FormeConfigurableCallbacks(['callback', 'callbacks'], true),
                    ], true),
                ]),

                //container.build(callback(s))
                build: new FormeConfigurableMethod('build', [
                    new FormeConfigurableOverride([
                        new FormeConfigurableCallbacks(['callback', 'callbacks'], true),
                    ], true),
                ]),

                //container.action(string(s), callback(s))
                action: new FormeConfigurableMethod('action', [
                    new FormeConfigurableOverride([
                        new FormeConfigurableStrings(['action', 'actions'], true),
                        new FormeConfigurableCallbacks(['callback', 'callbacks'], true),
                    ], false),
                ]),

                //container.require(object(s), string, error)
                require: new FormeConfigurableMethod('require', [
                    new FormeConfigurableOverride([
                        new FormeConfigurableObject(['conditions', 'condition'], true),
                        new FormeConfigurableString(['op', 'operation'], true),
                        new FormeConfigurableString('error', false),
                    ], false),
                ]),

                //container.add(value) -> renamed to "inputs"
                inputs: new FormeConfigurableMethod('add', [
                    new FormeConfigurableOverride([
                        new FormeConfigurableParam(['input', 'inputs'], true),
                    ], true),
                ]),
            });
        }

        //return cache
        return configurableMethods;
    }

    //private functions
    static _buildInputConditions(conditions) {
        const build = [];

        if (typeof conditions === 'string') {
            //single string
            build.push([conditions]);
        } else if (conditions instanceof Array) {
            //array of ?
            for(let index = 0;index < conditions.length;index++) {
                if (typeof conditions[index] === 'string') {
                    //single string
                    build.push([conditions[index]]);
                } else if (conditions[index] instanceof Array) {
                    //provided an array so we need to add all strings
                    let subBuild = [];
                    for(let subIndex = 0;subIndex < conditions[index].length;subIndex++) {
                        if (typeof conditions[index][subIndex] === 'string') {
                            subBuild.push(conditions[index][subIndex]);
                        }
                    }

                    //only bother adding if it has any valid strings
                    if (subBuild.length) {
                        build.push(subBuild);
                    }
                }
            }
        }

        return build;
    }

    //private methods
    _findInput(source) {
        if (source instanceof FormeInput) {
            return source;
        } else {
            let input = null;
            let sourceGroups;

            if (Array.isArray(source)) {
                //passed in array group path
                sourceGroups = source;
            } else if (typeof source === 'string') {
                //1 - search for exact name match
                let input = this._form._inputs.find(input => input._name === source);

                if (input) {
                    return input;
                }

                //continue to search the group path
                sourceGroups = source.split('.');
            } else {
                return null;
            }

            //2 - search for group path/and or alias
            const sourceName = sourceGroups.pop();
            for(input of this._form._inputs) {
                if (input._group === null) {
                    //check alias
                    if (input._alias === sourceName) {
                        return input;
                    }
                } else {
                    //search path
                    const groups = input._group;

                    if (groups.length === sourceGroups.length) {
                        let found = true;

                        for (let index = 0; index < sourceGroups.length; index++) {
                            if (groups[index] !== sourceGroups[index]) {
                                found = false;
                                break;
                            }
                        }

                        if (found && (sourceName === input._name || sourceName === input._alias)) {
                            return input;
                        }
                    }
                }
            }

            return null;
        }
    }

    _addInput(input) {
        this._inputs.push(input);
        return input;
    }

    _addLoadHandler(callback) {
        this._loadHandlers.push(callback);
    }

    _addBuildHandler(callback) {
        this._buildHandlers.push(callback);
    }

    _addCustomValidateHandler(callback, error) {
        this._validateHandlers.push(new ContainerValidateHandlerCustom(callback, error));
    }

    _addActionHandler(action, callback) {
        //add action handler
        this._actionHandlers.push({
            action: action,
            callback: callback,
        })
    }

    _addActionHandlers(actions, callback) {
        if (!Array.isArray(actions)) {
            this._addActionHandler(actions, callback);
        } else {
            for(let action of actions) {
                this._addActionHandler(action, callback);
            }
        }
    }

    _nextLoadHandler(index) {
        return utils.promise.result(this._executeLoadHandler(this._loadHandlers[index]))
        .then(() => ++index === this._loadHandlers.length ? Promise.resolve() : this._nextLoadHandler(index));
    }

    _nextBuildHandler(index) {
        return utils.promise.result(this._executeBuildHandler(this._buildHandlers[index]))
        .then(() => ++index === this._buildHandlers.length ? Promise.resolve() : this._nextBuildHandler(index));
    }

    _nextValidateHandler(index) {
        const handler = this._validateHandlers[index];

        //build state, values are not grouped here!
        //lookup will be populated by _fetchValues, and provide an array of group segments to reach a specific ._name input
        //eg lookup['inputNameOne'] = ['group1','subGroup2','inputAlias/inputName']
        const lookup = {};
        const state = {
            values: this._form._fetchValues(false, true, false, true, true, false, lookup, null),
        };
        const oldValues = this._form._fetchValues(false, false, false, true, true, false, null, null);

        //iterate
        return new Promise((resolve, reject) => {
            //this in turn will call teh containers _executeValidateHandler
            return handler.execute(this, state)
            .then(() => {
                //check if state has changed, we need to locate based on group
                for (let input of this._form._inputs) {
                    const newValue = utils.group.findValue(state, lookup, input._name, null);

                    if (newValue !== oldValues[input._name]) {
                        this._form._setInputNameValue(input._name, newValue);
                    }
                }

                resolve();
            })
            .catch(err => {
                //all errors generated here are considered handled
                //extract error string from catch (if an error was provided)
                let error = (err?err.message:null) || '';

                //use handler specified error instead
                if (handler.error !== null) {
                    error = handler.error;
                }

                if (error && error.length > 0) {
                    //apply inline template vars
                    error = format(error, {
                        name: this._name,
                        label: this._label,
                    });

                    //add error to container
                    this._form.error(error);
                }

                //cancel iteration
                reject();
            });
        })
        .then(() => ++index === this._validateHandlers.length ? Promise.resolve() : this._nextValidateHandler(index))
        .catch(err => {
            //unhandled errors
            this._form._catchError(err);
        });
    }

    _nextActionHandler(index) {
        return this._executeMultipleActions(this._actionHandlers[index].action, this._actionHandlers[index].callback)
        .then(() => ++index === this._actionHandlers.length ? Promise.resolve() : this._nextActionHandler(index));
    }

    _executeBuildHandler(handler) {
        //should be overridden
        return Promise.resolve();
    }

    _executeActionHandler(handler) {
        //should be overridden
        return Promise.resolve();
    }

    _executeMultipleActions(actions, callback) {
        //skip
        if (!callback) {
            return Promise.resolve();
        }

        if (!Array.isArray(actions)) {
            return this._executeSingleAction(actions, callback);
        } else {
            const jobs = [];
            for(let action of actions) {
                jobs.push(this._executeSingleAction(action, callback));
            }
            return Promise.all(jobs);
        }
    }

    _executeSingleAction(action, callback) {
        const jobs = [];
        for(let requestAction of this._request._actions) {
            if (requestAction.action === action) {
                jobs.push(utils.promise.result(this._executeActionHandler(callback, requestAction)));
            }
        }

        return Promise.all(jobs);
    }

    _add(details) {
        if (details && typeof details === 'object') {
            //add input and also configure
            //make sure we have a name
            if (!details.name) {
                throw new FormeError(`invalid input name '${details.name}'`);
            }

            //add and configure
            return this._addInput(new FormeInput(this._form, details.name)).configure(details);
        } else {
            //just add the input assuming that "details" is actually the name
            //make sure we have a name
            if (!details) {
                throw new FormeError(`invalid input name '${details.name}'`);
            }

            //add
            return this._addInput(new FormeInput(this._form, details));
        }
    }

    //public methods
    add(details) {
        if (utils.call.check.not.active(this._form, this._baseType+'.store()')) {
            //how many?
            if (Array.isArray(details)) {
                //multiple
                return details.map(details => this._add(details));
            } else {
                //single
                return this._add(details);
            }
        }
    }

    inputs() {
        if (this._form._request) {
            return this._form._request._inputs.map(input => input._name);
        } else {
            return this._inputs.map(input => input._name);
        }
    }

    build(callbacks) {
        if (utils.call.check.not.active(this._form, this._baseType+'.build()')) {
            if (Array.isArray(callbacks)) {
                for(let callback of callbacks) {
                    this._addBuildHandler(callback);
                }
            } else {
                this._addBuildHandler(callbacks);
            }

            //chain
            return this;
        }
    }

    action(actions, callbacks) {
        if (utils.call.check.not.active(this._form, this._baseType+'.store()')) {
            //callbacks defined like this are automatically called at the end of a valid submit
            if (Array.isArray(callbacks)) {
                for(let callback of callbacks) {
                    this._addActionHandlers(actions, callback);
                }
            } else {
                this._addActionHandlers(actions, callbacks);
            }

            //chain
            return this;
        }
    }

    load(callbacks) {
        if (utils.call.check.not.active(this, this._baseType+'.submit()')) {
            if (Array.isArray(callbacks)) {
                for(let callback of callbacks) {
                    this._addLoadHandler(callback);
                }
            } else {
                this._addLoadHandler(callbacks);
            }

            //chain
            return this;
        }
    }

    //handler methods
    require(conditions, op, error) {
        if (utils.call.check.not.active(this._form, this._baseType+'.store()')) {
            //build list of arrays
            conditions = this.constructor._buildInputConditions(conditions);
            if (conditions.length) {
                this._validateHandlers.push(new ContainerValidateHandlerRequire(conditions, op, error));
            }

            //chain
            return this;
        }
    }

    remove(what) {
        const type = handlerLookup[what];
        if (type === undefined) {
            throw new Error(`unknown ${this._baseType}.remove() type '${what}'`)
        } else {
            this._removeValidateHandler(type);
        }
    }
}

//expose
module.exports = FormeContainer;