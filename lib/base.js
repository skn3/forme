'use strict';

//local imports
const utils = require('./utils');

class FormeBase {
    constructor(type, form, name) {
        this._baseType = type || 'FormeBase';
        
        this._form = form;
        this._name = name;
        this._label = this._name;
        this._context = {};

        this._validateHandlers = [];
        this._successHandlers = [];
        this._failHandlers = [];
        this._submitHandlers = [];
    }

    //private methods
    _clone(override) {
        //by ref
        return this;
    }

    _validate() {
        if (this._validateHandlers.length == 0) {
            return Promise.resolve();
        } else {
            return this._nextValidateHandler(0);
        }
    }

    _success() {
        if (this._successHandlers.length == 0) {
            return Promise.resolve();
        } else {
            return this._nextSuccessHandler(0);
        }
    }

    _fail() {
        if (this._failHandlers.length == 0) {
            return Promise.resolve();
        } else {
            return this._nextFailHandler(0);
        }
    }

    _submit() {
        if (this._submitHandlers.length == 0) {
            return Promise.resolve();
        } else {
            return this._nextSubmitHandler(0);
        }
    }

    //private add methods
    _addValidateHandler(callback, error) {
        //should be overriden
    }

    _addSubmitHandler(callback) {
        this._submitHandlers.push(callback);
    }

    _addSuccessHandler(callback) {
        this._successHandlers.push(callback);
    }

    _addFailHandler(callback) {
        this._failHandlers.push(callback);
    }

    //private next methods
    _nextValidateHandler(index) {
        //should be overridden
        return Promise.resolve();
    }

    _nextSuccessHandler(index) {
        return utils.promise.result(this._executeSuccessHandler(this._successHandlers[index]))
        .then(() => ++index == this._successHandlers.length ? Promise.resolve() : this._nextSuccessHandler(index));
    }

    _nextFailHandler(index) {
        return utils.promise.result(this._executeFailHandler(this._failHandlers[index]))
        .then(() => ++index == this._failHandlers.length ? Promise.resolve() : this._nextFailHandler(index));
    }

    _nextSubmitHandler(index) {
        return utils.promise.result(this._executeSubmitHandler(this._submitHandlers[index]))
        .then(() => ++index == this._submitHandlers.length ? Promise.resolve() : this._nextSubmitHandler(index));
    }

    //private execute methods
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

    validate(callback, error) {
        if (utils.call.check.not.active(this._form, 'input.validate()')) {
            //validate callback, user must return a promise

            //add handler
            this._addValidateHandler(callback, error);

            //chain
            return this;
        }
    }

    success(callback) {
        if (utils.call.check.not.active(this._form, this._baseType+'.success()')) {
            this._addSuccessHandler(callback);

            //chain
            return this;
        }
    }

    fail(callback) {
        if (utils.call.check.not.active(this._form, this._baseType+'.fail()')) {
            this._addFailHandler(callback);

            //chain
            return this;
        }
    }

    submit(callback) {
        if (utils.call.check.not.active(this._form, this._baseType+'.store()')) {
            this._addSubmitHandler(callback);

            //chain
            return this;
        }
    }
    
    context() {
        //get or set a context
        if (arguments.length == 1) {
            //get
            if (this._context[arguments[0]] !== undefined) {
                return this._context[arguments[0]];
            } else {
                return undefined;
            }
        } else if (arguments.length == 2) {
            //set
            if (arguments[1] === undefined) {
                delete this._context[arguments[0]];
            } else {
                this._context[arguments[0]] = arguments[1];
            }

            //chain
            return this;
        }
    }
}

module.exports = FormeBase;