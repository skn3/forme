'use strict';

//local imports
const utils = require('./utils');
const FormeContainer = require('./container');
const FormeConfigurationError = require('./errors').FormeConfigurationError;

const {
    FormeConfigurableMethod,
    FormeConfigurableMethodPointer,
    FormeConfigurableOverride,
    FormeConfigurableParam,
    FormeConfigurableString,
    FormeConfigurableObject,

    FormeConfigurableExportString,
    FormeConfigurableExportParam,
} = require('./configurable');

//functions
function renameInputMethod(method) {
    return `input${utils.string.upperCaseFirst(method)}`;
}

//main class
class FormeComponent extends FormeContainer {
    constructor(form, page, name, type) {
        super('component', form, page, name);

        //self
        this._type = null;
        this._value = null;
        this._validateAddComponent = null;
        this._params = [];
        this._inputInstance = null;//this gets modified as we call configure methods on the component!

        //setup input methods
        this._attachInputConfigurableMethods();

        //call setup
        this.type(type);
    }

    //properties
    get form() {
        return this._form;
    }

    get inputConfiguration() {
        return this._inputInstance.configuration;
    }

    get details() {
        return {
            type: this._type,
            name: this._name,
            value: this._value,
            params: Object.assign({}, ...this._params.map(param => ({[param.name]: param.value}))),
        }
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
            if (method instanceof FormeConfigurableMethod) {
                methodNames.push(name);
            }
        }

        //add input configure methods to the component, but have those methods pass on the call to the input instance!
        for(let inputMethod of methodNames) {
            //rename this method inputFoo()
            let componentMethod = renameInputMethod(inputMethod);

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
        for(let inputMethod of Object.keys(instanceMethods)) {
            //rename methods
            let componentMethod = renameInputMethod(inputMethod);

            //create a copy of the method and set the source property to point to our _inputInstance
            mergeMethods[componentMethod] = instanceMethods[inputMethod].clone('_inputInstance');
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

    //private create methods
    _createError(message) {
        return new FormeConfigurationError(message);
    }

    //override (and block)
    //todo: flesh some of this functionality out!
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

    value(value) {
        if (this.callingConfigureMethod('value')) {
            this._value = value;

            //chain
            return this;
        }
    }

    component(component) {
        if (this.callingConfigureMethod('component')) {
            this._validateAddComponent = component;

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