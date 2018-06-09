'use strict';

//module imports
const format = require('string-template');

//local imports
const constants = require('./constants');
const utils = require('./utils');
const FormeError = require('./errors').FormeError;

const ProcessHandlerEmptyValue = require('./handlers/process/processHandlerEmptyValue');
const ProcessHandlerConvertBool = require('./handlers/process/processHandlerConvertBool');
const ProcessHandlerConvertInt = require('./handlers/process/processHandlerConvertInt');
const ProcessHandlerConvertFloat = require('./handlers/process/processHandlerConvertFloat');
const ProcessHandlerConvertString = require('./handlers/process/processHandlerConvertString');
const ProcessHandlerConvertJson = require('./handlers/process/processHandlerConvertJson');

const {
    methodPriority,

    FormeConfigurableParam,
    FormeConfigurableMethod,
    FormeConfigurableMethodPointer,
    FormeConfigurableOverride,
    FormeConfigurableBool,
    FormeConfigurableString,
    FormeConfigurableStringOrNull,
    FormeConfigurableStrings,
    FormeConfigurableObject,

    FormeConfigurableCallbacks,
    FormeConfigurableExportExecuteHandler,
    FormeConfigurableExportObject,
    FormeConfigurableExportBool,
    FormeConfigurableExportString,
    FormeConfigurableExportStringOrNull,
    FormeConfigurableExportArrayStrings,
    FormeConfigurableExportCallbacks,
    FormeConfigurableExportTriggers,
    FormeConfigurableExportArrayObjectsAssign,
    FormeConfigurableExportProcessHandler,
} = require('./configurable');

//locals
const configurableMethodClassCache = {};//caches configurable methods for all possible form objects as it is keyed by class constructor name. This will also work for extended forme objects.
const handlerPropertyKeyCache = {};//cached handler property key lists

//classes
class FormeBase {
    constructor(name) {
        //validate
        this._validatePropertyName(name);

        this._parent = null;
        this._form = null;
        this._page = null;
        this._component = null;//not used by all extended classes

        this._name = name;
        this._label = null;
        this._customErrorLabel = null;
        this._classNames = [];
        this._data = [];//not used by all elements
        this._group = null;//not used by all extended classes
        this._alias = null;//not used by all extended classes
        this._pipe = null;//where do errors pipe to!
        this._template = null;//not used by all extended classes
        this._context = {};

        this._hideLabel = false;
        this._hideDescendantLabels = false;

        this._alwaysInvalid = false;//allow this element to always fail validation!

        this._insideGetter = false;//is this element currently inside a getter handler!
        this._insideSetter = false;//is this element currently inside a setter handler!

        this._triggers = [];//not used by all extended classes

        this._buildHandlers = [];//not used by all extended classes
        this._processHandlers = [];
        this._validateHandlers = [];
        this._readHandlers = [];
        this._outputHandlers = [];
        this._invalidHandlers = [];
        this._validHandlers = [];
        this._executeHandlers = [];
        this._successHandlers = [];
        this._failHandlers = [];
        this._beforeHandlers = [];
        this._submitHandlers = [];
        this._afterHandlers = [];
        this._actionHandlers = [];
        this._doneHandlers = [];
        this._getterHandlers = [];
        this._setterHandlers = [];
        this._emptyHandlers = [];

        this._executeHandlerIndex = 0;
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

            //base.errorLabel(string)
            errorLabel: new FormeConfigurableMethod('errorLabel', [
                new FormeConfigurableOverride([
                    new FormeConfigurableString('label', false),
                ], true),
            ], new FormeConfigurableExportString('_customErrorLabel')),

            //base.icon(string)
            icon: new FormeConfigurableMethod('icon', [
                new FormeConfigurableOverride([
                    new FormeConfigurableString('icon', false),
                ], true),
            ], new FormeConfigurableExportString('_icon')),

            //base.className(string)
            className: new FormeConfigurableMethod('className', [
                new FormeConfigurableOverride([
                    new FormeConfigurableStrings(['className', 'classNames', 'class', 'classes'], false),
                ], true),
            ], new FormeConfigurableExportArrayStrings('_classNames')),

            //base.template(*multiple*)
            template: new FormeConfigurableMethod('template', [
                //base.template(template, client)
                new FormeConfigurableOverride([
                    new FormeConfigurableString(['template', 'path', 'name'], true),
                    new FormeConfigurableBool('client', true, false),
                ], false),

                //base.template(template)
                new FormeConfigurableOverride([
                    new FormeConfigurableString(['template', 'path', 'name'], false),
                ], true),
            ], new FormeConfigurableExportString('_template')),

            //base.data(*multiple*)
            data: new FormeConfigurableMethod('data', [
                //input.data(key, value)
                new FormeConfigurableOverride([
                    new FormeConfigurableString(['name', 'key', 'id'], true),
                    new FormeConfigurableParam('value', false),
                ], false),

                //input.data(object)
                new FormeConfigurableOverride([
                    new FormeConfigurableObject(['data', 'value'], true),
                ], true),
            ], new FormeConfigurableExportArrayObjectsAssign('_data')),

            //base.group(string(s), append)
            group: new FormeConfigurableMethod('group', [
                new FormeConfigurableOverride([
                    new FormeConfigurableStrings(['group', 'groups'], true),
                    new FormeConfigurableBool('append', false, true),
                ], true),
            ], new FormeConfigurableExportArrayStrings('_group')),
            groups: new FormeConfigurableMethodPointer('group'),

            //base.alias(string)
            alias: new FormeConfigurableMethod('alias', [
                new FormeConfigurableOverride([
                    new FormeConfigurableString('alias', false),
                ], true),
            ], new FormeConfigurableExportString('_alias')),

            //base.pipe(value)
            pipe: new FormeConfigurableMethod('pipe', [
                new FormeConfigurableOverride([
                    new FormeConfigurableStringOrNull('pipe', false, null),
                ], true),
            ], new FormeConfigurableExportStringOrNull('_pipe')),

            //base.context(*multiple*) (calls element.setContext())
            context: new FormeConfigurableMethod('setContext', [
                //base.setContext(name, value, bool)
                new FormeConfigurableOverride([
                    new FormeConfigurableString('name', true),
                    new FormeConfigurableString('value', true),
                    new FormeConfigurableBool(['expose', 'exposed'], false, false),
                ], false),

                //base.setContext(object, exposed)
                new FormeConfigurableOverride([
                    new FormeConfigurableObject('context', true),
                    new FormeConfigurableBool(['expose', 'exposed'], false, false),
                ], true),
            ], new FormeConfigurableExportObject('_context')),

            //base.alwaysInvalid(bool)
            alwaysInvalid: new FormeConfigurableMethod('alwaysInvalid', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool('alwaysInvalid', false, true),
                ], true),
            ], new FormeConfigurableExportBool('_alwaysInvalid')),

            //base.hideLabel(bool)
            hideLabel: new FormeConfigurableMethod('hideLabel', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool('hideLabel', false),
                ], true),
            ], new FormeConfigurableExportBool('_hideLabel')),

            //base.hideDescendantLabels(bool)
            hideDescendantLabels: new FormeConfigurableMethod('hideDescendantLabels', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool('hideDescendantLabels', false),
                ], true),
            ], new FormeConfigurableExportBool('_hideDescendantLabels')),

            //base.emptyValue(value)
            emptyValue: new FormeConfigurableMethod('emptyValue', [
                new FormeConfigurableOverride([
                    new FormeConfigurableParam('value', false),
                ], true),
            ], new FormeConfigurableExportProcessHandler(ProcessHandlerEmptyValue), methodPriority.afterConversion),

            //base.bool(bool)
            bool: new FormeConfigurableMethod('bool', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool(['null', 'allowNull'], false),
                ], true),
            ], new FormeConfigurableExportProcessHandler(ProcessHandlerConvertBool), methodPriority.conversion),

            //base.int(bool)
            int: new FormeConfigurableMethod('int', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool(['null', 'allowNull'], false),
                ], true),
            ], new FormeConfigurableExportProcessHandler(ProcessHandlerConvertInt), methodPriority.conversion),

            //base.float(bool)
            float: new FormeConfigurableMethod('float', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool(['null', 'allowNull'], false),
                ], true),
            ], new FormeConfigurableExportProcessHandler(ProcessHandlerConvertFloat), methodPriority.conversion),

            //base.string(bool)
            string: new FormeConfigurableMethod('string', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool(['null', 'allowNull'], false),
                ], true),
            ], new FormeConfigurableExportProcessHandler(ProcessHandlerConvertString), methodPriority.conversion),

            //base.json(bool, error)
            json: new FormeConfigurableMethod('json', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool(['require', 'required'], false, true),
                    new FormeConfigurableString('error', false),
                ], true),
            ], new FormeConfigurableExportProcessHandler(ProcessHandlerConvertJson), methodPriority.conversion),

            //base.trigger(string(s), value, value)
            trigger: new FormeConfigurableMethod('trigger', [
                new FormeConfigurableOverride([
                    new FormeConfigurableParam('value', false),
                    new FormeConfigurableStrings(['action', 'actions'], true),
                    new FormeConfigurableParam('context', false),
                ], true),
            ], new FormeConfigurableExportTriggers()),
            triggers: new FormeConfigurableMethodPointer('trigger'),

            //base.validate(callback(s)) (needs to be defined in extending objects as export is different)

            //base.read(callback(s))
            read: new FormeConfigurableMethod('read', [
                new FormeConfigurableOverride([
                    new FormeConfigurableCallbacks(['callback', 'callbacks', 'read'], true),
                ], true),
            ], new FormeConfigurableExportCallbacks('_readHandlers')),

            //base.output(callback(s))
            output: new FormeConfigurableMethod('output', [
                new FormeConfigurableOverride([
                    new FormeConfigurableCallbacks(['callback', 'callbacks', 'output'], true),
                ], true),
            ], new FormeConfigurableExportCallbacks('_outputHandlers')),

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

            //base.before(callback(s))
            before: new FormeConfigurableMethod('before', [
                new FormeConfigurableOverride([
                    new FormeConfigurableCallbacks(['callback', 'callbacks'], true),
                ], true),
            ], new FormeConfigurableExportCallbacks('_beforeHandlers')),
            
            //base.submit(callback(s))
            submit: new FormeConfigurableMethod('submit', [
                new FormeConfigurableOverride([
                    new FormeConfigurableCallbacks(['callback', 'callbacks'], true),
                ], true),
            ], new FormeConfigurableExportCallbacks('_submitHandlers')),

            //base.after(callback(s))
            after: new FormeConfigurableMethod('after', [
                new FormeConfigurableOverride([
                    new FormeConfigurableCallbacks(['callback', 'callbacks'], true),
                ], true),
            ], new FormeConfigurableExportCallbacks('_afterHandlers')),
            
            //base.done(callback(s))
            done: new FormeConfigurableMethod('done', [
                new FormeConfigurableOverride([
                    new FormeConfigurableCallbacks(['callback', 'callbacks'], true),
                ], true),
            ], new FormeConfigurableExportCallbacks('_doneHandlers')),

            //base.getter(callback(s))
            getter: new FormeConfigurableMethod('getter', [
                new FormeConfigurableOverride([
                    new FormeConfigurableCallbacks(['callback', 'callbacks', 'getter', 'getters'], true),
                ], true),
            ], new FormeConfigurableExportCallbacks('_getterHandlers')),
            getters: new FormeConfigurableMethodPointer('getter'),
            
            //base.setter(callback(s))
            setter: new FormeConfigurableMethod('setter', [
                new FormeConfigurableOverride([
                    new FormeConfigurableCallbacks(['callback', 'callbacks', 'setter', 'setters'], true),
                ], true),
            ], new FormeConfigurableExportCallbacks('_setterHandlers')),
            setters: new FormeConfigurableMethodPointer('setter'),

            //base.empty(callback(s))
            empty: new FormeConfigurableMethod('empty', [
                new FormeConfigurableOverride([
                    new FormeConfigurableCallbacks(['callback', 'callbacks'], true),
                ], true),
            ], new FormeConfigurableExportCallbacks('_emptyHandlers')),
        };
    }

    _buildConfiguration(methods) {
        //split the methods into ordered and unordered
        const orderedMethods = [];
        const unorderedMethods = [];

        for(let method of methods) {
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
                        index: handler._index,
                    });
                }
            }

            //so now we have a list of all handlers but as we fetched them in chunks of *method* at a time, the order may be incorrect
            list.sort((a, b) => a.index - b.index);

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

    //build handler property key methods
    _buildHandlerPropertyKeys() {
        return ['_buildHandlers', '_processHandlers', '_validateHandlers', '_invalidHandlers', '_validHandlers', '_executeHandlers', '_successHandlers', '_failHandlers', '_beforeHandlers', '_submitHandlers', '_afterHandlers', '_actionHandlers', '_doneHandlers', '_setterHandlers'];
    }

    //static properties
    static get _cloneBlacklist() {
        return [];
    }

    //static methods
    static _lookupHandlerClass() {
        //map name of handler method to handler class: e.g. element.require() -> "require" -> TheHandlerClass
        return null;
    }

    //private properties
    get _outputName() {
        return this._alias !== null && this._alias !== undefined?this._alias:this._name;
    }

    get _uniqueName() {
        //build unique name for this element
        return utils.element.create.uniqueName(this._form._name, this._pathSegments);
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

    get _ownPathLength() {
        //by default we add 1 to count for this elements _outputName.
        //other extended elements may not consider their name to be include, such as pages!
        return this._groupLength+1;
    }

    get _groupLength() {
        if (this._group === null) {
            return 0;
        } else {
            return this._group.length;
        }
    }

    get _labelHidden() {
        if (this._hideLabel || !this._label) {
            return true;
        }

        let pointer = this._parent;
        while(pointer) {
            if (pointer._hideDescendantLabels) {
                return true;
            }
            pointer = pointer._parent;
        }

        return false;
    }

    get _causedError() {
        return this._request._hasErrorWithSourcePath(this.path);
    }

    get _exposedContext() {
        const out = {};
        for(let name of Object.keys(this._context)) {
            const context = this._context[name];
            if (context.exposed) {
                out[name] = context.value;
            }
        }
        return out;
    }

    get _handlerPropertyKeys() {
        //return a list of self.properties that store lists of handlers for this element!
        let cache = handlerPropertyKeyCache[this.constructor.name];
        if (cache === undefined) {
            cache = handlerPropertyKeyCache[this.constructor.name] = this._buildHandlerPropertyKeys();
        }
        return cache;
    }

    //private request properties
    get _driver() {
        return this._form._currentDriver;
    }

    get _url() {
        return this._form._currentDriver.url();
    }

    get _request() {
        return this._form._currentRequest;
    }

    get _requestFirst() {
        return this._form._currentRequest && this._form._currentRequest._pageFirst;
    }

    get _requestSubmit() {
        return this._form._currentRequest && this._form._currentRequest._submit;
    }

    get _requestPage() {
        return this._form._currentRequest && this._form._currentRequest._page || null;
    }

    get _requestRawValue() {
        //by default has none
        return undefined;
    }

    get _requestValue() {
        //by default has none
        return undefined;
    }

    get _errorLabel() {
        //always need an error label!
        return this._customErrorLabel || this._label || this._outputName;
    }

    get _errorPath() {
        //by default we dont provide an error path, because only elements such as inputs and components should override and present this info!
        return null;
    }

    get _errorName() {
        //by default we dont specify an error name, because base does not have a "name" that we can lookup on
        return null;
    }

    //public properties
    get formeClass() {
        return null;
    }

    get configurableMethods() {
        //get the cache for this specific class
        let cache = configurableMethodClassCache[this.constructor.name];

        //check if cache, otherwise create a new cache!
        if (cache === undefined) {
            //need to build!
            const lookup = this._buildConfigurableMethods();

            //resolve pointer methods
            for(let name of Object.keys(lookup)) {
                let method = lookup[name];

                //only bother doing it if its actually a pointer
                if (method instanceof FormeConfigurableMethodPointer) {
                    //keep going until the method is no longer a pointer
                    while (method && method instanceof FormeConfigurableMethodPointer) {
                        method = lookup[method.pointer];
                    }

                    //update the method to point
                    lookup[name] = method;
                }
            }

            //create list of methods sorted by priority
            //build key info once so the search does not have to do a ton of lookups!
            let index = 0;
            const keys = Object.keys(lookup).map(key => {
                const method = lookup[key];
                return {
                    index: index++,//this is the order as defined in the original javascript object. Remember this is not gauranteed!
                    priority: method.priority,
                    method: method,
                };
            });

            //sort
            keys.sort((a, b) => {
                //sort by priority descending, index ascending
                //so if an item is specified with a high priority, it will be first!
                return b.priority - a.priority || a.index - b.index;
            });

            //build cache
            cache = configurableMethodClassCache[this.constructor.name] = {
                lookup: lookup,
                list: keys.map(key => key.method),
            };
        }

        //return cache
        return cache;
    }

    get configurableMethodsList() {
        return this.configurableMethods.list;
    }

    get configurableMethodsLookup() {
        return this.configurableMethods.lookup;
    }

    get configurableMethodNames() {
        return this.configurableMethods.list.map(method => method.method);
    }

    get configuration() {
        //_buildConfiguration iterates an array of methods, so pass the list!
        return this._buildConfiguration(this.configurableMethods.list);
    }

    get form() {
        return this._form;
    }

    get root() {
        return this._page || this._form;
    }

    get parent() {
        //form overrides this to null as form is the master of all things!!
        return this._parent;
    }

    get container() {
        //form overrides this to null as form is not contained!
        return this._component || this._page || this._form;
    }

    get path() {
        return this._pathSegments.join('.');
    }
    
    get storage() {
        if (this.callingStartedMethod('storage')) {
            return this._form._currentDriver._storage;
        }
    }

    //private validate property methods
    _validatePropertyName(name) {
        if (name && name.startsWith('->')) {
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
    _build(external) {
        return this._buildStart(external)
        .then(() => this._buildSelf(external))
        .then(() => this._buildChildren(external))
        .then(() => this._buildFinish(external));
    }

    _buildStart(external) {
        return Promise.resolve();
    }

    _buildSelf(external) {
        if (this._buildHandlers.length === 0) {
            return Promise.resolve();
        } else {
            return this._nextBuildHandler(this._buildHandlers, 0);
        }
    }

    _buildChildren(external) {
        return Promise.resolve();
    }

    _buildFinish(external) {
        return Promise.resolve();
    }

    //private build modify methods
    _buildModify(external) {
        //this is initiated from the root form and then propagated to children
        //all children now exist and this is an oppertunity to make modifications before any values are read!
        return this._buildModifySelf(external)
        .then(() => this._buildModifyChildren(external));
    }

    _buildModifySelf(external) {
        return Promise.resolve();
    }

    _buildModifyChildren(external) {
        return Promise.resolve();
    }
    
    //private build finalise methods
    _buildFinalise(external) {
        //this is initiated from the root form and then propagated to children
        //all children now exist and all values have been read. We can use this hook in lifecycle to do any last minute glue!
        return this._buildFinaliseSelf(external)
        .then(() => this._buildFinaliseChildren(external));
    }

    _buildFinaliseSelf(external) {
        return Promise.resolve();
    }

    _buildFinaliseChildren(external) {
        return Promise.resolve();
    }

    //private build read methods
    _buildRead(out, external) {
        //create a private "out" container for this element. We will merge into the parent at the end!
        const container = { raw: {}, values: {} };

        //read self (internal)
        return this._buildReadSelf(container, external)//execute this with a private "out" object

        //read children
        .then(container => this._buildReadChildren(container, external))

        //run handlers
        .then(container => this._buildReadHandlers(container, {
            first: this._requestFirst,
            submit: this._requestSubmit,
        }, external))

        //now merge the results into the parent
        .then(container => {
            Object.assign(out.raw, container.raw);
            Object.assign(out.values, container.values);

            //always chain out!
            return out;
        })

        //finish
        .then(out => this._buildReadFinish(out, external));
    }

    _buildReadSelf(out, external) {
        //always chain out!
        return Promise.resolve(out);
    }

    _buildReadChildren(out, external) {
        //always chain out!
        return Promise.resolve(out);
    }

    _buildReadHandlers(out, state, external) {
        //always chain out!
        return Promise.resolve(out);
    }

    _buildReadFinish(out, external) {
        //always chain out!
        return Promise.resolve(out);
    }

    //private build load handlers methods
    _buildLoadHandlers() {
        return Promise.resolve();
    }

    _buildLoadHandlersSelf() {
        return Promise.resolve();
    }

    _buildLoadHandlersChildren() {
        return Promise.resolve();
    }

    //private build build handlers methods
    _buildBuildHandlers() {
        return Promise.resolve();
    }

    _buildBuildHandlersSelf() {
        return Promise.resolve();
    }

    _buildBuildHandlersChildren() {
        return Promise.resolve();
    }

    //private build values methods
    _buildValues(options, parent, depth=0) {
        //make sure we have options
        options = options || {};

        //only build included nodes!
        if (this._buildValuesInclude(options, depth)) {
            if (!options.group) {
                //flat list ungrouped, means only inputs!
                return this._buildValuesFlat(options, parent, depth);

            } else {
                //we dont need a parent object as each function below will make sure there is one before manipulating it.
                let pointer = parent;

                //build groups structure and update the parent pointer! (+chain parent)
                pointer = this._buildValuesGroups(options, pointer, depth);

                //now build the value!
                let value = this._buildValuesSelf(options, depth);

                //handle getters?
                if (options.getters) {
                    value = this._processGetters(value);
                }

                //build the structure and return it!
                return this._buildValuesStructure(options, pointer, value, depth);
            }
        }

        //nothing, so just chain back the parent!
        return parent;
    }

    _buildValuesFlat(options, parent, depth=0) {
        return parent;
    }

    _buildValuesInclude(options, depth=0) {
        //check its included before adding it!
        return true;
    }

    _buildValuesGroups(options, parent, depth=0) {
        //build the group structure in parent and then return the pointer to that group...
        //we dont add the group if the "options.isolate" is set, this is because we are signalling that we are isolating the final output of this build
        //e.g. we are isolating PART of the entire form value, so we dont want the root to be contained in the group structure
        if (options.group && (!options.isolate || depth > 0)) {
            //ads the group path to the structure (not to be confused with adding an element)
            const segments = this._ownGroupSegments;

            if (segments && segments.length) {
                //make sure we have a structure to build into
                parent = parent || {};

                for (let index = 0; index < segments.length; index++) {
                    const segment = segments[index];

                    //check if segment exists and if it can contain children? (if not then we overwrite it)
                    let child = parent[segment];
                    if (!child) {
                        child = parent[segment] = {};
                    }

                    //update parent pointer
                    parent = child;
                }
            }

        }

        //chain the parent
        return parent;
    }

    _buildValuesSelf(options, depth=0) {
        //should return the value of this!
        throw new Error(`${this.formeClass}._buildValuesSelf() must be overridden`);
    }

    _buildValuesStructure(options, parent, value, depth=0) {
        //add to structure
        if (parent) {
            //we have parent, add to that
            parent[this._outputName] = value;
            return parent;
        } else {
            //we have no parent, so return the value!
            return value;
        }
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
                //ads the group path to the structure (not to be confused with adding an element)
                const segments = this._ownGroupSegments;

                if (segments && segments.length) {
                    //make sure we have a structure to build into
                    parent = parent || {};

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
            parent = parent || {};
            parent.children[this._outputName] = vars;

            //chain the vars back as this is now the parent!
            return resolve(vars);
        });
    }

    _buildTemplateVars(options) {
        const errors = this.getOwnErrors();
        const causedError = this._causedError;

        //build class names
        const className = [];
        const stateClassName = [];
        const errorClassName = [];

        //error
        if ((causedError || (errors && errors.length)) && this._form._errorClassNames.length) {
            for (let name of this._form._errorClassNames) {
                className.push(name);
                stateClassName.push(name);
                errorClassName.push(name);
            }
        }

        //custom
        if (this._classNames.length) {
            for (let name of this._classNames) {
                className.push(name);
            }
        }

        //base vars for all elements!
        const vars = {
            __formeClass: this.formeClass,
            name: this._name,
            label: this._labelHidden?null:this._label,
            errorLabel: this._errorLabel,
            icon: this._icon,
            context: this._exposedContext,
            className: className.join(' '),
            data: Object.assign({}, ...this._data.map(data => ({['data-' + data.name]: data.value}))),
            stateClassName: stateClassName.join(' '),
            errorClassName: errorClassName.join(' '),
            errors: errors && errors.length?errors:null,
            causedError: causedError,
            rendered: null,//null indicates that there was no template! (dont populate these yet because we might cause an infinite loop on user code. )
            template: this._template,
            templateClient: this._templateClient,
        };

        //chain
        return vars;
    }

    _buildTemplateChildren(options, parent) {
        //default no children
        return Promise.resolve(parent);
    }

    _buildTemplateFinalise(options, parent) {
        //does the input have a template
        if (!this._template) {
            //no template so chain back the parent
            return Promise.resolve(parent);
        } else {
            if (this._templateClient) {
                //client renders template so just pass on the details for client to deal with
                parent.template = this._template;
                return Promise.resolve(parent);
            } else {
                //server needs to render the template
                return Promise.resolve(this._driver.renderTemplate(this._form, this, this._template, parent))
                .then(rendered => {
                    //done, so lets dump details into rendered
                    parent.rendered = rendered || '';//empty result should be a string instead of null/undefined because this indicates that something did actually happen

                    //chain
                    return parent;
                });
            }
        }
    }

    //private build compose handler methods
    _buildComposeHandlers(out=null) {
        out = out || [];
        this._buildComposeHandlersChildren(out);
        this._buildComposeHandlersSelf(out);
        return out;
    }

    _buildComposeHandlersSelf(out) {
    }

    _buildComposeHandlersChildren(out) {
    }

    //private process methods
    _processExecuteHandler(handler) {
        //build state info (let the extended container dictate what info is returned).

        //create two copies of state so we can track changes after execution!
        const newState = this._createElementState(handler);
        const oldState = this._createElementState(handler);

        //let the extending handler class do the execution! This is because they may validation handlers or process handlers!
        //This differs to other handlers such as done() or fail(), they are generally just function callbacks.
        return new Promise((resolve, reject) => {
            //wrap in promise so we catch throws
            return Promise.resolve(handler.execute(this, newState))
            .then(() => resolve())
            .catch(err => reject(err));
        })

        //process any state changes
        .then(() => this._processElementStateChanges(handler, oldState, newState, false))

        //uh oh!
        .catch(err => {
            //errors received here are actually validation errors which need adding to the form!
            //extract error string from catch (if an error was provided)
            let error = (err?err.message:null) || '';

            //log errors for debugging purposes!
            if (constants.logErrors && err instanceof Error) {
                console.error(err);
            }

            //does the handler have an error?
            if (handler.error !== null) {
                error = handler.error;
            }

            //so do we actually have an error?
            if (error && error.length > 0) {
                //format the error
                error = format(error, {
                    name: this._name,
                    label: this._errorLabel,
                });

                //add error to self (piping will send it where it needs to be)
                this.addError(error);
            }

            //cancel iteration
            return Promise.reject(new Error(''));
        });
    }

    _processOutputHandler(handler) {
        //build state info (let the extended container dictate what info is returned).

        //create two copies of state so we can track changes after execution!
        const newState = this._createElementState(handler);
        const oldState = this._createElementState(handler);

        //execute the handler (its just a callback, so let the extending class deal with its execution!)
        return new Promise((resolve, reject) => {
            //wrap in promise so we catch throws
            return Promise.resolve(this._executeOutputHandler(handler, newState))
            .then(() => resolve())
            .catch(err => reject(err));
        })

        //process any state changes
        .then(() => this._processElementStateChanges(handler, oldState, newState, true))

        //uh oh!
        .catch(err => {
            //errors received here are actually validation errors which need adding to the form!
            //extract error string from catch (if an error was provided)
            let error = (err?err.message:null) || '';

            //so do we actually have an error?
            if (error && error.length > 0) {
                //format the error
                error = format(error, {
                    name: this._name,
                    label: this._errorLabel,
                });

                //add error to self (piping will send it where it needs to be)
                this.addError(error);
            }

            //cancel iteration
            return Promise.reject(new Error(''));
        });
    }

    _processSubmitHandler(handler) {
        //build state info (let the extended container dictate what info is returned).

        //create two copies of state so we can track changes after execution!
        const newState = this._createElementState(handler);
        const oldState = this._createElementState(handler);

        //execute the handler (its just a callback, so let the extending class deal with its execution!)
        return new Promise((resolve, reject) => {
            //wrap in promise so we catch throws
            return Promise.resolve(this._executeSubmitHandler(handler, newState))
            .then(() => resolve())
            .catch(err => reject(err));
        })

        //process any state changes
        .then(() => this._processElementStateChanges(handler, oldState, newState, true))

        //uh oh!
        .catch(err => {
            //errors received here are considered form errors (e.g. not validation errors)! But we should still be able to pipe it!
            //extract error string from catch (if an error was provided)
            let error = (err?err.message:null) || '';

            //so do we actually have an error?
            if (error && error.length > 0) {
                //format the error
                error = format(error, {
                    name: this._name,
                    label: this._errorLabel,
                });

                //add error to self (piping will send it where it needs to be)
                this.addError(error);
            }

            //cancel iteration
            return Promise.reject(new Error(''));
        });
    }

    _processElementStateChanges(handler, oldState, newState) {
        //should be overridden
    }

    _processReadHandlers(values, state) {
        if (!this._readHandlers || this._readHandlers.length === 0) {
            return Promise.resolve(values);
        } else {
            return this._nextReadHandler(this._readHandlers, values, state);
        }
    }

    _processGetters(value) {
        //prevent setters from infinite by tracking the this._insideGetter flag!
        if (this._insideGetter) {
            throw new FormeError(`infinite getter detected!`);
        } else if (this._getterHandlers.length > 0) {
            //iterate getters
            for (let handler of this._getterHandlers) {
                this._insideGetter = true;
                value = this._executeGetterHandler(handler, value);
                this._insideGetter = false;
            }
        }

        //chain value
        return value;
    }

    _processSetters(value) {
        //prevent setters from infinite by tracking the this._insideSetter flag!
        if (this._insideSetter) {
            throw new FormeError(`infinite setter detected!`);
        } else if (this._setterHandlers.length > 0) {
            //iterate setters
            for (let handler of this._setterHandlers) {
                this._insideSetter = true;
                value = this._executeSetterHandler(handler, value);
                this._insideSetter = false;
            }
        }

        //chain value
        return value;
    }

    _processEmptyHandlers(state) {
        if (!this._emptyHandlers || this._emptyHandlers.length === 0) {
            //skip (defaults to yes it was empty) if we have no handlers!
            return Promise.resolve(null);//null indicates that no handlers were executed!
        } else {
            //element can check if empty or not!
            return this._nextEmptyHandler(this._emptyHandlers, state);
        }
    }

    //private execute methods
    _execute() {
        //children first
        return this._executeChildren()
        .then(() => this._executeSelf());
    }

    _executeSelf() {
        //includes process and validation handlers!
        return (this._executeHandlers.length === 0?Promise.resolve():this._nextExecuteHandler(this._executeHandlers, 0))

        //after execution we get an opportunity to change the output of the element!
        .then(() => {
            //skip execution by all means possible!
            if (this._outputHandlers.length === 0 || this._alwaysInvalid || this._request._hasInvalidDescendant(this.path)) {
                //just pass execution onto the next step! (this could be double checking for  _hasInvalidDescendant(), but that is fine!)
                return Promise.resolve();
            } else {
                //execution output handlers! Any errors thrown in the output handlers will be treated as validation errors!
                return this._nextOutputHandler(this._outputHandlers, 0);
            }
        })

        //fire _valid() or _invalid() based on if any execution/output promise rejected!
        .then(() => {
            //check for various invalid conditions!
            if (this._alwaysInvalid || this._request._hasInvalidDescendant(this.path)) {
                this._request._flagFailedValidation();
                return this._invalid();
            } else {
                return this._valid()
            }
        })

        //invalid :(
        .catch(err => {
            //extra precaution, mark as failed validation
            this._request._flagError();
            this._request._flagFailedValidation();

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
        .then(() => this._invalidAncestors());//this is special as we might want to flag ancestors as being invalid!
    }

    _invalidSelf() {
        if (this._invalidHandlers.length === 0) {
            return Promise.resolve();
        } else {
            return this._nextInvalidHandler(this._invalidHandlers, 0);
        }
    }

    _invalidAncestors() {
        const container = this.container;
        if (container) {
            //flag container as invalid
            this._request._flagInvalidElementDescendant(container.path);//this might create an "empty" key in the tracking object when flagging the root form

            //let the container continue the walking!
            return container._invalidAncestors();
        } else {
            //nope, time to finish walking!
            return Promise.resolve();
        }
    }

    //private valid methods
    _valid() {
        return this._validSelf();
    }

    _validSelf() {
        if (this._validHandlers.length === 0) {
            return Promise.resolve();
        } else {
            return this._nextValidHandler(this._validHandlers, 0);
        }
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

    //private before methods
    _before() {
        //children first
        return this._beforeChildren()
        .then(() => this._beforeSelf());
    }

    _beforeSelf() {
        if (this._beforeHandlers.length === 0) {
            return Promise.resolve();
        } else {
            return this._nextBeforeHandler(this._beforeHandlers, 0);
        }
    }

    _beforeChildren() {
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

    //private after methods
    _after() {
        //children first
        return this._afterChildren()
        .then(() => this._afterSelf());
    }

    _afterSelf() {
        if (this._afterHandlers.length === 0) {
            return Promise.resolve();
        } else {
            return this._nextAfterHandler(this._afterHandlers, 0);
        }
    }

    _afterChildren() {
        return Promise.resolve();
    }

    //private trigger/action methods
    _armTriggers() {
        //children first (doesn't really matter here)
        return this._armTriggersChildren()
        .then(() => this._armTriggersSelf());
    }

    _armTriggersSelf() {
        if (this._triggers.length === 0) {
            return Promise.resolve();
        } else {
            //test our current value against all of our own triggers
            const value = this._requestValue;

            for (let trigger of this._triggers) {
                //trigger with matching value or ANY value if the trigger is set to null (+dont trigger special actions)
                if (!trigger.special && ((trigger.value === null && value !== undefined) || trigger.value === value)) {
                    //add to request
                    this._request._actions.push({
                        action: trigger.action,
                        context: trigger.context,
                    });
                }
            }
        }
    }

    _armTriggersChildren() {
        //no children in base!
        return Promise.resolve();
    }
    
    _fireTriggerActions() {
        //children first
        return this._fireTriggerActionsChildren()
        .then(() => this._fireTriggerActionsSelf());
    }
    
    _fireTriggerActionsSelf() {
        //slightly different from most methods that call this._nextFooHandler() because we filter the internal handler list
        const handlers = this._actionHandlers.filter(handler => this._request._actions.findIndex(action => action.action === handler.action) !== -1);
        
        //so, any matched actions?
        if (handlers.length === 0) {
            return Promise.resolve();
        } else {
            //filter handler list to tho
            return this._nextActionHandler(handlers, 0);
        }
    }

    _fireTriggerActionsChildren() {
        //no children in base!
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

    _findDescendant(path, type=null, index=0) {
        //by default a "base" element cant recurse so it insta-fails! (containers should override this)
        return null;
    }

    _findDescendantContinue(segments, index) {
        //check the current segment and determin how to continue in the search
        if (segments[index] === this._outputName) {
            //move to the next segment
            return index+1;
        } else {
            //halt search
            return false;
        }
    }

    _findDescendantFound() {
        //can this descendant be returned from a search?
        return true;
    }

    _findTriggers(special, actions) {
        if (!this._triggers) {
            return [];
        } else {
            return this._triggers.filter(trigger => trigger.special === special && (action === null || (Array.isArray(action) && action.indexOf(trigger.action) !== -1) || trigger.action === action));
        }
    }

    _findCustomTriggers(actions=null) {
        return this._findTriggers(false, actions);
    }

    _findSpecialTriggers(actions=null) {
        return this._findTriggers(true, actions);
    }

    //private remove methods
    _removeValidateHandler(type) {
        this._validateHandlers = this._validateHandlers.filter(handler => handler.constructor !== type);
    }

    //private add trigger methods
    _addTrigger(value, actions, context=null, special=false) {
        if (Array.isArray(actions)) {
            //multiple
            for (let action of actions) {
                this._triggers.push({
                    action: action,
                    value: value,
                    context: context,
                    special: special,
                });
            }
        } else {
            //single
            this._triggers.push({
                action: actions,
                value: value,
                context: context,
                special: special,
            });
        }
    }

    //private add handler methods
    _addBuildHandler(callback) {
        this._buildHandlers.push(callback);

        //chain
        return callback;
    }

    _addCustomReadHandler(callback) {
        this._readHandlers.push(callback);

        //chain
        return callback;
    }

    _addProcessHandler(handler) {
        handler._index = this._executeHandlerIndex++;
        this._executeHandlers.push(handler);
        this._processHandlers.push(handler);

        //chain
        return handler;
    }

    _addValidateHandler(handler) {
        handler._index = this._executeHandlerIndex++;
        this._executeHandlers.push(handler);
        this._validateHandlers.push(handler);

        //chain
        return handler;
    }

    _addCustomValidateHandler(callback, error) {
        //should be overridden

        //chain
        return callback;
    }

    _addCustomOutputHandler(callback) {
        this._outputHandlers.push(callback);

        //chain
        return callback;
    }

    _addCustomInvalidHandler(callback) {
        this._invalidHandlers.push(callback);

        //chain
        return callback;
    }

    _addCustomValidHandler(callback) {
        this._validHandlers.push(callback);

        //chain
        return callback;
    }

    _addCustomBeforeHandler(callback) {
        this._beforeHandlers.push(callback);

        //chain
        return callback;
    }
    
    _addCustomSubmitHandler(callback) {
        this._submitHandlers.push(callback);

        //chain
        return callback;
    }

    _addCustomAfterHandler(callback) {
        this._afterHandlers.push(callback);

        //chain
        return callback;
    }
    
    _addCustomSuccessHandler(callback) {
        this._successHandlers.push(callback);

        //chain
        return callback;
    }

    _addCustomFailHandler(callback) {
        this._failHandlers.push(callback);

        //chain
        return callback;
    }

    _addCustomDoneHandler(callback) {
        this._doneHandlers.push(callback);

        //chain
        return callback;
    }

    _addCustomGetterHandler(callback) {
        this._getterHandlers.push(callback);

        //chain
        return callback;
    }
    
    _addCustomSetterHandler(callback) {
        this._setterHandlers.push(callback);

        //chain
        return callback;
    }

    _addCustomEmptyHandler(callback) {
        this._emptyHandlers.push(callback);

        //chain
        return callback;
    }
    
    //private next handler methods
    _nextBuildHandler(handlers, index=0) {
        return Promise.resolve(this._executeBuildHandler(handlers[index]))
        .then(() => ++index === handlers.length ? Promise.resolve() : this._nextBuildHandler(handlers, index));
    }

    _nextExecuteHandler(handlers, index=0) {
        return Promise.resolve(this._processExecuteHandler(handlers[index]))
        .then(() => ++index === handlers.length ? Promise.resolve() : this._nextExecuteHandler(handlers, index));
    }

    _nextReadHandler(handlers, value, state, index=0) {
        //slightly different signature because we want to chain the result!
        return Promise.resolve(this._executeReadHandler(handlers[index], value, state))
        .then(value => ++index === handlers.length ? Promise.resolve(value) : this._nextReadHandler(handlers, value, state, index));
    }

    _nextOutputHandler(handlers, index=0) {
        return Promise.resolve(this._processOutputHandler(handlers[index]))
        .then(() => ++index === handlers.length ? Promise.resolve() : this._nextOutputHandler(handlers, index));
    }

    _nextInvalidHandler(handlers, index=0) {
        return Promise.resolve(this._executeInvalidHandler(handlers[index]))
        .then(() => ++index === handlers.length ? Promise.resolve() : this._nextInvalidHandler(handlers, index));
    }

    _nextValidHandler(handlers, index=0) {
        return Promise.resolve(this._executeValidHandler(handlers[index]))
        .then(() => ++index === handlers.length ? Promise.resolve() : this._nextValidHandler(handlers, index));
    }

    _nextSuccessHandler(handlers, index=0) {
        return Promise.resolve(this._executeSuccessHandler(handlers[index]))
        .then(() => ++index === handlers.length ? Promise.resolve() : this._nextSuccessHandler(handlers, index));
    }

    _nextFailHandler(handlers, index=0) {
        return Promise.resolve(this._executeFailHandler(handlers[index]))
        .then(() => ++index === handlers.length ? Promise.resolve() : this._nextFailHandler(handlers, index));
    }

    _nextBeforeHandler(handlers, index=0) {
        return Promise.resolve(this._executeBeforeHandler(handlers[index]))
        .then(() => ++index === handlers.length ? Promise.resolve() : this._nextBeforeHandler(handlers, index));
    }
    
    _nextSubmitHandler(handlers, index=0) {
        return Promise.resolve(this._processSubmitHandler(handlers[index]))
        .then(() => ++index === handlers.length ? Promise.resolve() : this._nextSubmitHandler(handlers, index));
    }

    _nextAfterHandler(handlers, index=0) {
        return Promise.resolve(this._executeAfterHandler(handlers[index]))
        .then(() => ++index === handlers.length ? Promise.resolve() : this._nextAfterHandler(handlers, index));
    }
    
    _nextActionHandler(handlers, index=0) {
        return Promise.resolve(this._executeActionHandler(handlers[index]))
        .then(() => ++index === handlers.length ? Promise.resolve() : this._nextActionHandler(handlers, index));
    }
    
    _nextDoneHandler(handlers, index=0) {
        return Promise.resolve(this._executeDoneHandler(handlers[index]))
        .then(() => ++index === handlers.length ? Promise.resolve() : this._nextDoneHandler(handlers, index));
    }

    _nextEmptyHandler(handlers, state, index=0) {
        return Promise.resolve(this._executeEmptyHandler(handlers[index], state))
        .then(empty => {
            if (empty === false) {
                //last callback flagged as not empty so halt!
                return Promise.resolve(false);
            } else {
                if (++index === handlers.length) {
                    //reached the end without fail. It is empty!
                    return Promise.resolve(true);
                } else {
                    //keep executing empty handlers!
                    return this._nextEmptyHandler(handlers, state, index);
                }
            }
        });
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

    _executeReadHandler(handler, value, state) {
        //should be overridden
        return Promise.resolve(value);
    }

    _executeOutputHandler(handler, state) {
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

    _executeBeforeHandler(handler) {
        //should be overridden
        return Promise.resolve();
    }
    
    _executeSubmitHandler(handler, state) {
        //should be overridden
        return Promise.resolve();
    }

    _executeAfterHandler(handler) {
        //should be overridden
        return Promise.resolve();
    }

    _executeActionHandler(handler, action) {
        //should be overridden
        return Promise.resolve();
    }
    
    _executeDoneHandler(handler) {
        //should be overridden
        return Promise.resolve();
    }

    _executeGetterHandler(handler, value) {
        //should be overridden (this is synchronous but may be wrapped in a promise!)
        return value;//default just pass the value back!
    }
    
    _executeSetterHandler(handler, value) {
        //should be overridden (this is sync)
        return value;
    }

    _executeComposeHandler(handler, component, details) {
        return Promise.resolve(true);//resolve that the component was dealt with!
    }

    _executeEmptyHandler(handler, state) {
        //should be overridden (defaults to ignore)
        return Promise.resolve(null);
    }

    //private pipe methods
    _pipeError(error, formeClass, path, name) {
        //pipe the error to the correct place, by default no piping happens (goes direct to the request)!
        if (this._pipe === null) {
            //pipe to self!
            this._request._addError(error, this.formeClass, this._errorPath, this._errorName, formeClass, path, name);
        } else {
            //handle special pipe tokens
            switch(this._pipe) {
                case '->form':
                    if (this instanceof this._form._driverClass.formClass) {
                        //this is form, so add to request
                        this._request._addError(error, this.formeClass, this._errorPath, this._errorName, formeClass, path, name);
                    } else {
                        //pipe it to the form
                        this._form._pipeError(error, formeClass, path, name);
                    }
                    break;

                case '->page':
                    if (this._requestPage) {
                        //pipe to page
                        if (this instanceof this._form._driverClass.pageClass) {
                            //this is page so pipe to form
                            this._form._pipeError(error, formeClass, path, name);
                        } else {
                            //pipe it to page
                            this._requestPage._pipeError(error, formeClass, path, name);
                        }
                    } else {
                        //lost
                        this._form._pipeLostError(error, formeClass, path, name);
                    }
                    break;

                case '->container':
                    const container = this.container;
                    if (container) {
                        //pipe to container
                        container._pipeError(error, formeClass, path, name);
                    } else {
                        //lost
                        this._form._pipeLostError(error, formeClass, path, name);
                    }
                    break;

                case '->parent':
                    const parent = this.container;
                    if (parent) {
                        //pipe to parent
                        parent._pipeError(error, formeClass, path, name);
                    } else {
                        //lost
                        this._form._pipeLostError(error, formeClass, path, name);
                    }
                    break;

                default:
                    //pipe to element path
                    const element = this._form._findDescendant(this._pipe);
                    if (element) {
                        //pipe to found element
                        element._pipeError(error, formeClass, path, name);
                    } else {
                        //lost
                        this._form._pipeLostError(error, formeClass, path, name);
                    }
            }
        }
    }

    //private create methods
    _createElementState(handler) {
        return {};
    }

    //private get methods
    _getContext(name, defaultValue) {
        const context = this._context[name];
        if (context === undefined) {
            return defaultValue;
        } else {
            return context.value;
        }
    }

    _getValueRouter(path) {

    }

    //private set methods
    _setContext(name, value, exposed=false) {
        if (value === undefined) {
            //remove
            delete this._context[name];
        } else {
            this._context[name] = {
                value: value,
                exposed: exposed,
            };
        }
    }

    //private set value methods
    _setValue(value, merge, setters) {
        //pass the value through setters
        if (setters) {
            value = this._processSetters(value);
        }

        //no setter, so what type of value is this?
        if (value && typeof value === 'object') {
            //object
            if (!this._setValueObject(value, merge, setters)) {
                //element indicated that it wasnt able to set an object value, so clear everything!
                if (!merge) {
                    this._clearValue();
                }
            }
        } else {
            if (!this._setValuePrimitive(value, merge, setters)) {
                //element indicated that it wasnt able to set a primitive value, so clear everything!
                if (!merge) {
                    this._clearValue();
                }
            }
        }
    }

    _setValueObject(value, merge, setter) {
        //return true to indicate that this element set the value using the object provided
        return false;
    }

    _setValuePrimitive(value, merge, setter) {
        //return true to indicate that this element set the value using the a primitive value
        return false;
    }

    //private clear methods
    _clearValue() {
        //do nothing as base has no value!
    }

    //private call element methods
    _callElementStructure(method, input) {
        //cant do anything because we dont have any elements!
    }

    _callElements(method, recurse, ...params) {
        //nope
    }

    _callExposedElements(method, recurse, ...params) {
        //nope!
    }

    //private convert methods
    _convertElementValues(input, out) {
        //do nothing becase base has no output
        //chain out
        return out;
    }

    //private tarverse methods
    _traverseObject(input) {
        const segments = this._ownPathSegments;

        //determine how we are going to read the input...
        let pointer = input;

        //walk path
        for (let index = 0; index < segments.length; index++) {
            //walk the input path (using the elements path)
            const segment = segments[index];

            //check if this group segment exists on the current pointer of the input
            if (!pointer || typeof pointer !== 'object' || !pointer.hasOwnProperty(segment)) {
                return undefined;
            }

            //walk
            pointer = pointer[segment];
            if (typeof pointer !== 'object' && index < segments.length - 1) {
                //we have found an endpoint of the input, but we are still traversing to the endpoint of the element (still more groups)
                return undefined;
            }
        }

        //w00t!
        return pointer;
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

    callingStartedMethod(method) {
        return utils.call.check.not.inactive(this._form, `${this.formeClass}.${method}()`);
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
            this._label = label || null;

            //chain
            return this;
        }
    }

    errorLabel(label) {
        if (this.callingConfigureMethod('errorLabel')) {
            this._customErrorLabel = label || null;

            //chain
            return this;
        }
    }

    icon(icon) {
        if (this.callingConfigureMethod('icon')) {
            this._icon = icon || null;

            //chain
            return this;
        }
    }

    className(classNames) {
        if (this.callingConfigureMethod('className')) {
            //how many?
            if (typeof classNames === 'string') {
                //single string, (but might be multiple classes in one)
                let parts = classNames.split(' ');
                for (let partIndex = 0; partIndex < parts.length; partIndex++) {
                    let part = parts[partIndex].trim();
                    if (parts[partIndex].length) {
                        this._classNames.push(part);
                    }
                }
            } else if (Array.isArray(classNames)) {
                //array of strings (and each string might have multiple)
                for (let classNameIndex = 0; classNameIndex < classNames.length; classNameIndex++) {
                    let parts = classNames[classNameIndex].split(' ');
                    for (let partIndex = 0; partIndex < parts.length; partIndex++) {
                        let part = parts[partIndex].trim();
                        if (parts[partIndex].length) {
                            this._classNames.push(part);
                        }
                    }
                }
            }

            //chain
            return this;
        }
    }

    classNames(classNames) {
        return this.className(classNames);
    }

    template(template, client=false) {
        if (this.callingConfigureMethod('template')) {
            //set a template name/path/etc for engines to implement!
            this._template = template || null;
            this._templateClient = client || false;
        }
    }

    data() {
        if (this.callingConfigureMethod('data')) {
            if (arguments.length === 2 || (arguments.length === 1 && typeof arguments[0] === 'string')) {
                //single data
                this._data.push({
                    name: arguments[0],
                    value: arguments.length > 0?arguments[1]:'',
                });
            } else if (arguments.length === 1 && typeof arguments[0] === 'object') {
                //single object
                const data = arguments[0];
                for(let name of Object.keys(data)) {
                    const value = data[name];
                    this._data.push({
                        name: name,
                        value: value ? value : '',
                    });
                }
            }

            //chain
            return this;
        }
    }

    group(segments, atEnd=true) {
        if (this.callingConfigureMethod('group')) {
            if (this._group === null) {
                this._group = [];
            }

            if (Array.isArray(segments)) {
                //array of
                if (atEnd) {
                    this._group.push(...segments);
                } else {
                    this._group.unshift(...segments);
                }
            } else {
                //single
                if (atEnd) {
                    this._group.push(segments);
                } else {
                    this._group.unshift(segments);
                }
            }

            //chain
            return this;
        }
    }

    groups() {
        return this.group(...arguments);
    }

    alias(alias) {
        if (this.callingConfigureMethod('alias')) {
            //change the name used in template var / values
            this._alias = alias;

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

    alwaysInvalid(alwaysInvalid) {
        if (this.callingConfigureMethod('alwaysInvalid')) {
            //change default hidden state
            this._alwaysInvalid = arguments.length?!!alwaysInvalid:true;

            //chain
            return this;
        }
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

                            //dont fail on undefined method, as we may have extra data in the configure object
                            const method = methods.lookup[info.method];
                            if (method !== undefined) {
                                method.call(this, info.param || info.params || undefined);
                            }
                        }
                    }

                    //as we are potentially dealing with perceived order of configure properties when defining (e.g. int comes before options) we should sort the keys based on this!
                    //build key info once so the search does not have to do a ton of lookups!
                    let index = 0;
                    const keys = Object.keys(info).map(key => {
                        if (key !== 'ordered') {
                            const method = methods.lookup[key];

                            if (method !== undefined) {
                                return {
                                    index: index++,//this is the order as defined in the original javascript object. Remember this is not guaranteed!
                                    priority: method.priority,
                                    method: method,
                                    params: info[key],
                                };
                            }
                        }
                    }).filter(key => !!key);//filter //dont on empty method. Dont fail as we may have passed in extra data in the configure object for some reason!

                    //sort
                    keys.sort((a, b) => {
                        //sort by priority descending, index ascending
                        //so if an item is specified with a high priority, it will be first!
                        return b.priority - a.priority || a.index - b.index;
                    });

                    //execute all calls!
                    for (let key of keys) {
                        key.method.call(this, key.params);
                    }
                }
            }

            //chain
            return this;
        }
    }
    
    //configuration conversion
    emptyValue(value) {
        if (this.callingConfigureMethod('empty')) {
            //add handler
            this._addProcessHandler(new ProcessHandlerEmptyValue(value));

            //chain
            return this;
        }
    }

    bool(allowNull) {
        if (this.callingConfigureMethod('bool')) {
            //add handler
            this._addProcessHandler(new ProcessHandlerConvertBool(allowNull));

            //chain
            return this;
        }
    }

    int(allowNull=false) {
        if (this.callingConfigureMethod('int')) {
            //convert value to int, force indicates this the value will be forced to exist

            //add handler
            this._addProcessHandler(new ProcessHandlerConvertInt(allowNull));

            //chain
            return this;
        }
    }

    float(allowNull=false) {
        if (this.callingConfigureMethod('float')) {
            //convert value to float, force indicates this the value will be forced to exist

            //add handler
            this._addProcessHandler(new ProcessHandlerConvertFloat(allowNull));

            //chain
            return this;
        }
    }

    string(allowNull=false) {
        if (this.callingConfigureMethod('string')) {
            //convert value to string, force indicates this the value will be forced to exist

            //add handler
            this._addProcessHandler(new ProcessHandlerConvertString(allowNull));

            //chain
            return this;
        }
    }

    json(allowNull=false, error=null) {
        if (this.callingConfigureMethod('json')) {
            //convert value to json

            //add handler
            this._addProcessHandler(new ProcessHandlerConvertJson(allowNull, error));

            //chain
            return this;
        }
    }

    //configuration hide
    hideLabel(hide) {
        if (this.callingConfigureMethod('hideLabel')) {
            this._hideLabel = arguments.length?!!hide:true;

            //chain
            return this;
        }
    }

    hideDescendantLabels(hide) {
        if (this.callingConfigureMethod('hideDescendantLabels')) {
            this._hideDescendantLabels = arguments.length?!!hide:true;

            //chain
            return this;
        }
    }

    //configuration actions
    trigger(actions, value, context=null) {
        if (this.callingConfigureMethod('action')) {
            if (Array.isArray(actions)) {
                //multiple
                for (let action of actions) {
                    this._addTrigger(value, action, context, false);
                }
            } else {
                //single
                this._addTrigger(value, actions, context, false);
            }

            //chain
            return this;
        }
    }

    triggers() {
        //shortcut
        return this.action(...arguments);
    }

    action(actions, callbacks) {
        if (this.callingConfigureMethod('action')) {
            //how many actions
            if (Array.isArray(actions)) {
                //multiple actions, how many callbacks
                for(let action of actions) {
                    if (Array.isArray(callbacks)) {
                        //multiple callbacks
                        for (let callback of callbacks) {
                            this._addActionHandler(action, callback);
                        }
                    } else {
                        //single callback
                        this._addActionHandler(action, callbacks);
                    }
                }
            } else {
                //single action, how many callbacks?
                if (Array.isArray(callbacks)) {
                    //multiple callbacks
                    for (let callback of callbacks) {
                        this._addActionHandler(actions, callback);
                    }
                } else {
                    //single callback
                    this._addActionHandler(actions, callbacks);
                }
            }

            //chain
            return this;
        }
    }

    actions() {
        //shortcut
        this.action(...arguments);
    }

    //callbacks
    read(callbacks) {
        if (this.callingConfigureMethod('read')) {
            if (Array.isArray(callbacks)) {
                for(let callback of callbacks) {
                    this._addCustomReadHandler(callback);
                }
            } else {
                this._addCustomReadHandler(callbacks);
            }

            //chain
            return this;
        }
    }

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

    output(callbacks) {
        if (this.callingConfigureMethod('output')) {
            if (Array.isArray(callbacks)) {
                for(let callback of callbacks) {
                    this._addCustomOutputHandler(callback);
                }
            } else {
                this._addCustomOutputHandler(callbacks);
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

    before(callbacks) {
        if (this.callingConfigureMethod('before')) {
            if (Array.isArray(callbacks)) {
                for(let callback of callbacks) {
                    this._addCustomBeforeHandler(callback);
                }
            } else {
                this._addCustomBeforeHandler(callbacks);
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

    after(callbacks) {
        if (this.callingConfigureMethod('after')) {
            if (Array.isArray(callbacks)) {
                for(let callback of callbacks) {
                    this._addCustomAfterHandler(callback);
                }
            } else {
                this._addCustomAfterHandler(callbacks);
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

    getter(callbacks) {
        if (this.callingConfigureMethod('getter')) {
            if (Array.isArray(callbacks)) {
                for(let callback of callbacks) {
                    this._addCustomGetterHandler(callback);
                }
            } else {
                this._addCustomGetterHandler(callbacks);
            }

            //chain
            return this;
        }
    }

    getters() {
        return this.getter(...arguments);
    }
    
    setter(callbacks) {
        if (this.callingConfigureMethod('setter')) {
            if (Array.isArray(callbacks)) {
                for(let callback of callbacks) {
                    this._addCustomSetterHandler(callback);
                }
            } else {
                this._addCustomSetterHandler(callbacks);
            }

            //chain
            return this;
        }
    }

    setters() {
        return this.setter(...arguments);
    }

    empty(callbacks) {
        if (this.callingConfigureMethod('empty')) {
            if (Array.isArray(callbacks)) {
                for(let callback of callbacks) {
                    this._addCustomEmptyHandler(callback);
                }
            } else {
                this._addCustomEmptyHandler(callbacks);
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

    //public get methods
    getName() {
        return this._name;
    }

    getOwnErrors() {
        if (this.callingStartedMethod('getOwnErrors')) {
            return this._request._getErrorsWithPath(this.path).map(error => error.error);
        }
    }

    getErrorDetails() {
        if (this.callingActiveMethod('getErrorDetails')) {
            this._request._getErrorsWithPath(this.path);
        }
    }

    getRawValue(defaultValue=undefined) {
        if (this.callingActiveMethod('getRawValue')) {
            return this._requestRawValue;
        }
    }

    getValue() {
        return undefined;
    }

    getValues() {
        //shortcut
        return this.getValue();
    }

    getUnsafeValue(defaultValue=undefined) {
        return defaultValue;
    }

    getUnsafeValues(defaultValue=undefined) {
        return this.getUnsafeValue(defaultValue);
    }

    getValueWithoutGetter() {
        return undefined;
    }

    getValuesWithoutGetters() {
        //shortcut
        return this.getValueWithoutGetter();
    }

    getUnsafeValueWithoutGetter(defaultValue=undefined) {
        return defaultValue;
    }

    getUnsafeValuesWithoutGetters(defaultValue=undefined) {
        return this.getUnsafeValueWithoutGetter(defaultValue);
    }

    getContext(name, defaultValue=undefined) {
        return this._getContext(name, defaultValue);
    }

    //public set methods
    setValue(value) {
        if (this.callingActiveMethod('setValue')) {
            this._setValue(value, false, true);
        }

        //chain
        return this;
    }

    setValueWithoutSetter(value) {
        if (this.callingActiveMethod('setValueWithoutSetter')) {
            this._setValue(value, false, false);
        }

        //chain
        return this;
    }

    setContext() {
        if (arguments.length >= 1 && typeof arguments[0] === 'object') {
            //set object of values
            const details = arguments[0];
            const exposed = arguments[1] || false;

            //set by object keys
            for (let key of Object.keys(details)) {
                const value = details[key];
                this._setContext(key, value, exposed);
            }

        } else if (arguments.length >= 2) {
            //set by name/value
            const key = arguments[0];
            const value = arguments[1];
            const exposed = arguments[2] || false;
            this._setContext(key, value, exposed);
        }
    }

    //private clear methods
    clearValue() {
        if (this.callingActiveMethod('clearValue')) {
            this._clearValue();
        }

        //chain
        return this;
    }

    //public merge methods
    mergeValue(value) {
        if (this.callingActiveMethod('mergeValue')) {
            this._setValue(value, true, true);
        }

        //chain
        return this;
    }

    mergeValueWithoutSetter(value) {
        if (this.callingActiveMethod('mergeValueWithoutSetter')) {
            this._setValue(value, true, false);
        }

        //chain
        return this;
    }

    //public add methods
    addError(error) {
        //add error relating to self!
        if (this.callingActiveMethod('addError')) {
            //get details for the error
            this._pipeError(error, this.formeClass, this._errorPath, this._errorName);
        }
    }

    //public clear methods
    clearValue() {
        if (this.callingActiveMethod('clearValue')) {
            this._clearValue();
        }

        //chain
        return this;
    }

    //public remove methods
    removeHandler(type) {
        if (this.callingInactiveMethod('getOwnErrors')) {
            const type = this.constructor._lookupHandlerClass(type);
            if (type === undefined) {
                throw new Error(`unknown ${this.formeClass}.removeHandler() type '${type}'`)
            } else {
                this._removeValidateHandler(type);
            }
        }
    }
}

//expose
module.exports = FormeBase;