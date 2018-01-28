'use strict';

//module imports
const format = require('string-template');

//local imports
const utils = require('./utils');

const FormeBase = require('./base');
const FormeInput = require('./input');

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

//functions
function handleComposeResult(inputs, out) {
    if (inputs instanceof FormeInput || Array.isArray(inputs)) {
        //how many?
        if (Array.isArray(inputs)) {
            //multiple
            for (let input of inputs) {
                if (input instanceof FormeInput) {
                    out.push(input);
                } else {
                    return Promise.reject(this._createError(`invalid forme compose result '${input}'`));
                }
            }
        } else {
            //single
            out.push(inputs);
        }

        //as we had inputs we count this as a halt!
        return true;
    } else {
        //nope so return whatever was passed in
        return inputs;
    }
}

//classes
class FormeContainer extends FormeBase {
    constructor(type, form, name) {
        super(type || 'FormeContainer', form, name || 'undefined');

        this._form = form;
        this._inputs = [];
        this._components = [];
        this._componentBuildQueue = [];//this is a queue of components waiting to build

        this._loadHandlers = [];
        this._buildHandlers = [];
        this._composeHandlers = [];
        this._actionHandlers = [];
    };

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

    //private configuration methods
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

    //private add methods
    _addInput(input) {
        this._inputs.push(input);
        return input;
    }

    _addComponent(component) {
        this._components.push(component);
        this._componentBuildQueue.push(component);
        return component;
    }

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
        this._validateHandlers.push(new ContainerValidateHandlerCustom(callback, error));
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
        if (source instanceof FormeInput) {
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

    //private build methods
    _buildComponentsProcessQueue() {
        //keep building until the build queue is empty. This is because a component might add a component!
        if (this._componentBuildQueue.length === 0) {
            //nothing left to do
            return Promise.resolve();
        } else {
            //get all items from the queue
            const components = this._componentBuildQueue;
            this._componentBuildQueue = [];

            return this._buildComponents(components)
            .then(() => this._buildComponentsProcessQueue());
        }
    }

    _buildComponents(components) {
        //allow the various objects to compose this component.
        //this is a special case where we allow any part of the form to add handlers into the mix!
        if (components === null || components.length === 0) {
            //nothing to do
            return Promise.resolve();
        } else {
            //build components at once!
            return Promise.all(components.map(component => {
                //build the details for this component

                //get the details for the component
                const details = component.details;

                //build list of handlers
                const handlers = [];

                //page handlers
                if (this._form._request._page !== null && this._form._request._page._composeHandlers !== null && this._form._request._page._composeHandlers.length) {
                    for(let handler of this._form._request._page._composeHandlers) {
                        handlers.push(handler)
                    }
                }

                //form handlers
                if (this._form._composeHandlers !== null && this._form._composeHandlers.length) {
                    for(let handler of this._form._composeHandlers) {
                        handlers.push(handler)
                    }
                }

                //driver handler
                handlers.push(() => {
                    return this._form._driver.compose(this._form, this._form._request._page, this._form._request._page || this._form, component, details)
                    .then(inputs => {
                        //add to inputs storage
                        handleComposeResult(inputs, out);

                        //chain the inputs
                        return out;
                    });
                });

                //anything to execute? (there should be because we added the driver)
                if (handlers.length === 0) {
                    return Promise.resolve();
                } else {
                    //ok execute handlers list in order and halt on first true!
                    const out = [];

                    //execute compose handlers
                    return this._nextComposeHandler(component, details, handlers, 0, out)

                    //process all built inputs
                    .then(inputs => {
                        //we need to apply any configurations set for the component, onto each input
                        if (inputs && inputs.length) {
                            //get the input configuration from the component (do this once as its lots of data processing potentially)
                            const configuration = component.inputConfiguration;

                            //iterate the inputs
                            for (let input of inputs) {
                                //apply some details to the input
                                input._component = component;

                                //apply all component configurations!
                                input.configure(configuration);

                                //component 'name' is actually a group prefix for all inputs!
                                if (component._name) {
                                    input.group(component._name, false);
                                }
                            }

                            //chain teh inputs
                            return inputs;
                        }
                    });
                }
            }));
        }
    }

    //private handler methods
    _nextLoadHandler(index) {
        return utils.promise.result(this._executeLoadHandler(this._loadHandlers[index]))
        .then(() => ++index === this._loadHandlers.length ? Promise.resolve() : this._nextLoadHandler(index));
    }

    _nextBuildHandler(index) {
        return utils.promise.result(this._executeBuildHandler(this._buildHandlers[index]))
        .then(() => ++index === this._buildHandlers.length ? Promise.resolve() : this._nextBuildHandler(index));
    }

    _nextComposeHandler(component, details, handlers, index=0, out) {
        return utils.promise.result(this._executeComposeHandler(component, details, handlers[index]))
        .then(inputs => {
            //add to inputs storage
            inputs = handleComposeResult(inputs, out);

            //check for halt/end
            if (inputs === true || ++index === handlers.length) {
                //finished so check
                if (out.length === 0) {
                    //had nothing
                    return Promise.resolve();
                } else {
                    //had inputs (this also counts as handled to the caller)
                    return Promise.resolve(out);
                }
            } else {
                //continue
                return this._nextComposeHandler(component, details, handlers, index, out);
            }
        });
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
            //unhandled errors (dont catch because its a validation error)
            this._form._catchError(err);
        });
    }

    _nextActionHandler(index) {
        return this._executeMultipleActions(this._actionHandlers[index].action, this._actionHandlers[index].callback)
        .then(() => ++index === this._actionHandlers.length ? Promise.resolve() : this._nextActionHandler(index));
    }

    //private execute methods
    _executeBuildHandler(handler) {
        //should be overridden
        return Promise.resolve();
    }

    _executeComposeHandler(component, handler) {
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

    //private add methods
    _add(name) {
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

        //add and configure
        //noinspection Annotator
        return this._addInput(new this._form._driverClass.inputClass(this._form, name)).configure(configure);
    }

    _component(name, component=undefined, params=undefined) {
        //get the details when passed in
        let configure = null;
        if (name && typeof name === 'object') {
            //passed as configure object, copy it so we dont kill the passed in data
            configure = Object.assign({}, name);
            name = configure.name || undefined;
            component = configure.component || undefined;
            params = configure.params || undefined;

            //cleanup some keys
            delete configure.name;
            delete configure.component;
            delete configure.params;
        }

        //validate name (if it was provided)
        if (name && typeof name !== 'string') {
            throw this._createError(`invalid forme component name '${name}'`);
        }

        //validate component type
        if (!component || typeof component !== 'string') {
            throw this._createError(`invalid forme component type '${component}'`);
        }

        //add
        //noinspection Annotator
        return this._addComponent(new this._form._driverClass.componentClass(this._form, name, component, params)).configure(configure);
    }

    //configure methods
    add(details) {
        if (this.callingConfigureMethod('add')) {
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

    component() {
        if (this.callingConfigureMethod('component')) {
            if (arguments.length === 1) {
                //passed as array
                const details = arguments[0];

                //how many?
                if (Array.isArray(details)) {
                    //multiple configure objects (to be validated in _component())
                    return details.map(details => this._component(details));
                } else if (typeof details === 'object') {
                    //single configure object (to be validated in _component())
                    return this._component(details);
                }
            } else if (arguments.length >= 2) {
                //passed as params
                return this._component(...arguments);
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

    remove(what) {
        const type = handlerLookup[what];
        if (type === undefined) {
            throw new Error(`unknown ${this._baseType}.remove() type '${what}'`)
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
}

//expose
module.exports = FormeContainer;