'use strict';

//module imports
const clone = require('clone');
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

//classes
class FormeContainer extends FormeBase {
    constructor(type, form, page, name) {
        super(type || 'FormeContainer', form, page, name || 'undefined');

        this._ordered = [];//this stores inputs and components in the order that they were added!
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

    //private actions
    _actions() {
        return this._actionHandlers === null || this._actionHandlers.length === 0 ? Promise.resolve() : this._nextActionHandler(this._actionHandlers, 0);
    }

    //private add methods
    _addInput(input) {
        this._ordered.push(input);

        this._inputs.push(input);
        return input;
    }

    _addComponent(component) {
        this._ordered.push(component);

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

    //private component methods
    _componentsBuild() {
        //keep building until the build queue is empty. This is because a component might add a component!
        if (this._componentBuildQueue.length === 0) {
            //nothing left to do
            return Promise.resolve();
        } else {
            //get all items from the queue (todo: eventually this will mean that we can chain components inside components)
            const components = this._componentBuildQueue;
            this._componentBuildQueue = [];

            //build this chunk of components
            return this._componentsBuildChunk(components)
            
            //chain any further components (note this will only happen if components were added during the last chunk)
            .then(() => this._componentsBuild());
        }
    }
    
    _componentsBuildChunk(components) {
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
                const details = component._details;

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
                handlers.push(() => this._form._driver.compose(this._form, this._form._request._page, component, details));

                //anything to execute? (there should be because we added the driver)
                return this._nextComposeHandler(component, details, handlers, 0)

                //all .compose() handlers have had a chance to execute, so now we should process what is stored inside teh component!
                .then(() => {
                    //any inputs belonging to this component
                    const inputs = component._inputs;

                    //we need to apply any configurations set for the component, onto each input
                    if (inputs && inputs.length) {
                        //get the input configuration from the component (do this once as its lots of data processing potentially)
                        const configuration = component._inputConfiguration;

                        //iterate the inputs
                        for (let input of inputs) {
                            //apply all component configurations!
                            input.configure(configuration);

                            //lets figure out how this input will be attached to the form
                            const oldName = input._outputName;
                            const uniqueName = `__forme_component_input__${component._name}__${oldName}`;
                            let outputName;

                            if (component._hasContainerPrefix()) {
                                //component is a container so we have to use the inputs output name
                                outputName = oldName;
                            } else {
                                //component has single input, so we use the components name instead!
                                outputName = component._name;
                            }

                            //we need to now swizzle the name of the input otherwise we will break when there are duplicates of the component
                            input.name(uniqueName);
                            input.alias(outputName);

                            //prepend input group with component details: component.name / component.group / input.group
                            input.group(component._prefixedGroups, false);

                            //now add the input to the components container
                            component.container._addInput(input);
                        }
                    }
                });
            }));
        }
    }
    
    _componentsValidate() {
        if (this._components.length === 0) {
            //nothing to validate
            return Promise.resolve();
        } else {
            //start validation
            return this._nextComponentValidate(this._components, 0)
        }
    }

    _componentsSuccess() {
        if (this._components.length === 0) {
            //nothing to validate
            return Promise.resolve();
        } else {
            //start validation
            return this._nextComponentSuccess(this._components, 0)
        }
    }

    _componentsFail() {
        if (this._components.length === 0) {
            //nothing to validate
            return Promise.resolve();
        } else {
            //start validation
            return this._nextComponentFail(this._components, 0)
        }
    }
    
    _componentsSubmit() {
        if (this._components.length === 0) {
            //nothing to validate
            return Promise.resolve();
        } else {
            //start validation
            return this._nextComponentSubmit(this._components, 0)
        }
    }

    _componentsActions() {
        if (this._components.length === 0) {
            //nothing to validate
            return Promise.resolve();
        } else {
            //start validation
            return this._nextComponentActions(this._components, 0)
        }
    }

    _componentsDone() {
        if (this._components.length === 0) {
            //nothing to validate
            return Promise.resolve();
        } else {
            //start validation
            return this._nextComponentDone(this._components, 0)
        }
    }

    //private state methods
    _stateInputs() {
        //the inputs to be provided when calling _createState()
        return this._inputs;
    }

    _stateHandlerValues(values) {
        //extract the values to be passed to the handler (by default this is just the values passed in)
        return values;
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

    _nextComposeHandler(component, details, handlers, index=0) {
        if (handlers.length === 0) {
            return Promise.resolve();
        } else {
            return utils.promise.result(this._executeComposeHandler(handlers[index], component, details))
            .then(halt => halt === true || ++index === handlers.length ? Promise.resolve() : this._nextComposeHandler(component, details, handlers, index));
        }
    }

    _nextValidateHandler(handlers, index=0) {
        const handler = handlers[index];

        //build state info (let the extended container dictate what info is returned).
        //this lets us abstract the validation data
        const state = this._createState();

        //iterate
        return new Promise((resolve, reject) => {
            //clone the old values so that we have something to reference back to!
            const oldValues = clone(state.values);

            //execute the handler with the state values
            return handler.execute(this, {values: this._stateHandlerValues(state.values)})
            .then(() => {
                //process the inputs and see if any values have changed
                for (let input of state.inputs) {
                    //fetch the value for this input
                    const newValue = utils.group.find.value(state.values, input.path(), null);
                    const oldValue = utils.group.find.value(oldValues, input.path(), null);

                    //has it changed?
                    if (newValue !== oldValue) {
                        //yup so we need to update the value in the form!
                        this._form._setInputNameValue(input._name, newValue);
                    }
                }

                //woot handler executed successfully!
                resolve();
            })
            .catch(err => {
                //errors received here are actually validation errors which need adding to the form!
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
                return reject(new Error('wtf'));
            });
        })

        //next validation handler
        .then(() => ++index === handlers.length ? Promise.resolve() : this._nextValidateHandler(handlers, index))

        //unhandled errors
        .catch(err => Promise.reject(this._form._catchError(err)));
    }

    _nextActionHandler(handlers, index=0) {
        return this._executeMultipleActions(handlers[index].action, handlers[index].callback)
        .then(() => ++index === handlers.length ? Promise.resolve() : this._nextActionHandler(handlers, index));
    }

    //private next methods
    _nextComponentValidate(components, index=0) {
        return utils.promise.result(components[index]._validate())
        .then(halt => halt || ++index === components.length ? Promise.resolve() : this._nextComponentValidate(components, index));
    }

    _nextComponentValid(components, index=0) {
        return utils.promise.result(components[index]._valid())
        .then(halt => halt || ++index === components.length ? Promise.resolve() : this._nextComponentValid(components, index));
    }

    _nextComponentInvalid(components, index=0) {
        return utils.promise.result(components[index]._invalid())
        .then(halt => halt || ++index === components.length ? Promise.resolve() : this._nextComponentInvalid(components, index));
    }

    _nextComponentSuccess(components, index=0) {
        return utils.promise.result(components[index]._success())
        .then(halt => halt || ++index === components.length ? Promise.resolve() : this._nextComponentSuccess(components, index));
    }

    _nextComponentFail(components, index=0) {
        return utils.promise.result(components[index]._fail())
        .then(halt => halt || ++index === components.length ? Promise.resolve() : this._nextComponentFail(components, index));
    }

    _nextComponentSubmit(components, index=0) {
        return utils.promise.result(components[index]._submit())
        .then(halt => halt || ++index === components.length ? Promise.resolve() : this._nextComponentSubmit(components, index));
    }

    _nextComponentActions(components, index=0) {
        return utils.promise.result(components[index]._actions())
        .then(halt => halt || ++index === components.length ? Promise.resolve() : this._nextComponentActions(components, index));
    }

    _nextComponentDone(components, index=0) {
        return utils.promise.result(components[index]._done())
        .then(halt => halt || ++index === components.length ? Promise.resolve() : this._nextComponentDone(components, index));
    }

    //private execute methods
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
        return new this._form._driverClass.inputClass(this._form, this._page, name).configure(configure);
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

        //add
        //noinspection Annotator
        return new this._form._driverClass.componentClass(this._form, this._page, name, type).configure(configure);
    }

    _createState() {
        const inputs = this._stateInputs();
        return {
            inputs: inputs,
            values: this._form._request._fetchValues(inputs, false, true, false, true, true, false),
        };
    }

    //configure methods
    add(details) {
        if (this.callingConfigureMethod('add')) {
            //how many?
            if (Array.isArray(details)) {
                //multiple
                return details.map(details => this._addInput(this._createInput(details)));
            } else {
                //single
                return this._addInput(this._createInput(details));
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
                    return details.map(details => this._addComponent(this._createComponent(details)));
                } else if (typeof details === 'object') {
                    //single configure object (to be validated in _component())
                    return this._addComponent(this._createComponent(details));
                }
            } else if (arguments.length >= 2) {
                //passed as params
                return this._addComponent(this._createComponent(...arguments));
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