'use strict';

//local imports
const constants = require('./constants');
const utils = require('./utils');

const FormeBase = require('./base');
const FormeInput = require('./input');

const ContainerHandlerRequire = require('./handlers/container/containerHandlerRequire');
const ContainerHandlerValidate = require('./handlers/container/containerHandlerValidate');

class FormeContainer extends FormeBase {
    constructor(form, name) {
        super(name || 'undefined');
        this._form = form;
        this._inputs = [];
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

    //public methods
    add(name) {
        //chain
        return this._addInput(new FormeInput(this._form, name));
    }

    inputs() {
        if (this._form._request) {
            return this._form._request._inputs.map(input => input._name);
        } else {
            return this._inputs.map(input => input._name);
        }
    }

    validate(callback, error) {
        this._addValidateHandler(callback, error);
    }

    submit(callback) {
        this._addSubmitHandler(...arguments);

        //chain
        return this;
    }

    action(actions, callback) {
        //callbacks defined like this are automatically called at the end of a valid submit
        this._addActionHandlers(actions, callback);

        //chain
        return this;
    }

    next(callback) {
        return this.action(constants.actionPrefix+'next', callback);
    }

    prev(callback) {
        return this.action(constants.actionPrefix+'prev', callback);
    }

    //handler methods
    require(conditions, op, error) {
        //build list of arrays
        conditions = this.constructor._buildInputConditions(conditions);
        if (conditions.length) {
            this._validateHandlers.push(new ContainerHandlerRequire(conditions, op, error));
        }

        //chain
        return this;
    }
}

//expose
module.exports = FormeContainer;