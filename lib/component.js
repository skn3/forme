'use strict';

//local imports
const utils = require('./utils');
const FormeContainer = require('./container');
const FormeComponentError = require('./errors').FormeComponentError;

const {
    FormeConfigurableMethod,
    FormeConfigurableMethodPointer,
    FormeConfigurableOverride,
    FormeConfigurableParam,
    FormeConfigurableString,
    FormeConfigurableBool,
    FormeConfigurableObject,

    FormeConfigurableExportString,
    FormeConfigurableExportParam,
    FormeConfigurableExportArray,
} = require('./configurable');

//locals
const ignoredInputMethods = ['name', 'value', 'group'];//input methods that dont get added to the component
const renamedInputMethods = ['type'];//input methods that get prefixed as component().inputFoo()

//functions
function inputMethodName(method) {
    if (renamedInputMethods.indexOf(method) === -1) {
        return method;
    } else {
        return `input${utils.string.upperCaseFirst(method)}`;
    }
}

//main class
class FormeComponent extends FormeContainer {
    constructor(form, page, name, type) {
        super('component', form, page, name);

        //self
        this._type = null;
        this._value = null;
        this._group = null;
        this._params = [];
        this._inputInstance = null;//this gets modified as we call configure methods on the component!

        //setup input methods
        this._attachInputConfigurableMethods();

        //call setup
        this.type(type);
    }

    //private properties
    get _inputConfiguration() {
        return this._inputInstance.configuration;
    }

    get _details() {
        return {
            type: this._type,
            name: this._name,
            value: this._value,
            params: Object.assign({}, ...this._params.map(param => ({[param.name]: param.value}))),
        }
    }

    get _prefixedGroups() {
        //get an array of groups that will be prefixed to all inputs related to this component
        const out = [this._name];
        if (this._group) {
            for(let group of this._group) {
                out.push(group);
            }
        }
        return out;
    }

    //private configure methods
    _attachInputConfigurableMethods() {
        //attach methods defined on the input, to this component. This is only for when calling component.inputMethod(). Calls done via component.configure() are redirected via FormeConfigurableMethod .source().

        //noinspection Annotator
        this._inputInstance = new this._form._driverClass.inputClass(this._form, undefined);

        //get list of input method names based on the configurable methods defined
        const configurableMethods = this._inputInstance.configurableMethods;
        const methodNames = [];
        for(let name of Object.keys(configurableMethods)) {
            const method = configurableMethods[name];
            if (method instanceof FormeConfigurableMethod && ignoredInputMethods.indexOf(name) === -1) {
                methodNames.push(name);
            }
        }

        //add input configure methods to the component, but have those methods pass on the call to the input instance!
        for(let inputMethod of methodNames) {
            //rename this method inputFoo()
            let componentMethod = inputMethodName(inputMethod);

            //attach swizzled method
            this[componentMethod] = (...params) => {
                //call the inputs method
                this._inputInstance[inputMethod].apply(this._inputInstance, params);

                //chain the component!
                return this;
            }
        }
    }

    _buildConfigurableMethods() {
        //get all input methods from the _inputInstance
        const instanceMethods = this._inputInstance.configurableMethods;
        const mergeMethods = {};

        //process all input methods
        for(let inputMethodName of Object.keys(instanceMethods)) {
            if (ignoredInputMethods.indexOf(inputMethodName) === -1) {
                //rename methods
                const componentMethodName = inputMethodName(inputMethodName);

                //create a copy of the method and set the source property to point to our _inputInstance
                mergeMethods[componentMethodName] = instanceMethods[inputMethodName].clone('_inputInstance');
            }
        }

        //now merge this all together, component can override any methods it likes!
        return Object.assign(super._buildConfigurableMethods(), mergeMethods, {
            //component.type(string)
            type: new FormeConfigurableMethod('type', [
                new FormeConfigurableOverride([
                    new FormeConfigurableString('type', true),
                ], true),
            ], new FormeConfigurableExportString('_type')),
            
            //component.value(*any*)
            value: new FormeConfigurableMethod('value', [
                new FormeConfigurableOverride([
                    new FormeConfigurableParam('value', false),
                ], true),
            ], new FormeConfigurableExportParam('_value')),

            //component.group(string, append)
            group: new FormeConfigurableMethod('group', [
                new FormeConfigurableOverride([
                    new FormeConfigurableString('group', false),
                    new FormeConfigurableBool('append', false, true),
                ], true),
            ], new FormeConfigurableExportArray('_group')),

            //component.param(*multiple*)
            param: new FormeConfigurableMethod('param', [
                //component.param(key, value)
                new FormeConfigurableOverride([
                    new FormeConfigurableString(['name', 'key', 'id'], false),
                    new FormeConfigurableParam('value', false),
                ], false),

                //component.param(object)
                new FormeConfigurableOverride([
                    new FormeConfigurableObject(['param', 'params'], true),
                ], true),
            ]),
            params: new FormeConfigurableMethodPointer('param'),
        });
    }

    //private methods
    _validate() {
        //call super _validate() as it handles the validation
        return super._validate()

        //now we just need to capture either _valid() or _invalid() based on if a promise was catch'd
        .then(() => this._valid())

        //invalid :(
        .catch(err => {
            //unhandled error
            this._form._catchError(err);

            //call base _invalid execution
            return this._invalid();
        });
    }

    //private execute methods
    _executeValidateHandler(handler, state) {
        return handler.call(this, this._form, this, state);
    }

    _executeValidHandler(handler) {
        return handler.call(this, this._form, this);
    }

    _executeInvalidHandler(handler) {
        return handler.call(this, this._form, this);
    }

    //private state methods
    _stateHandlerValues(values) {
        return utils.group.find.path(values, this._prefixedGroups);
    }

    //private create methods
    _createError(message) {
        return new FormeComponentError(message, this);
    }

    //override (and block) todo: flesh some of this functionality out!
    component() {
        throw this.callingInvalidMethod('component');
    }

    require() {
        throw this.callingInvalidMethod('require');
    }

    load() {
        throw this.callingInvalidMethod('load');
    }

    build() {
        throw this.callingInvalidMethod('build');
    }

    compose() {
        throw this.callingInvalidMethod('compose');
    }

    action() {
        throw this.callingInvalidMethod('action');
    }

    //component configuration
    type(type) {
        if (this.callingConfigureMethod('type')) {
            this._type = type;

            //chain
            return this;
        }
    }
    
    name(name) {
        if (this.callingConfigureMethod('name')) {
            this._name = name;

            //chain
            return this;
        }
    }

    group(segments, atEnd=true) {
        if (this.callingConfigureMethod('group')) {
            //change teh group the input will be added to (used by templating)
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

    value(value) {
        if (this.callingConfigureMethod('value')) {
            this._value = value;

            //chain
            return this;
        }
    }

    param() {
        if (this.callingConfigureMethod('param')) {
            if (arguments.length === 2 || (arguments.length === 1 && typeof arguments[0] === 'string')) {
                //.param(name)
                //.param(name, value)
                this._params.push({
                    name: arguments[0],
                    value: arguments.length > 0?arguments[1]:undefined,
                });

            } else if (arguments.length === 1 && typeof arguments[0] === 'object') {
                //.param({name: value})
                const params = arguments[0];

                for(let name of Object.keys(params)) {
                    this._params.push({
                        name: name,
                        value: params[name] || undefined,
                    });
                }
            }

            //chain
            return this;
        }
    }

    params() {
        //shortcut
        return this.param(...arguments);
    }

    //templating
    template() {
        return {
            type: this._type,
            name: this._name,
            params: Object.assign({}, ...this._params.map(param => ({[param.name]: param.value}))),
        }
    }
}

//expose module
module.exports = FormeComponent;