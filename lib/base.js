'use strict';

//module imports
const format = require('string-template');

//local imports
const utils = require('./utils');
const FormeError = require('./errors').FormeError;
const ValidateHandler = require('./handlers/validateHandler');

const {
    FormeConfigurableMethod,
    FormeConfigurableMethodPointer,
    FormeConfigurableOverride,
    FormeConfigurableString,
    FormeConfigurableStringOrNull,
    FormeConfigurableObject,

    FormeConfigurableCallbacks,
    FormeConfigurableExportExecuteHandler,
    FormeConfigurableExportObject,
    FormeConfigurableExportString,
    FormeConfigurableExportStringOrNull,
    FormeConfigurableExportCallbacks
} = require('./configurable');

//locals
let configurableMethodClassCache = {};//caches configurable methods for all possible form objects as it is keyed by class constructor name. This will also work for extended forme objects.

//classes
class FormeBase {
    constructor(name) {
        //validate
        this._validatePropertyName(name);

        this._form = null;
        this._page = null;
        this._component = null;//not used by all extended classes
        this._name = name;
        this._label = this._name;
        this._group = null;//not used by all extended classes
        this._pipe = false;//where do errors pipe to!
        this._context = {};

        this._buildHandlers = [];//not used by all extended classes
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

    //static properties
    static get _cloneBlacklist() {
        return [];
    }

    //private properties
    get _outputName() {
        return this._name;
    }

    get _pathSegments() {
        const parent = this.parent;
        if (parent) {
            return parent._pathSegments.concat(this._ownPathSegments);
        } else {
            return this._ownPathSegments;
        }
    }

    get _containerPathSegments() {
        //get the path segments that this element is contained in
        const parent = this.parent;
        if (parent) {
            return parent._pathSegments.concat(this._ownGroupSegments);
        } else {
            return this._ownGroupSegments;
        }
    }

    get _ownGroupSegments() {
        const segments = [];
        if (this._group && this._group.length) {
            for(let group of this._group) {
                segments.push(group);
            }
        }
        return segments;
    }

    get _ownPathSegments() {
        const segments = this._ownGroupSegments;
        segments.push(this._outputName);
        return segments;
    }

    get _groupLength() {
        if (this._group === null) {
            return 0;
        } else {
            return this._group.length;
        }
    }

    //properties
    get formeClass() {
        return null;
    }

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

    //private build configuration methods
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

            //base.pipe(value)
            pipe: new FormeConfigurableMethod('pipe', [
                new FormeConfigurableOverride([
                    new FormeConfigurableStringOrNull('pipe', false, null),
                ], true),
            ], new FormeConfigurableExportStringOrNull('_pipe')),

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

    //private validate property methods
    _validatePropertyName(name) {
        if (name.startsWith('->')) {
            throw new Error(`${this.formeClass} name can't start with '->'`);
        }
    }

    //private clone methods
    _clone(lookup) {
        //todo: should we just convert this to use the base.configuration property instead?
        //create copy
        const clone = new this.constructor;

        //save in lookup (make sure it exists)
        lookup = lookup || new Map();
        lookup.set(this, clone);

        //iterate over properties (not included those blacklisted)
        const blacklist = this.constructor._cloneBlacklist;

        for(let key of Object.keys(this)) {
            if (blacklist.indexOf(key) === -1) {
                const property = this[key];

                //ignore functions
                if (typeof property !== 'function') {
                    clone[key] = this._cloneProperty(property, lookup);
                }
            }
        }

        //:D
        return clone;
    }

    _cloneProperty(property, lookup) {
        //default action, override to do special stuff!
        if (property === null || property === undefined) {
            //nothing
            return property;
        } else {
            //how many?
            if (Array.isArray(property)) {
                //multiple
                return property.map(item => this._cloneProperty(item, lookup));
            } else {
                //single
                return this._clonePropertyItem(property, lookup);
            }
        }
    }

    _clonePropertyItem(item, lookup) {
        if (item instanceof FormeBase) {
            //do we need to clone it, check the lookup
            const existing = lookup.get(item);
            if (!existing) {
                //doesn't exist in lookup so need to create it
                return item._clone(lookup);
            } else {
                //already cloned, so return the one from lookup
                return existing;
            }
        } else {
            //pointer
            return item;
        }
    }

    //private build methods
    _build() {
        if (this._buildHandlers.length === 0) {
            return Promise.resolve();
        } else {
            return this._nextBuildHandler(this._buildHandlers, 0);
        }
    }

    _buildChildren() {
        return Promise.resolve();
    }

    //private build values methods
    _buildValues(options, parent) {
        //options: secure, group, raw, store, special, ignore

        //chain out
        return parent;
    }

    _buildValueGroups(options, parent) {
        //build the group structure in parent and then return the pointer to that group...
        if (options.group) {
            //yup, but not all elements(objects) produce groups
            return utils.object.add.path(parent, this._ownGroupSegments);
        } else {
            //no grouping, so just add it to parent
            return parent;
        }
    }

    _buildValuesInclude(options) {
        //check its included before adding it!
        return false;
    }

    //private build template methods
    _buildTemplate(options, parent) {
        //make sure we have options
        options = options || {};

        //only build included nodes!
        if (this._buildTemplateInclude(options)) {
            //we dont need a parent object as each function below will make sure there is one before manipulating it.

            //build groups structure and update the parent pointer! (+chain parent)
            return this._buildTemplateGroups(options, parent)

            //setup the structure and update the parent pointer (+chain parent)
            .then(parent => this._buildTemplateStructure(options, parent))

            //iterate children (+chain parent)
            .then(parent => this._buildTemplateChildren(options, parent))

            //finalise (+chain parent)
            .then(parent => this._buildTemplateFinalise(options, parent));
        }

        //nothing so just chain back the parent if it was passed in!
        return Promise.resolve(parent);
    }

    _buildTemplateInclude(options) {
        //check its included before adding it!
        return true;
    }

    _buildTemplateGroups(options, parent) {
        //build the group structure in parent and then return the pointer to that group...
        return new Promise((resolve, reject) => {
            if (options.group) {
                //make sure we have a structure to build into
                parent = parent || {};

                //ads teh group path to the structure (not to be confused with adding an element)
                const segments = this._ownGroupSegments;

                if (segments && segments.length) {
                    for (let index = 0; index < segments.length; index++) {
                        const segment = segments[index];

                        //check if segment exists and if it can contain children? (if not then we overwrite it)
                        let child = parent.children[segment];
                        if (!child) {
                            child = parent.children[segment] = this._form._createGroup();
                        }

                        //update parent pointer
                        parent = child;
                    }
                }

            }

            //chain the parent
            return resolve(parent);
        });
    }

    _buildTemplateStructure(options, parent) {
        return new Promise((resolve, reject) => {
            //create vars for self
            const vars = this._buildTemplateVars(options);

            //insert into parent
            parent.children[this._outputName] = vars;

            //chain the vars back as this is now the parent!
            return resolve(vars);
        });
    }

    _buildTemplateVars(options) {
        //should return the vars to be added
        return {
            __formeClass: this.formeClass,
            name: this._name,
            label: this._label,
            context: this._context,
        };
    }

    _buildTemplateChildren(options, parent) {
        //default no children
        return Promise.resolve(parent);
    }

    _buildTemplateFinalise(options, parent) {
        return Promise.resolve(parent);
    }

    //private process methods
    _processExecuteHandler(handler) {
        //build state info (let the extended container dictate what info is returned).

        //create two copies of state so we can track changes after execution!
        const newState = this._createExecutionState();
        const oldState = this._createExecutionState();

        //execute the handler with the state using the handlers execute() method. This differs to other handlers such as done() or fail(). These others are actually just callback functions
        return handler.execute(this, newState)

        //process any state changes
        .then(() => this._processExecutionStateChanges(oldState, newState))

        //uh oh!
        .catch(err => {
            //errors received here are actually validation errors which need adding to the form!
            //extract error string from catch (if an error was provided)
            let error = (err?err.message:null) || '';

            //does teh handler have an error?
            if (handler.error !== null) {
                error = handler.error;
            }

            //so do we actually have an error?
            if (error && error.length > 0) {
                //format the error
                error = format(error, {
                    name: this._name,
                    label: this._label,
                });

                //add error to container
                this._form.error(error);
            }

            //cancel iteration
            return Promise.reject(new Error(''));
        });
    }

    _processExecutionStateChanges(oldState, newState) {
        //should be overridden
    }

    //private execute methods
    _execute() {
        //children first
        return this._executeChildren()
        .then(() => this._executeSelf());
    }

    _executeSelf() {
        //includes process and validation handlers!
        return this._executeHandlers.length === 0?Promise.resolve():this._nextExecuteHandler(this._executeHandlers, 0)

        //capture _valid() or _invalid() based on if promise rejected!
        .then(() => this._valid())

        //invalid :(
        .catch(err => {
            //unhandled error
            this._form._catchError(err);

            //call _invalid
            return this._invalid();
        });
    }

    _executeChildren() {
        return Promise.resolve();
    }

    //private invalid methods
    _invalid() {
        return this._invalidSelf()
        .then(() => this._invalidChildren());
    }

    _invalidSelf() {
        if (this._invalidHandlers.length === 0) {
            return Promise.resolve();
        } else {
            return this._nextInvalidHandler(this._invalidHandlers, 0);
        }
    }

    _invalidChildren() {
        return Promise.resolve();
    }

    //private valid methods
    _valid() {
        return this._validSelf()
        .then(() => this._validChildren());
    }

    _validSelf() {
        if (this._validHandlers.length === 0) {
            return Promise.resolve();
        } else {
            return this._nextValidHandler(this._validHandlers, 0);
        }
    }

    _validChildren() {
        return Promise.resolve();
    }

    //private success methods
    _success() {
        return this._successSelf()
        .then(() => this._successChildren());
    }

    _successSelf() {
        if (this._successHandlers.length === 0) {
            return Promise.resolve();
        } else {
            return this._nextSuccessHandler(this._successHandlers, 0);
        }
    }

    _successChildren() {
        return Promise.resolve();
    }

    //private fail methods
    _fail() {
        return this._failSelf()
        .then(() => this._failChildren());
    }

    _failSelf() {
        if (this._failHandlers.length === 0) {
            return Promise.resolve();
        } else {
            return this._nextFailHandler(this._failHandlers, 0);
        }
    }

    _failChildren() {
        return Promise.resolve();
    }

    //private submit methods
    _submit() {
        //children first
        return this._submitChildren()
        .then(() => this._submitSelf());
    }

    _submitSelf() {
        if (this._submitHandlers.length === 0) {
            return Promise.resolve();
        } else {
            return this._nextSubmitHandler(this._submitHandlers, 0);
        }
    }

    _submitChildren() {
        return Promise.resolve();
    }

    //private done methods
    _done() {
        //children first
        return this._doneChildren()
        .then(() => this._doneSelf());
    }

    _doneSelf() {
        if (this._doneHandlers.length === 0) {
            return Promise.resolve();
        } else {
            return this._nextDoneHandler(this._doneHandlers, 0);
        }
    }

    _doneChildren() {
        return Promise.resolve();
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

    _findDescendant(path, index) {
        //by default a "base" element cant recurse so it insta-fails! (containers should override this)
        return null;
    }

    //private remove methods
    _removeValidateHandler(type) {
        this._validateHandlers = this._validateHandlers.filter(handler => handler.constructor !== type);
    }

    //private add methods
    _addBuildHandler(callback) {
        this._buildHandlers.push(callback);
    }

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

    //private next handler methods
    _nextBuildHandler(handlers, index=0) {
        return utils.promise.result(this._executeBuildHandler(handlers[index]))
        .then(() => ++index === handlers.length ? Promise.resolve() : this._nextBuildHandler(handlers, index));
    }

    _nextExecuteHandler(handlers, index=0) {
        return utils.promise.result(this._processExecuteHandler(handlers[index]))
        .then(() => ++index === handlers.length ? Promise.resolve() : this._nextExecuteHandler(handlers, index));
    }

    _nextInvalidHandler(handlers, index=0) {
        return utils.promise.result(this._executeInvalidHandler(handlers[index]))
        .then(() => ++index === handlers.length ? Promise.resolve() : this._nextInvalidHandler(handlers, index));
    }

    _nextValidHandler(handlers, index=0) {
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

    //private execute handler methods
    _executeBuildHandler(handler) {
        //should be overridden
        return Promise.resolve();
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

    //private pipe methods
    _pipeError(error) {
        //pipe the error to the correct place, by default no piping happens (goes direct to the request)!
        if (this._pipe === null) {
            //pipe to self!
            this._form._request._addError(this._name, error);
        } else {
            //handle special pipe tokens
            switch(this._pipe) {
                case '->form':
                    if (this instanceof this._form._driverClass.formClass) {
                        //this is form, so add to request
                        this._form._request._addError(null, error);
                    } else {
                        //pipe it to the form
                        this._form._pipeError(error);
                    }
                    break;

                case '->page':
                    if (this._form._request._page) {
                        //pipe to page
                        if (this instanceof this._form._driverClass.pageClass) {
                            //this is page so pipe to form
                            this._form._pipeError(error);
                        } else {
                            //pipe it to page
                            this._form._request._page._pipeError(error);
                        }
                    } else {
                        //lost
                        this._form._pipeLostError(error);
                    }
                    break;

                case '->container':
                    const container = this.container;
                    if (container) {
                        //pipe to container
                        container._pipeError(error);
                    } else {
                        //lost
                        this._form._pipeLostError(error);
                    }
                    break;

                case '->parent':
                    const parent = this.container;
                    if (parent) {
                        //pipe to parent
                        parent._pipeError(error);
                    } else {
                        //lost
                        this._form._pipeLostError(error);
                    }
                    break;

                default:
                    //pipe to element path
                    const element = this._form._findDescendant(this._pipe);
                    if (element) {
                        //pipe to found element
                        element._pipeError(error);
                    } else {
                        //lost
                        this._form._pipeLostError(error);
                    }
            }
        }
    }

    //private create methods
    _createExecutionState() {
        return {};
    }

    //private get methods
    _getContext(name) {
        return this._context[name];
    }

    _getValueRouter(path) {

    }

    //private set methods
    _setContext(name, value) {
        if (value === undefined) {
            delete this._context[name];
        } else {
            this._context[name] = value;
        }
    }

    //public helpers
    callingConfigureMethod(method) {
        return utils.call.check.not.active(this._form, `${this.formeClass}.${method}()`);
    }

    callingOperationMethod(method) {
        return utils.call.check.not.active(this._form, `${this.formeClass}.${method}()`);
    }

    callingInactiveMethod(method) {
        return utils.call.check.inactive(this._form, `${this.formeClass}.${method}()`);
    }

    callingActiveMethod(method) {
        return utils.call.check.active(this._form, `${this.formeClass}.${method}()`);
    }

    callingUnsupportedMethod(method) {
        return utils.call.unsupported(`${this.formeClass}.${method}()`);
    }

    callingInvalidMethod(method) {
        return utils.call.invalid(`${this.formeClass}.${method}()`);
    }

    //configuration
    name(name) {
        if (this.callingConfigureMethod('name')) {
            //validate
            this._validatePropertyName(name);

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

    pipe(path) {
        if (this.callingConfigureMethod('pipe')) {
            //pipe input stuff to target
            this._pipe = path || null;

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
                    throw this._createError(`unsupported forme info format in ${this.formeClass}.configure()`);
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

    //templating methods
    templateVars() {
        if (this.callingActiveMethod('templateVars')) {
            return this._buildTemplate({
                group: true,
            });
        }
    }

    //state methods
    path() {
        return this._pathSegments.join('.');
    }

    error(error) {
        if (this.callingActiveMethod('error')) {
            if (arguments.length === 1) {
                //self error
                this._pipeError(error);
            } else {
                //invalid call
                this.callingInvalidMethod('error');
            }
        }
    }
}

//expose
module.exports = FormeBase;