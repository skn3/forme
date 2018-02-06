'use strict';

//local imports
const utils = require('./utils');
const FormeError= require('./errors').FormeError;

const {
    FormeConfigurableMethod,
    FormeConfigurableMethodPointer,
    FormeConfigurableOverride,
    FormeConfigurableString,
    FormeConfigurableObject,

    FormeConfigurableCallbacks,
    FormeConfigurableExportExecuteHandler,
    FormeConfigurableExportObject,
    FormeConfigurableExportString,
    FormeConfigurableExportCallbacks
} = require('./configurable');

//locals
let configurableMethodClassCache = {};//caches configurable methods for all possible form objects as it is keyed by class constructor name. This will also work for extended forme objects.

//classes
class FormeBase {
    constructor(type, form, page, name) {
        this._baseType = type || 'FormeBase';

        this._form = form;
        this._page = page;
        this._name = name;
        this._label = this._name;
        this._context = {};

        this._processHandlers = [];
        this._validateHandlers = [];
        this._invalidHandlers = [];
        this._validHandlers = [];
        this._executeHandlers = [];
        this._successHandlers = [];
        this._failHandlers = [];
        this._submitHandlers = [];
        this._doneHandlers = [];

        this._executeHandlerOrder = 0;
    }

    //properties
    get configurableMethods() {
        //get the cache for this specific class
        let cache = configurableMethodClassCache[this.constructor.name];

        //check if cache, otherwise create a new cache!
        if (cache === undefined) {
            //need to build!
            configurableMethodClassCache[this.constructor.name] = cache = this._buildConfigurableMethods();

            //resolve pointers and update the cache
            for(let name of Object.keys(cache)) {
                let method = cache[name];

                //only bother doing it if its actually a pointer
                if (method instanceof FormeConfigurableMethodPointer) {
                    //keep going until the method is no longer a pointer
                    while (method && method instanceof FormeConfigurableMethodPointer) {
                        method = cache[method.pointer];
                    }

                    //update the cache
                    cache[name] = method;
                }
            }
        }

        //return cache
        return cache;
    }

    get configuration() {
        return this._buildConfiguration(this.configurableMethods);
    }

    get form() {
        return this._form;
    }

    get parent() {
        return this._page || this._form;
    }

    get container() {
        return this._page || this._form;
    }

    //private configuration methods
    _buildConfigurableMethods() {
        return {
            //base.name(string)
            name: new FormeConfigurableMethod('name', [
                new FormeConfigurableOverride([
                    new FormeConfigurableString('name', true),
                ], true),
            ], new FormeConfigurableExportString('_name')),

            //base.label(string)
            label: new FormeConfigurableMethod('label', [
                new FormeConfigurableOverride([
                    new FormeConfigurableString('label', false),
                ], true),
            ], new FormeConfigurableExportString('_label')),

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
            ], new FormeConfigurableExportObject('_context')),

            //base.validate(callback(s)) (needs to be defined in extending objects as export is different)

            //base.valid(callback(s))
            valid: new FormeConfigurableMethod('valid', [
                new FormeConfigurableOverride([
                    new FormeConfigurableCallbacks(['callback', 'callbacks'], true),
                ], true),
            ], new FormeConfigurableExportCallbacks('_validHandlers')),

            //base.invalid(callback(s))
            invalid: new FormeConfigurableMethod('invalid', [
                new FormeConfigurableOverride([
                    new FormeConfigurableCallbacks(['callback', 'callbacks'], true),
                ], true),
            ], new FormeConfigurableExportCallbacks('_invalidHandlers')),

            //base.success(callback(s))
            success: new FormeConfigurableMethod('success', [
                new FormeConfigurableOverride([
                    new FormeConfigurableCallbacks(['callback', 'callbacks'], true),
                ], true),
            ], new FormeConfigurableExportCallbacks('_successHandlers')),

            //base.fail(callback(s))
            fail: new FormeConfigurableMethod('fail', [
                new FormeConfigurableOverride([
                    new FormeConfigurableCallbacks(['callback', 'callbacks'], true),
                ], true),
            ], new FormeConfigurableExportCallbacks('_failHandlers')),

            //base.submit(callback(s))
            submit: new FormeConfigurableMethod('submit', [
                new FormeConfigurableOverride([
                    new FormeConfigurableCallbacks(['callback', 'callbacks'], true),
                ], true),
            ], new FormeConfigurableExportCallbacks('_submitHandlers')),

            //base.done(callback(s))
            done: new FormeConfigurableMethod('done', [
                new FormeConfigurableOverride([
                    new FormeConfigurableCallbacks(['callback', 'callbacks'], true),
                ], true),
            ], new FormeConfigurableExportCallbacks('_doneHandlers')),
        };
    }

    _buildConfiguration(methods) {
        //split the methods into ordered and unordered
        const orderedMethods = [];
        const unorderedMethods = [];

        for(let name of Object.keys(methods)) {
            const method = methods[name];

            if (method.exports) {
                if (method.exporter instanceof FormeConfigurableExportExecuteHandler) {
                    //add to unordered
                    orderedMethods.push({
                        name: name,
                        method: method,
                    });
                } else {
                    //add to ordered
                    unorderedMethods.push({
                        name: name,
                        method: method,
                    });
                }
            }
        }

        //start building configuration
        const configuration = {};

        //build ordered calls. This is different in that we must get the execution handlers and then add a method call for each!
        if (orderedMethods.length) {
            //build a complete list of all handlers for all methods belonging to *this*. After we will order them...
            const list = [];

            for(let info of orderedMethods) {
                //get all handlers from *this* that match the factory that was used to define the configuration methods exporter
                const exporterHandlers = this._findExecuteHandlers(info.method.exporter.factory)
                for(let handler of exporterHandlers) {
                    list.push({
                        name: info.name,
                        method: info.method,
                        order: handler._order,
                    });
                }
            }

            //so now we have a list of all handlers but as we fetched them in chunks of *method* at a time, the order may be incorrect
            list.sort((a, b) => a.order - b.order);

            //now lets do exports for each handler!
            const orderedCalls = [];
            for(let info of list) {
                //simply dump the result of export into the key! (if not undefined)
                const value = info.method.export(this);
                if (value !== undefined) {
                    orderedCalls.push({ method: info.name, params: value });
                }
            }

            //only add it if there was something to add!
            if (orderedCalls.length) {
                configuration.ordered = orderedCalls;
            }
        }

        //iterate over unordered methods that export
        for(let info of unorderedMethods) {
            //simply dump the result of export into the key! (if not undefined)
            const value = info.method.export(this);
            if (value !== undefined) {
                configuration[info.name] = value;
            }
        }

        //done :D
        return configuration;
    }

    //private methods
    _clone(form, page) {
        //todo: should we just convert this to use the base.configuration property instead?
        //create copy
        const clone = new this.constructor;

        //handle form either referencing self, or apply the passed in form
        if (clone instanceof this._form._driverClass.formClass) {
            //reference self
            clone._form = form = clone;
        } else {
            //copy reference as we assume it points to a valid form!
            clone._form = form;
        }

        //handle page either referencing self, or apply the passed in page
        if (clone instanceof this._form._driverClass.pageClass) {
            //reference self
            clone._page = page = clone;
        } else {
            //copy reference as we assume it points to a valid page!
            clone._page = page;
        }

        //iterate over properties
        for(let key of Object.keys(this)) {
            const property = this[key];

            //ignore functions, _form and _page properties!
            if (typeof property !== 'function' && key !== '_form' && key !== '_page') {
                if (property === null) {
                    clone[key] = null;
                } else {
                    if (Array.isArray(property)) {
                        //array of properties
                        clone[key] = property.map(item => item instanceof FormeBase ? item._clone(form, page) : item);
                    } else {
                        clone[key] = property;
                    }
                }
            }
        }

        //:D
        return clone;
    }

    _execute() {
        if (this._executeHandlers.length === 0) {
            return Promise.resolve();
        } else {
            return this._nextExecuteHandler(this._executeHandlers, 0);
        }
    }

    _validate() {
        if (this._validateHandlers.length === 0) {
            return Promise.resolve();
        } else {
            return this._nextValidateHandler(this._validateHandlers, 0);
        }
    }

    _invalid() {
        if (this._invalidHandlers.length === 0) {
            return Promise.resolve();
        } else {
            return this._nextInvalidHandler(this._invalidHandlers, 0);
        }
    }

    _valid() {
        if (this._validHandlers.length === 0) {
            return Promise.resolve();
        } else {
            return this._nextValidHandler(this._validHandlers, 0);
        }
    }

    _success() {
        if (this._successHandlers.length === 0) {
            return Promise.resolve();
        } else {
            return this._nextSuccessHandler(this._successHandlers, 0);
        }
    }

    _fail() {
        if (this._failHandlers.length === 0) {
            return Promise.resolve();
        } else {
            return this._nextFailHandler(this._failHandlers, 0);
        }
    }

    _submit() {
        if (this._submitHandlers.length === 0) {
            return Promise.resolve();
        } else {
            return this._nextSubmitHandler(this._submitHandlers, 0);
        }
    }

    _done() {
        if (this._doneHandlers.length === 0) {
            return Promise.resolve();
        } else {
            return this._nextDoneHandler(this._doneHandlers, 0);
        }
    }

    //private create methods
    _createError(message) {
        return new FormeError(message);
    }

    //private find methods
    _findExecuteHandlers(type) {
        return this._executeHandlers.filter(handler => handler.constructor === type);
    }

    _findValidateHandlers(type) {
        return this._validateHandlers.filter(handler => handler.constructor === type);
    }

    _findProcessHandlers(type) {
        return this._processHandlers.filter(handler => handler.constructor === type);
    }

    //private remove methods
    _removeValidateHandler(type) {
        this._validateHandlers = this._validateHandlers.filter(handler => handler.constructor !== type);
    }

    //private add methods
    _addProcessHandler(handler) {
        handler._order = this._executeHandlerOrder++;
        this._executeHandlers.push(handler);
        this._processHandlers.push(handler);
    }

    _addValidateHandler(handler) {
        handler._order = this._executeHandlerOrder++;
        this._executeHandlers.push(handler);
        this._validateHandlers.push(handler);
    }

    _addCustomValidateHandler(callback, error) {
        //should be overridden
    }

    _addCustomInvalidHandler(callback) {
        this._invalidHandlers.push(callback);
    }

    _addCustomValidHandler(callback) {
        this._validHandlers.push(callback);
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
    _nextExecuteHandler(handlers, index=0) {
        //should be overridden
        return Promise.resolve();
    }

    _nextValidateHandler(handlers, index=0) {
        //should be overridden
        return Promise.resolve();
    }

    _nextInvalidHandler(handlers, index) {
        return utils.promise.result(this._executeInvalidHandler(handlers[index]))
        .then(() => ++index === handlers.length ? Promise.resolve() : this._nextInvalidHandler(handlers, index));
    }

    _nextValidHandler(handlers,index) {
        return utils.promise.result(this._executeValidHandler(handlers[index]))
        .then(() => ++index === handlers.length ? Promise.resolve() : this._nextValidHandler(handlers, index));
    }

    _nextSuccessHandler(handlers, index=0) {
        return utils.promise.result(this._executeSuccessHandler(handlers[index]))
        .then(() => ++index === handlers.length ? Promise.resolve() : this._nextSuccessHandler(handlers, index));
    }

    _nextFailHandler(handlers, index=0) {
        return utils.promise.result(this._executeFailHandler(handlers[index]))
        .then(() => ++index === handlers.length ? Promise.resolve() : this._nextFailHandler(handlers, index));
    }

    _nextSubmitHandler(handlers, index=0) {
        return utils.promise.result(this._executeSubmitHandler(handlers[index]))
        .then(() => ++index === handlers.length ? Promise.resolve() : this._nextSubmitHandler(handlers, index));
    }

    _nextDoneHandler(handlers, index=0) {
        return utils.promise.result(this._executeDoneHandler(handlers[index]))
        .then(() => ++index === handlers.length ? Promise.resolve() : this._nextDoneHandler(handlers, index));
    }

    //private execute methods
    _executeProcessHandler(handlers, state) {
        //should be overridden
    }

    _executeValidateHandler(handler, state) {
        //should be overridden
        return Promise.resolve();
    }

    _executeInvalidHandler(handler) {
        //should be overridden
        return Promise.resolve();
    }

    _executeValidHandler(handler) {
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

    //public helpers
    callingConfigureMethod(method) {
        return utils.call.check.not.active(this._form, `${this._baseType}.${method}()`);
    }

    callingOperationMethod(method) {
        return utils.call.check.not.active(this._form, `${this._baseType}.${method}()`);
    }

    callingInactiveMethod(method) {
        return utils.call.check.inactive(this._form, `${this._baseType}.${method}()`);
    }

    callingActiveMethod(method) {
        return utils.call.check.active(this._form, `${this._baseType}.${method}()`);
    }

    callingUnsupportedMethod(method) {
        return utils.call.unsupported(`${this._baseType}.${method}()`);
    }

    callingInvalidMethod(method) {
        return utils.call.invalid(`${this._baseType}.${method}()`);
    }

    //configuration
    name(name) {
        if (this.callingConfigureMethod('name')) {
            this._name = name;

            //chain
            return this;
        }
    }

    label(label) {
        if (this.callingConfigureMethod('label')) {
            this._label = label;

            //chain
            return this;
        }
    }

    context() {
        if (arguments.length >= 1 && typeof arguments[0] === 'object') {
            //set by object keys
            for (let key of Object.keys(arguments[0])) {
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

    configure(info) {
        if (this.callingConfigureMethod('configure')) {
            if (info) {
                if (typeof info !== 'object' || Array.isArray(info)) {
                    throw this._createError(`unsupported forme info format in ${this._baseType}.configure()`);
                } else {
                    //get the methods that are configurable, according to this class instance
                    const methods = this.configurableMethods;

                    //get ordered calls, defined as: info = {ordered:[{method:'foo', param(s): {}},...]}
                    const ordered = info.ordered;
                    if (ordered !== undefined && Array.isArray(ordered) && ordered.length) {
                        for(let info of ordered) {
                            if (!info.method) {
                                throw this._createError(`invalid forme ordered configure method '${info.method}'`);
                            }

                            //dont fail on undefined method, as we may have extra data in teh configure object
                            const method = methods[info.method];
                            if (method !== undefined) {
                                method.call(this, info.param || info.params || undefined);
                            }
                        }
                    }

                    //iterate over all of the methods in the info that are not stored in "ordered".
                    for (let name of Object.keys(info)) {
                        //dont fail on undefined method, as we may have extra data in teh configure object
                        if (name !== 'ordered') {
                            const method = methods[name];
                            if (method !== undefined) {
                                method.call(this, info[name]);
                            }
                        }
                    }
                }
            }

            //chain
            return this;
        }
    }

    //callbacks
    validate(callbacks, error) {
        if (this.callingConfigureMethod('validate')) {
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

    invalid(callbacks) {
        if (this.callingConfigureMethod('invalid')) {
            if (Array.isArray(callbacks)) {
                for(let callback of callbacks) {
                    this._addCustomInvalidHandler(callback);
                }
            } else {
                this._addCustomInvalidHandler(callbacks);
            }

            //chain
            return this;
        }
    }

    valid(callbacks) {
        if (this.callingConfigureMethod('valid')) {
            if (Array.isArray(callbacks)) {
                for(let callback of callbacks) {
                    this._addCustomValidHandler(callback);
                }
            } else {
                this._addCustomValidHandler(callbacks);
            }

            //chain
            return this;
        }
    }

    success(callbacks) {
        if (this.callingConfigureMethod('success')) {
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
        if (this.callingConfigureMethod('fail')) {
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
        if (this.callingConfigureMethod('submit')) {
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
        if (this.callingConfigureMethod('done')) {
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
}

//expose
module.exports = FormeBase;