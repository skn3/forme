'use strict';

//local imports
const utils = require('./utils');
const {FormeConfigurableMethod, FormeConfigurableOverride, FormeConfigurableParam, FormeConfigurableBool, FormeConfigurableInt, FormeConfigurableFloat, FormeConfigurableString, FormeConfigurableArray, FormeConfigurableObject, FormeConfigurableCallbacks, FormeConfigurableStrings} = require('./configurable');

//locals
let configurableMethods = null;

//classes
class FormeBase {
    constructor(type, form, name) {
        this._baseType = type || 'FormeBase';
        
        this._form = form;
        this._name = name;
        this._label = this._name;
        this._context = {};

        this._processHandlers = [];
        this._validateHandlers = [];
        this._executeHandlers = [];
        this._successHandlers = [];
        this._failHandlers = [];
        this._submitHandlers = [];
        this._doneHandlers = [];
    }

    //static properties
    static get configurableMethods() {
        //first time call, create cache that will get inherited!
        if (configurableMethods === null) {
            configurableMethods = {
                //base.label(string)
                label: new FormeConfigurableMethod('label', [
                    new FormeConfigurableOverride([
                        new FormeConfigurableString('label', false),
                    ], true),
                ]),

                //base.context(*multiple*)
                context: new FormeConfigurableMethod('context', [
                    //base.context(name, value)
                    new FormeConfigurableOverride([
                        new FormeConfigurableString('name', true),
                        new FormeConfigurableString('value', true),
                    ], false),

                    //base.context(object)
                    new FormeConfigurableOverride([
                        new FormeConfigurableObject('context', true),
                    ], true),
                ]),

                //base.validate(callback(s))
                validate: new FormeConfigurableMethod('validate', [
                    new FormeConfigurableOverride([
                        new FormeConfigurableCallbacks(['callback', 'callbacks'], true),
                        new FormeConfigurableString('error', false),
                    ], true),
                ]),

                //base.success(callback(s))
                success: new FormeConfigurableMethod('success', [
                    new FormeConfigurableOverride([
                        new FormeConfigurableCallbacks(['callback', 'callbacks'], true),
                    ], true),
                ]),

                //base.fail(callback(s))
                fail: new FormeConfigurableMethod('fail', [
                    new FormeConfigurableOverride([
                        new FormeConfigurableCallbacks(['callback', 'callbacks'], true),
                    ], true),
                ]),

                //base.submit(callback(s))
                submit: new FormeConfigurableMethod('submit', [
                    new FormeConfigurableOverride([
                        new FormeConfigurableCallbacks(['callback', 'callbacks'], true),
                    ], true),
                ]),

                //base.done(callback(s))
                done: new FormeConfigurableMethod('done', [
                    new FormeConfigurableOverride([
                        new FormeConfigurableCallbacks(['callback', 'callbacks'], true),
                    ], true),
                ]),
            };
        }

        //return cache
        return configurableMethods;
    }

    //private methods
    _clone(override) {
        //by ref
        return this;
    }

    _execute() {
        if (this._executeHandlers.length === 0) {
            return Promise.resolve();
        } else {
            return this._nextExecuteHandler(0);
        }
    }

    _validate() {
        if (this._validateHandlers.length === 0) {
            return Promise.resolve();
        } else {
            return this._nextValidateHandler(0);
        }
    }

    _success() {
        if (this._successHandlers.length === 0) {
            return Promise.resolve();
        } else {
            return this._nextSuccessHandler(0);
        }
    }

    _fail() {
        if (this._failHandlers.length === 0) {
            return Promise.resolve();
        } else {
            return this._nextFailHandler(0);
        }
    }

    _submit() {
        if (this._submitHandlers.length === 0) {
            return Promise.resolve();
        } else {
            return this._nextSubmitHandler(0);
        }
    }

    _done() {
        if (this._doneHandlers.length === 0) {
            return Promise.resolve();
        } else {
            return this._nextDoneHandler(0);
        }
    }

    //private find methods
    _findValidateHandlers(type) {
        return this._validateHandlers.filter(handler => handler.constructor === type);
    }

    //private remove methods
    _removeValidateHandler(type) {
        this._validateHandlers = this._validateHandlers.filter(handler => handler.constructor !== type);
    }

    //private add methods
    _addProcessHandler(handler) {
        this._executeHandlers.push(handler);
        this._processHandlers.push(handler);
    }

    _addValidateHandler(handler) {
        this._executeHandlers.push(handler);
        this._validateHandlers.push(handler);
    }

    _addCustomValidateHandler(callback, error) {
        //should be overridden
    }

    _addCustomSubmitHandler(callback) {
        this._submitHandlers.push(callback);
    }

    _addCustomSuccessHandler(callback) {
        this._successHandlers.push(callback);
    }

    _addCustomFailHandler(callback) {
        this._failHandlers.push(callback);
    }

    _addCustomDoneHandler(callback) {
        this._doneHandlers.push(callback);
    }

    //private next methods
    _nextExecuteHandler(index) {
        //should be overridden
        return Promise.resolve();
    }

    _nextValidateHandler(index) {
        //should be overridden
        return Promise.resolve();
    }

    _nextSuccessHandler(index) {
        return utils.promise.result(this._executeSuccessHandler(this._successHandlers[index]))
        .then(() => ++index === this._successHandlers.length ? Promise.resolve() : this._nextSuccessHandler(index));
    }

    _nextFailHandler(index) {
        return utils.promise.result(this._executeFailHandler(this._failHandlers[index]))
        .then(() => ++index === this._failHandlers.length ? Promise.resolve() : this._nextFailHandler(index));
    }

    _nextSubmitHandler(index) {
        return utils.promise.result(this._executeSubmitHandler(this._submitHandlers[index]))
        .then(() => ++index === this._submitHandlers.length ? Promise.resolve() : this._nextSubmitHandler(index));
    }

    _nextDoneHandler(index) {
        return utils.promise.result(this._executeDoneHandler(this._doneHandlers[index]))
        .then(() => ++index === this._doneHandlers.length ? Promise.resolve() : this._nextDoneHandler(index));
    }

    //private execute methods
    _executeProcessHandler(handlers, state) {
        //should be overridden
    }

    _executeValidateHandler(handler, state) {
        //should be overridden
        return Promise.resolve();
    }

    _executeSuccessHandler(handler) {
        //should be overridden
        return Promise.resolve();
    }

    _executeFailHandler(handler) {
        //should be overridden
        return Promise.resolve();
    }

    _executeSubmitHandler(handler) {
        //should be overridden
        return Promise.resolve();
    }

    _executeDoneHandler(handler) {
        //should be overridden
        return Promise.resolve();
    }

    _getContext(name) {
        return this._context[name];
    }

    _setContext(name, value) {
        if (value === undefined) {
            delete this._context[name];
        } else {
            this._context[name] = value;
        }
    }

    //public methods
    name(name) {
        this._name = name;

        //chain
        return this;
    }

    label(label) {
        this._label = label;

        //chain
        return this;
    }

    context() {
        //get or set a context
        if (arguments.length >= 1 && typeof arguments[0] === 'object') {
            //set by object keys
            for(let key of Object.keys(arguments[0])) {
                this._setContext(key, arguments[0][key]);
            }

        } else if (arguments.length === 1) {
            //get by name
            return this._getContext(arguments[0]);

        } else if (arguments.length === 2) {
            //set by name/value
            this._setContext(arguments[0], arguments[1]);
        }

        //chain
        return this;
    }

    validate(callbacks, error) {
        if (utils.call.check.not.active(this._form, this._baseType+'.validate()')) {
            //validate callback, user must return a promise
            if (Array.isArray(callbacks)) {
                for(let callback of callbacks) {
                    this._addCustomValidateHandler(callback, error);
                }
            } else {
                this._addCustomValidateHandler(callbacks, error);
            }

            //chain
            return this;
        }
    }

    success(callbacks) {
        if (utils.call.check.not.active(this._form, this._baseType+'.success()')) {
            if (Array.isArray(callbacks)) {
                for(let callback of callbacks) {
                    this._addCustomSuccessHandler(callback);
                }
            } else {
                this._addCustomSuccessHandler(callbacks);
            }

            //chain
            return this;
        }
    }

    fail(callbacks) {
        if (utils.call.check.not.active(this._form, this._baseType+'.fail()')) {
            if (Array.isArray(callbacks)) {
                for(let callback of callbacks) {
                    this._addCustomFailHandler(callback);
                }
            } else {
                this._addCustomFailHandler(callbacks);
            }

            //chain
            return this;
        }
    }

    submit(callbacks) {
        if (utils.call.check.not.active(this._form, this._baseType+'.submit()')) {
            if (Array.isArray(callbacks)) {
                for(let callback of callbacks) {
                    this._addCustomSubmitHandler(callback);
                }
            } else {
                this._addCustomSubmitHandler(callbacks);
            }

            //chain
            return this;
        }
    }

    done(callbacks) {
        if (utils.call.check.not.active(this._form, this._baseType+'.done()')) {
            if (Array.isArray(callbacks)) {
                for(let callback of callbacks) {
                    this._addCustomDoneHandler(callback);
                }
            } else {
                this._addCustomDoneHandler(callbacks);
            }

            //chain
            return this;
        }
    }

    configure(info) {
        if (utils.call.check.not.active(this._form, this._baseType+'.configure()')) {
            if (info) {
                if (typeof info !== 'object' || Array.isArray(info)) {
                    throw new FormeError(`unsupported info format in ${this._baseType}.configure()`);
                } else {
                    //get the methods that are configurable, according to this class instance
                    const methods = this.constructor.configurableMethods;

                    //iterate over all of the methods in the info
                    for (let name of Object.keys(info)) {
                        //lookup matching method
                        const method = methods[name];
                        if (method) {
                            //call it!
                            method.call(this, info[name]);
                        }
                    }
                }
            }

            //chain
            return this;
        }
    }
}

module.exports = FormeBase;