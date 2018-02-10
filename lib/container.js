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
const handlerClassLookup = {
    require: ContainerValidateHandlerRequire,
    validate: ContainerValidateHandlerCustom,
};

//classes
class FormeContainer extends FormeBase {
    constructor(name) {
        super(name || undefined);

        this._queue = [];//queue of elements that need building
        this._elements = [];//this stores inputs and components in the order that they were added!
        this._inputs = [];//store inputs. Inputs are always added to their container, regardless of the group/component/etc. This is because while we have a structure of sorts, inputs are always a flat list with unique names!
        this._components = [];//store components

        this._loadHandlers = [];
        this._composeHandlers = [];
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

    static _lookupHandlerClass(type) {
        const handlerClass = super._lookupHandlerClass(type);
        if (handlerClass) {
            return handlerClass;
        }
        return handlerClassLookup[type];
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

    //private build values methods
    _buildValues(options, parent) {
        if (this._buildValuesInclude(options)) {
            //not async, we should wrap in promise if thats what we want to do!
            parent = parent || {};

            //build groups
            const pointer = this._buildValueGroups(options, parent);

            //add elements to the pointer
            for (let element of this._elements) {
                //let the element do the building by passing in the pointer
                element._buildValues(options, pointer);
            }
        }

        //chain
        return parent;
    }

    //private build template methods
    _buildTemplateVars(options) {
        const vars = super._buildTemplateVars(options);
        vars.children = {};
        return vars;
    }

    _buildTemplateChildren(options, parent) {
        return Promise.all(this._elements.map(element => element._buildTemplate(options, parent)))
        .then(() => parent);
    }

    //private process methods
    _processElementMethodSteps(method, halt=true) {
        //skip if no children!
        if (this._elements.length === 0) {
            return Promise.resolve();
        }

        //build steps
        const steps = this._elements.map(element => () => element[method]());

        //execute
        let errors = [];
        return steps.reduce((prev, curr) => {
            return prev.then(() => (halt && this._request._halt)? Promise.resolve() : curr.call(this))
            .catch(err => {
                //catch the error, but see if we still continue?
                errors.push(err);
                if (!halt) {
                    //continue because!
                    return curr.call(this);
                }
            })
        }, Promise.resolve())
        .then(() => {
            //convert success into error (the first error only)
            if (errors.length) {
                return Promise.reject(errors[0]);
            }
        });
    }

    _processExecutionStateChanges(oldState, newState) {
        //process to see if any values have changed
        for (let element of this._elements) {
            //fetch the value for this element
            const newValue = utils.structure.find.path(newState.values, element._ownPathSegments, null);
            const oldValue = utils.structure.find.path(oldState, element._ownPathSegments, null);

            //has it changed?
            if (newValue !== oldValue) {
                //yup so we need to update the value in the form!
                this._form._setNamedValue(element._name, newValue);
            }
        }
    }

    //private execute methods
    _executeChildren() {
        return this._processElementMethodSteps('_execute');
    }

    //private invalid methods
    _invalidChildren() {
        return this._processElementMethodSteps('_invalid');
    }

    //private valid methods
    _validChildren() {
        return this._processElementMethodSteps('_valid');
    }

    //private success methods
    _successChildren() {
        return this._processElementMethodSteps('_success');
    }

    //private fail methods
    _failChildren() {
        return this._processElementMethodSteps('_fail');
    }

    //private submit methods
    _submitChildren() {
        return this._processElementMethodSteps('_submit');
    }

    //private trigger/action methods
    _armTriggersChildren() {
        return this._processElementMethodSteps('_armTriggers');
    }

    _fireTriggerActionsChildren() {
        return this._processElementMethodSteps('_fireTriggerActions');
    }

    //private done methods
    _doneChildren() {
        return Promise.resolve();
    }

    //private pipe methods
    _pipeAddInput(input) {
        //pipe the adding of inputs to the correct object

        //always add to our own collection
        this._inputs.push(input);

        //allways add to the root of the form! (the overriding form._pipeAddInput will deal with inifinite pipe)
        this._form._pipeAddInput(input);
    }

    //private add methods
    _addElement(element) {
        //add to lists
        this._queue.push(element);
        this._elements.push(element);

        //add to correct store list
        switch(element.formeClass) {
            case 'input':
                this._pipeAddInput(element);
                break;
            case 'component':
                this._addComponent(element);
                break;
        }

        //chain
        return element;
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

    _addComposeHandler(callback) {
        this._composeHandlers.push(callback);
    }

    _addCustomValidateHandler(callback, error) {
        this._addValidateHandler(new ContainerValidateHandlerCustom(callback, error));
    }

    _addActionHandler(action, callback) {
        //will only ever be 1 action and 1 callback but container.action() lets you provide arrays of actiosn and/or callbacks.
        this._actionHandlers.push({
            action: action,
            callback: callback,
        });
    }
    
    //private find methods
    _findDescendant(path, type=null, index=0) {
        const segments = utils.path.segments(path);//this wont create more, beyond the first recursion!

        //skip (+cant return self when empty path)
        if (!segments || segments.length === 0 || this._elements.length === 0) {
            return null;
        }

        //scan children
        for(let element of this._elements) {
            //check if element group+name does not go out of bounds of the segments
            const elementGroupLength = element._groupLength;

            if (index + elementGroupLength + 1 <= segments.length) {
                let valid = true;
                let elementSegmentIndex = index;

                //scan all groups in element to make sure they match the segments
                if (elementGroupLength) {
                    for (let groupIndex = 0; groupIndex < elementGroupLength; groupIndex++) {
                        if (segments[elementSegmentIndex] !== element._group[groupIndex]) {
                            valid = false;
                            break;
                        }

                        elementSegmentIndex++;
                    }
                }

                //only continue if still valid + if the elements name matches on teh segment index
                if (valid && segments[elementSegmentIndex] === element._outputName) {
                    //excellent!
                    elementSegmentIndex++;

                    //do we need to recurse or have we found the end?
                    if (elementSegmentIndex === segments.length) {
                        //yup its the pot of gold at the end!

                        //check if element matches type
                        if (type === null || (Array.isArray(type) && type.indexOf(element.formeClass) !== -1 ) || element.formeClass === type) {
                            return element;
                        } else {
                            //nope, not the correct type. No point searching further because there can only ever be 1 path endpoint!
                            return null;
                        }
                    } else {
                        //nope, need to recurse
                        const result = element._findDescendant(segments, type, elementSegmentIndex);
                        if (result !== null) {
                            //the recurse found a match so pass it back down teh chain!
                            return result;
                        }
                    }
                }
            }
        }

        //nope sorry!
        return null;
    }

    _findDescendantOrNamedInput(path, type=null, index=0) {
        //descendant structure takes priority over input names!
        const element = this._findDescendant(path, type);
        if (element) {
            return element;
        }

        //fallback to looking for input by name

        //nope sorry the path was not a string, so cant be looking for name
        if (typeof path !== 'string') {
            return null;
        }

        //check inputs!
        return this._inputs[path] || null;
    }

    //private next handler methods
    _nextLoadHandler(handlers, index=0) {
        return utils.promise.result(this._executeLoadHandler(handlers[index]))
        .then(() => ++index === handlers.length ? Promise.resolve() : this._nextLoadHandler(handlers, index));
    }

    //private execute handler methods
    _executeComposeHandler(handler, component, details) {
        //should be overridden
        return Promise.resolve(true);//resolve that the component was dealt with!
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
            values: this._buildValues({
                alias: true,
                group: true,
                store: true,
                special: true,
            }),
        };
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

    //public get methods
    getNamedInput(name) {
        return this._inputs[name] || null
    }

    getInputNames() {
        return this._inputs.map(input => input._name);
    }

    getElement(path) {
        //can be called at any time but have to remember that an unbuilt form wont know of all paths yet!
        return this._findDescendant(path);
    }

    getInputs(type=null) {
        if (!type) {
            return Array.from(this._inputs);
        } else {
            return this._inputs.filter(input => {
                const inputType = input._calculatedType;
                if (Array.isArray(type)) {
                    return type.indexOf(inputType) !== -1
                } else {
                    return inputType === type;
                }
            });
        }
    }

    getInputTypes() {
        //return a list of unique input types used in the container
        return Array.from(new Set(this._inputs.map(input => input._calculatedType)));
    }

    getElementErrors(path) {
        const element = this._findDescendant(path);
        if (!element) {
            return null;
        }
        return element.getErrors();
    }

    getValues() {
        if (this.callingActiveMethod('getValues')) {
            return this._buildValues({
                alias: true,
                group: true,
                store: true,
                ignore: true,
            });
        }
    }

    getRawElementValue(path, defaultValue=undefined) {
        if (this.callingActiveMethod('getRawElementValue')) {
            const element = this._findDescendant(path);
            if (!element) {
                return defaultValue;
            }
            return this._request._getRawValue(element._name, defaultValue);
        }
    }

    //public set methods
    setElementValue(path, value) {
        if (this.callingActiveMethod('setElementValue')) {
            const element = this._findDescendant(path);
            if (element) {
                //pipe it through the element
                this.setValue(value);
            }
        }

        //chain
        return this;
    }

    //public add methods
    addError() {
        //allows: error(error) and error(path, error)
        if (this.callingActiveMethod('addError')) {
            //how was this called?
            if (arguments.length === 1) {
                //self error
                super.addError(arguments[0]);

            } else if (arguments.length === 2) {
                //descendant error
                const {path, error} = arguments;


            }
        }
    }

    addElementError(path, error) {
        if (this.callingActiveMethod('addElementError')) {
            //check for piping
            const element = this._findDescendant(path);
            if (element) {
                //let the element do the piping!
                element._pipeError(error);
            } else {
                //lost
                this._form._pipeLostError(error);
            }
        }
    }
}

//expose
module.exports = FormeContainer;