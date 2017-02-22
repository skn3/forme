'use strict';

//module imports
const format = require('string-template');

//local imports
const constants = require('./constants');
const utils = require('./utils');

const FormeBase = require('./base');
const FormeInput = require('./input');

const FormeError = require('./errors').FormeError;

const ContainerHandlerRequire = require('./handlers/container/containerHandlerRequire');
const ContainerHandlerValidate = require('./handlers/container/containerHandlerValidate');

class FormeContainer extends FormeBase {
    constructor(type, form, name) {
        super(name || 'undefined');
        this._containerType = type || 'container';
        this._form = form;
        this._inputs = [];
        this._buildHandlers = [];
        this._validateHandlers = [];
        this._submitHandlers = [];
        this._actionHandlers = [];
    };

    //private functions
    static _buildInputConditions(conditions) {
        const build = [];

        if (typeof conditions == 'string') {
            //single string
            build.push([conditions]);
        } else if (conditions instanceof Array) {
            //array of ?
            for(let index = 0;index < conditions.length;index++) {
                if (typeof conditions[index] == 'string') {
                    //single string
                    build.push([conditions[index]]);
                } else if (conditions[index] instanceof Array) {
                    //provided an array so we need to add all strings
                    let subBuild = [];
                    for(let subIndex = 0;subIndex < conditions[index].length;subIndex++) {
                        if (typeof conditions[index][subIndex] == 'string') {
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
            } else {
                //1 - search for exact name match
                let input = this._form._inputs.find(input => input._name == source);

                if (input) {
                    return input;
                }

                //continue to search the group path
                sourceGroups = source.split('.');
            }

            //2 - search for group path/andor alias
            const sourceName = sourceGroups.pop();
            for(input of this._form._inputs) {
                if (input._group === null) {
                    //check alias
                    if (input._alias == sourceName) {
                        return input;
                    }
                } else {
                    //search path
                    const groups = input._group;

                    if (groups.length === sourceGroups.length) {
                        let found = true;

                        for (let index = 0; index < sourceGroups.length; index++) {
                            if (groups[index] != sourceGroups[index]) {
                                found = false;
                                break;
                            }
                        }

                        if (found && (sourceName == input._name || sourceName == input._alias)) {
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

    _addBuildHandler(callback) {
        this._buildHandlers.push(callback);
    }

    _addValidateHandler(callback, error) {
        this._validateHandlers.push(new ContainerHandlerValidate(callback, error));
    }

    _addSubmitHandler(callback) {
        this._submitHandlers.push(callback);
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

    _nextBuildHandler(index) {
        return utils.promise.result(this._executeBuildHandler(this._buildHandlers[index]))
        .then(() => ++index == this._buildHandlers.length ? Promise.resolve() : this._nextBuildHandler(index));
    }

    _nextValidateHandler(index) {
        const handler = this._validateHandlers[index];

        //build state, values are not grouped here!
        //lookup will be populated by _fetchValues, and provide an array of group segments to reach a speciffic ._name input
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

                    if (newValue != oldValues[input._name]) {
                        this._form._setInputValue(input, newValue);
                    }
                }

                resolve();
            })
            .catch(err => {
                //pass it after the iteration where the error is handled
                reject(err);
            });
        })
        .then(() => ++index == this._validateHandlers.length ? Promise.resolve() : this._nextValidateHandler(index))
        .catch(err => {
            //extract error string from catch (if an error was provided)
            let error = (err?err.message:null) || '';

            //use handler specified error instead
            if (handler.error !== null) {
                error = handler.error;
            }

            if (!error || error.length == 0) {
                //reject without an error
                return Promise.reject();
            } else {
                //apply inline template vars
                error = format(error, {
                    name: this._name,
                    label: this._label,
                });

                //add error to container
                this._form.error(error);

                //pass modified error down catch chain
                return Promise.reject(new FormeError(error));
            }
        });
    }

    _nextSubmitHandler(index) {
        return utils.promise.result(this._executeSubmitHandler(this._submitHandlers[index]))
        .then(() => ++index == this._submitHandlers.length ? Promise.resolve() : this._nextSubmitHandler(index));
    }

    _nextActionHandler(index) {
        return this._executeMultipleActions(this._actionHandlers[index].action, this._actionHandlers[index].callback)
        .then(() => ++index == this._actionHandlers.length ? Promise.resolve() : this._nextActionHandler(index));
    }

    _executeBuildHandler(handler) {
        //should be overridden to provide custom per container type execution
        return Promise.resolve();
    }

    _executeValidateHandler(handler, state) {
        //should be overridden to provide custom per container type execution
        return Promise.resolve();
    }

    _executeSubmitHandler(handler) {
        //should be overridden to provide custom per container type execution
        return Promise.resolve();
    }

    _executeActionHandler(handler) {
        //should be overridden to provide custom per container type execution
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
            if (requestAction.action == action) {
                jobs.push(utils.promise.result(this._executeActionHandler(callback, requestAction)));
            }
        }

        return Promise.all(jobs);
    }

    //public methods
    add(name) {
        if (utils.call.check.not.active(this._form, this._containerType+'.store()')) {
            //chain
            return this._addInput(new FormeInput(this._form, name));
        }
    }

    inputs() {
        if (this._form._request) {
            return this._form._request._inputs.map(input => input._name);
        } else {
            return this._inputs.map(input => input._name);
        }
    }

    build(callback) {
        if (utils.call.check.not.active(this._form, this._containerType+'.build()')) {
            this._addBuildHandler(callback);

            //chain
            return this;
        }
    }

    validate(callback, error) {
        if (utils.call.check.not.active(this._form, this._containerType+'.store()')) {
            this._addValidateHandler(callback, error);

            //chain
            return this;
        }
    }

    submit(callback) {
        if (utils.call.check.not.active(this._form, this._containerType+'.store()')) {
            this._addSubmitHandler(callback);

            //chain
            return this;
        }
    }

    action(actions, callback) {
        if (utils.call.check.not.active(this._form, this._containerType+'.store()')) {
            //callbacks defined like this are automatically called at the end of a valid submit
            this._addActionHandlers(actions, callback);

            //chain
            return this;
        }
    }

    //handler methods
    require(conditions, op, error) {
        if (utils.call.check.not.active(this._form, this._containerType+'.store()')) {
            //build list of arrays
            conditions = this.constructor._buildInputConditions(conditions);
            if (conditions.length) {
                this._validateHandlers.push(new ContainerHandlerRequire(conditions, op, error));
            }

            //chain
            return this;
        }
    }
}

//expose
module.exports = FormeContainer;