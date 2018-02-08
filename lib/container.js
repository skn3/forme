'use strict';

//module imports
const clone = require('clone');
const format = require('string-template');

//local imports
const utils = require('./utils');

const FormeBase = require('./base');

const ContainerValidateHandlerRequire = require('./handlers/container/validate/containerValidateHandlerRequire');
const ContainerValidateHandlerCustom = require('./handlers/container/validate/containerValidateHandlerCustom');

const {
    FormeConfigurableMethod,
    FormeConfigurableMethodPointer,
    FormeConfigurableOverride,
    FormeConfigurableParam,
    FormeConfigurableString,
    FormeConfigurableObject,
    FormeConfigurableArray,
    FormeConfigurableCallbacks,
    FormeConfigurableStrings,

    FormeConfigurableExportCallbacks,
    FormeConfigurableExportValidateHandlers,
    FormeConfigurableExportArrayObjects,
} = require('./configurable');

//locals
const handlerLookup = {
    require: ContainerValidateHandlerRequire,
    validate: ContainerValidateHandlerCustom,
};

//classes
class FormeContainer extends FormeBase {
    constructor(name) {
        super(name || 'undefined');

        this._queue = [];//queue of elements that need building
        this._elements = [];//this stores inputs and components in the order that they were added!
        this._inputs = [];//store inputs
        this._components = [];//store components

        this._loadHandlers = [];
        this._buildHandlers = [];
        this._composeHandlers = [];
        this._actionHandlers = [];
    };

    //static private functions
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

    //private build configuration methods
    _buildConfigurableMethods() {
        return Object.assign(super._buildConfigurableMethods(), {
            //container.load(callback(s))
            load: new FormeConfigurableMethod('load', [
                new FormeConfigurableOverride([
                    new FormeConfigurableCallbacks(['callback', 'callbacks'], true),
                ], true),
            ], new FormeConfigurableExportCallbacks('_loaderHandlers')),

            //container.build(callback(s))
            build: new FormeConfigurableMethod('build', [
                new FormeConfigurableOverride([
                    new FormeConfigurableCallbacks(['callback', 'callbacks'], true),
                ], true),
            ], new FormeConfigurableExportCallbacks('_buildHandlers')),

            //container.action(string(s), callback(s))
            action: new FormeConfigurableMethod('action', [
                new FormeConfigurableOverride([
                    new FormeConfigurableStrings(['action', 'actions'], true),
                    new FormeConfigurableCallbacks(['callback', 'callbacks'], true),
                ], false),
            ], new FormeConfigurableExportArrayObjects('_actionHandlers')),

            //container.require(object(s), string, error)
            require: new FormeConfigurableMethod('require', [
                new FormeConfigurableOverride([
                    new FormeConfigurableObject(['conditions', 'condition'], true),
                    new FormeConfigurableString(['op', 'operation'], true),
                    new FormeConfigurableString('error', false),
                ], false),
            ], new FormeConfigurableExportValidateHandlers(ContainerValidateHandlerRequire)),

            //container.add(*multiple*)
            add: new FormeConfigurableMethod('add', [
                //container.add(name)
                new FormeConfigurableOverride([
                    new FormeConfigurableString(['add', 'input', 'inputs', 'configuration'], true),
                ], true),

                //container.add(array)
                new FormeConfigurableOverride([
                    new FormeConfigurableArray(['add', 'input', 'inputs', 'configuration'], true),
                ], true),

                //container.add(object)
                new FormeConfigurableOverride([
                    new FormeConfigurableObject(['add', 'input', 'inputs', 'configuration'], true),
                ], true),
            ]),
            input: new FormeConfigurableMethodPointer('add'),
            inputs: new FormeConfigurableMethodPointer('add'),

            //container.component(*multiple*)
            component: new FormeConfigurableMethod('component', [
                //container.component(name, component, param)
                new FormeConfigurableOverride([
                    new FormeConfigurableString(['name'], true),
                    new FormeConfigurableString(['component'], true),
                    new FormeConfigurableParam(['param', 'params'], false),
                ], false),

                //container.component(array)
                new FormeConfigurableOverride([
                    new FormeConfigurableArray(['component', 'components', 'configuration'], true),
                ], true),

                //container.component(object)
                new FormeConfigurableOverride([
                    new FormeConfigurableObject(['component', 'components', 'configuration'], true),
                ], true),
            ]),
            components: new FormeConfigurableMethodPointer('component'),

            //--- callbacks ---

            //container.validate(callback(s))
            validate: new FormeConfigurableMethod('validate', [
                new FormeConfigurableOverride([
                    new FormeConfigurableCallbacks(['callback', 'callbacks'], true),
                    new FormeConfigurableString('error', false),
                ], true),
            ], new FormeConfigurableExportCallbacks('_validateHandlers')),
        });
    }

    //private build methods
    _buildLoadHandlers() {
        return this._loadHandlers === null || this._loadHandlers.length === 0 ? Promise.resolve() : this._nextLoadHandler(this._loadHandlers, 0);
    }

    _buildBuildHandlers() {
        //.build() the form
        return this._buildHandlers === null || this._buildHandlers.length === 0 ? Promise.resolve() : this._nextBuildHandler(this._buildHandlers, 0);
    }

    _buildChildren() {
        //keep building until the build queue is empty. This is because a element might add a element!
        if (this._queue.length === 0) {
            //nothing left to do
            return Promise.resolve();
        } else {
            //get all items from the queue
            const elements = this._queue;
            this._queue = [];

            //build this chunk of elements
            return Promise.all(elements.map(element => element._build()))

            //chain any further elements (note this will only happen if elements were added during the last chunk)
            .then(() => this._buildChildren());
        }
    }

    //private process methods
    _processExecutionStateChanges(oldState, newState) {
        //process to see if any values have changed
        for (let input of this._inputs) {
            //fetch the value for this element
            const newValue = utils.group.find.value(newState.values, input.path(), null);
            const oldValue = utils.group.find.value(oldState, input.path(), null);

            //has it changed?
            if (newValue !== oldValue) {
                //yup so we need to update the value in the form!
                this._form._setInputNameValue(input._name, newValue);
            }
        }
    }

    //private execute methods
    _executeChildren() {
        //skip if no children!
        if (this._elements.length === 0) {
            return Promise.resolve();
        }

        //iterate elements 1 by 1, and then reject if ANY error was found (after)
        let errors = [];
        let index = 0;

        const execute = () => {
            const next = () => ++index === this._elements.length ? Promise.resolve() : execute();

            return this._elements[index]._execute()
            .then(next)
            .catch(err => {
                errors.push(err);
                return next();
            });
        };

        return execute()
        .then(() => errors.length ? Promise.reject(null) : Promise.resolve());
    }

    //private actions
    _actions() {
        return this._actionHandlers === null || this._actionHandlers.length === 0 ? Promise.resolve() : this._nextActionHandler(this._actionHandlers, 0);
    }

    //private add methods
    _addElement(element) {
        //add to lists
        this._queue.push(element);
        this._elements.push(element);

        //add to correct store list
        switch(element.formeClass) {
            case 'input':
                this._addInput(element);
                break;
            case 'component':
                this._addComponent(element);
                break;
        }

        //chain
        return element;
    }

    _addInput(input) {
        this._inputs.push(input);

        //add to form
        if (!(this instanceof this._form._driverClass.formClass)) {
            this._form._addInput(input);
        }
    }

    _addComponent(component) {
        this._components.push(component);

        //add to form
        if (!(this instanceof this._form._driverClass.formClass)) {
            this._form._addComponent(component);
        }
    }

    //private add handler methods
    _addLoadHandler(callback) {
        this._loadHandlers.push(callback);
    }

    _addBuildHandler(callback) {
        this._buildHandlers.push(callback);
    }

    _addComposeHandler(callback) {
        this._composeHandlers.push(callback);
    }

    _addCustomValidateHandler(callback, error) {
        this._addValidateHandler(new ContainerValidateHandlerCustom(callback, error));
    }

    _addActionHandlers(actions, callback) {
        if (Array.isArray(actions)) {
            for(let action of actions) {
                this._actionHandlers.push({
                    action: action,
                    callback: callback,
                });
            }
        } else {
            this._actionHandlers.push({
                action: actions,
                callback: callback,
            })
        }
    }
    
    //private find methods
    _findInput(source) {
        if (source instanceof this._form._driverClass.inputClass) {
            return source;
        } else {
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
            for(let input of this._form._inputs) {
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

    //private next handler methods
    _nextLoadHandler(handlers, index=0) {
        return utils.promise.result(this._executeLoadHandler(handlers[index]))
        .then(() => ++index === handlers.length ? Promise.resolve() : this._nextLoadHandler(handlers, index));
    }

    _nextBuildHandler(handlers, index=0) {
        return utils.promise.result(this._executeBuildHandler(handlers[index]))
        .then(() => ++index === handlers.length ? Promise.resolve() : this._nextBuildHandler(handlers, index));
    }

    _nextActionHandler(handlers, index=0) {
        return this._executeMultipleActions(handlers[index].action, handlers[index].callback)
        .then(() => ++index === handlers.length ? Promise.resolve() : this._nextActionHandler(handlers, index));
    }

    //private execute handler methods
    _executeBuildHandler(handler) {
        //should be overridden
        return Promise.resolve();
    }

    _executeComposeHandler(handler, component, details) {
        //should be overridden
        return Promise.resolve(true);//resolve that the component was dealt with!
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

    //private create methods
    _createInput(name) {
        //get the details when passed in
        let configure = null;
        if (name && typeof name === 'object') {
            //passed as configure object, copy it so we dont kill the passed in data
            configure = Object.assign({}, name);
            name = configure.name || undefined;

            //cleanup some keys
            delete configure.name;
        }

        //validate
        if (!name || typeof name !== 'string') {
            throw this._createError(`invalid forme input name '${name}'`);
        }

        //create and configure

        //noinspection Annotator
        const input = new this._form._driverClass.inputClass(name);

        //setup links
        input._form = this._form;
        input._page = this._page;
        input._component = this instanceof this._form._driverClass.componentClass?this:this._component;//reference self (when component) or pass down the component chain!

        //initial configure
        return input.configure(configure);
    }

    _createComponent(name, type=undefined) {
        //get the details when passed in
        let configure = null;
        if (name && typeof name === 'object') {
            //passed as configure object, copy it so we dont kill the passed in data
            configure = Object.assign({}, name);
            name = configure.name || undefined;
            type = configure.type || type || undefined;

            //cleanup some keys
            delete configure.name;
            delete configure.type;
        }

        //validate name (if it was provided)
        if (name && typeof name !== 'string') {
            throw this._createError(`invalid forme component name '${name}'`);
        }

        //validate component type
        if (!type || typeof type !== 'string') {
            throw this._createError(`invalid forme component type '${type}'`);
        }

        //create and configure

        //noinspection Annotator
        const component = new this._form._driverClass.componentClass(name, type);

        //setup links
        component._form = this._form;
        component._page = this._page;

        //initial configure
        return component.configure(configure);
    }

    _createExecutionState() {
        return {
            values: this._getInputValues(),
        };
    }

    //private get methods
    _getInputValues() {
        return this._form._request._fetchValues(this._inputs, false, true, false, true, true, false);
    }

    //configure methods
    add(details) {
        if (this.callingConfigureMethod('add')) {
            //how many?
            if (Array.isArray(details)) {
                //multiple
                return details.map(details => this._addElement(this._createInput(details)));
            } else {
                //single
                return this._addElement(this._createInput(details));
            }
        }
    }

    component() {
        if (this.callingConfigureMethod('component')) {
            if (arguments.length === 1) {
                //passed as array
                const details = arguments[0];

                //how many?
                if (Array.isArray(details)) {
                    //multiple configure objects (to be validated in _component())
                    return details.map(details => this._addElement(this._createComponent(details)));
                } else if (typeof details === 'object') {
                    //single configure object (to be validated in _component())
                    return this._addElement(this._createComponent(details));
                }
            } else if (arguments.length >= 2) {
                //passed as params
                return this._addElement(this._createComponent(...arguments));
            }
        }
    }

    components() {
        //shortcut
        return this.component(...arguments);
    }

    require(conditions, op, error) {
        if (this.callingConfigureMethod('require')) {
            //build list of arrays
            conditions = this.constructor._buildInputConditions(conditions);
            if (conditions.length) {
                this._validateHandlers.push(new ContainerValidateHandlerRequire(conditions, op, error));
            }

            //chain
            return this;
        }
    }

    required() {
        this.require(...arguments);
    }

    remove(what) {
        const type = handlerLookup[what];
        if (type === undefined) {
            throw new Error(`unknown ${this.formeClass}.remove() type '${what}'`)
        } else {
            this._removeValidateHandler(type);
        }
    }

    //callback methods
    load(callbacks) {
        if (this.callingConfigureMethod('load')) {
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

    build(callbacks) {
        if (this.callingConfigureMethod('build')) {
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

    compose(callbacks) {
        if (this.callingConfigureMethod('compose')) {
            if (Array.isArray(callbacks)) {
                for(let callback of callbacks) {
                    this._addComposeHandler(callback);
                }
            } else {
                this._addComposeHandler(callbacks);
            }

            //chain
            return this;
        }
    }

    action(actions, callbacks) {
        if (this.callingConfigureMethod('action')) {
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

    //state methods
    inputs() {
        return this._inputs.map(input => input._name);
    }

    templateVars() {
        return super.templateVars()
        .then(vars => new Promise((resolve, reject) => {
            //container vars
            Object.assign(vars, {
                children: utils.group.create.structure(this._elements),
            });

            //build all element.templateVars at once!
            return Promise.all(this._elements.map(element => {
                return element.templateVars()
                .then(elementVars => {
                    if (elementVars !== undefined) {
                        utils.group.addGroup(vars.children, element._outputName, element._group, elementVars);
                    }
                });
            }))

            //chain
            .then(() => resolve(vars))
            .catch(err => reject(err));
        }));
    }
}

//expose
module.exports = FormeContainer;