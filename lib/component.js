'use strict';

//local imports
const utils = require('./utils');
const FormeContainer = require('./container');
const ComponentComposeValidateHandlerCustom = require('./handlers/component/validate/componentComposeValidateHandlerCustom');
const FormeComponentError = require('./errors').FormeComponentError;

const {
    FormeConfigurableMethod,
    FormeConfigurableMethodPointer,
    FormeConfigurableOverride,
    FormeConfigurableParam,
    FormeConfigurableString,
    FormeConfigurableStringOrNull,
    FormeConfigurableStringsOrNull,
    FormeConfigurableBool,
    FormeConfigurableObject,

    FormeConfigurableExportBool,
    FormeConfigurableExportString,
    FormeConfigurableExportStringOrNull,
    FormeConfigurableExportStringsOrNull,
    FormeConfigurableExportParam,
} = require('./configurable');

//main class
class FormeComponent extends FormeContainer {
    constructor(name, type) {
        super(name);

        //self
        this._type = type;//save the initial type
        this._expose = null;//does the component expose an internal element instead of its complete value set?
        this._id = null;//manually change id of component otherwise this._uniqueName is used
        this._defaultValue = null;
        this._checked = null;//null means hasnt been set!
        this._params = [];
        this._required = false;//this does not do any validation but just flags the component as required in  template vars
        this._tempHandlerLists = null;//this is used to store handlers during the build!
        this._composing = false;//flag set by forme when it is composing the component!
    }

    //private configure methods
    _buildConfigurableMethods() {
        return Object.assign(super._buildConfigurableMethods(), {
            //component.type(string)
            type: new FormeConfigurableMethod('type', [
                new FormeConfigurableOverride([
                    new FormeConfigurableString('type', true),
                ], true),
            ], new FormeConfigurableExportString('_type')),

            //component.expose(string)
            expose: new FormeConfigurableMethod('expose', [
                new FormeConfigurableOverride([
                    new FormeConfigurableStringsOrNull(['expose', 'path', 'paths', 'element', 'elements'], true),
                ], true),
            ], new FormeConfigurableExportStringsOrNull('_expose')),

            //component.id(string)
            id: new FormeConfigurableMethod('id', [
                new FormeConfigurableOverride([
                    new FormeConfigurableStringOrNull('id', false),
                ], true),
            ], new FormeConfigurableExportStringOrNull('_id')),

            //component.value(value)
            defaultValue: new FormeConfigurableMethod('defaultValue', [
                new FormeConfigurableOverride([
                    new FormeConfigurableParam(['value', 'default', 'defaultValue'], false),
                ], true),
            ], new FormeConfigurableExportParam('_defaultValue')),

            //component.checked(bool)
            checked: new FormeConfigurableMethod('checked', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool('checked', false),
                ], true),
            ], new FormeConfigurableExportBool('_checked')),

            //component.param(*multiple*)
            param: new FormeConfigurableMethod('param', [
                //component.param(key, value)
                new FormeConfigurableOverride([
                    new FormeConfigurableString(['name', 'key', 'id'], true),
                    new FormeConfigurableParam('value', false),
                ], false),

                //component.param(object)
                new FormeConfigurableOverride([
                    new FormeConfigurableObject(['param', 'params'], true),
                ], true),
            ]),
            params: new FormeConfigurableMethodPointer('param'),

            //component.require(bool)
            require: new FormeConfigurableMethod('require', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool(['require', 'required'], false, true),
                ], true),
            ], new FormeConfigurableExportBool('_required')),
            required: new FormeConfigurableMethodPointer('require'),
        });
    }

    //private properties
    get _composeDetails() {
        return {
            type: this._type,
            id: this._uniqueId,
            name: this._name,
            params: Object.assign({}, ...this._params.map(param => ({[param.name]: param.value}))),
        }
    }

    get _errorPath() {
        return this.path;
    }

    get _uniqueId() {
        return this._id || this._uniqueName;
    }

    get _exposed() {
        return this._expose !== null;
    }

    //properties
    get formeClass() {
        return 'component';
    }

    //private build methods
    _buildStart() {
        //need to temporarily move all of our handlers so the component appears to be empty. We then add these back in this._buildFinish().
        //this is because we want and handlers defined in the component configure, to happen AFTER the ones defined in compose!
        return new Promise((resolve ,reject) => {
            //create temporary store of all handler lists
            const keys = this._handlerPropertyKeys;
            this._tempHandlerLists = [];

            //move all handler lists!
            for(let key of keys) {
                this._tempHandlerLists.push({key: key, handlers: this[key]});
                this[key] = [];
            }

            //done
            return resolve();
        });
    }

    _buildSelf() {
        //build list of handlers that have been defined on the form
        const handlers = this._form._buildComposeHandlers();

        //add driver compose handler into the mix (this is generally where compose handler will be handled)
        handlers.push((component, details) => this._driver.compose(this._form, this._requestPage, component, details));

        //execute the compose handlers in order
        this._composing = true;
        return this._nextComposeHandler(this._composeDetails, handlers, 0)
        .then(() => {
            this._composing = false;
        });
    }

    _buildChildren() {
        //in this method we are responsible for modifying all children/descendants depending on the state of teh component!
        //we also have to reconfigure inputs so we properly setup the "object orientated" nature of components. For example we need to make sure each of the components inputs
        //has a globally unique name. Another example is that we want to pipe errors from the elements to the containing component!
        return new Promise((resolve, reject) => {
            if (this._elements && this._elements.length) {
                //iterate elements
                for (let element of this._elements) {
                    //setup unique name for this child of component. Use the alias mechanism to make sure teh value outputs correctly!
                    const alias = element._outputName;
                    element.name(element._uniqueName);
                    element.alias(alias);

                    //setup error piping for the element to pipe to the ->parent (this). If we have nested components, then the piping chain should handle the bubble effect!
                    element.pipe(`->parent`);
                }

                //apply default value to elements of component!
                if (this._defaultValue !== null) {
                    //build the defaultValue based on expose
                    let defaultValue;
                    if (this._expose === null) {
                        //no expose settings so take the entire default!
                        defaultValue = this._defaultValue;
                    } else {
                        if (this._expose.length === 1) {
                            //we only have 1 exposed element, so we consume the component defaultValue entirely for this input
                            defaultValue = {};

                            //find exposing element
                            const path = this._expose[0];
                            const element = this._findDescendant(path);
                            if (element) {
                                const pointer = utils.object.add.path(defaultValue, element._ownGroupSegments);
                                pointer[element._outputName] = this._defaultValue;
                            }
                        } else {
                            //we have multiple exposed elements so we need to build a custom defaultValue
                            defaultValue = {};

                            for(let path of this._expose) {
                                //find exposing element
                                const element = this._findDescendant(path);

                                if (element) {
                                    //search in the components defaultValue for a match
                                    const value = utils.object.find.path(this._defaultValue, element._ownPathSegments);
                                    if (value !== undefined) {
                                        const pointer = utils.object.add.path(defaultValue, element._ownGroupSegments);
                                        pointer[element._outputName] = value;
                                    }
                                }
                            }
                        }
                    }

                    //apply the defaultValue we built to *all* child elements
                    this._callElementStructure('defaultValue', defaultValue);//do recurse!
                }

                //set checked for exposed elements
                if (this._checked !== null) {
                    this._callExposedElements('checked', false, this._checked);//dont recurse!
                }
            }

            //done :D
            return resolve();
        });
    }

    _buildFinish() {
        return new Promise((resolve, reject) => {
            for(let tempList of this._tempHandlerLists) {
                //add the handlers to the end
                let internalList = this[tempList.key] = this[tempList.key].concat(tempList.handlers);

                //re-index handler list (only if the items within support it) todo: convert function type handlers to have wrapper class
                let index = 0;
                for(let handler of internalList) {
                    if (typeof handler === 'object' && handler.hasOwnProperty('index')) {
                        handler.index = index++;
                    }
                }
            }

            //garbage!
            this._tempHandlerLists = null;

            //done
            return resolve();
        });
    }

    //private build values methods
    _buildValuesSelf(options) {
        if (!options.expose || !this._expose) {
            //not exposed, so just use normal behaviour
            return super._buildValuesSelf(options);
        } else {
            //exposed, so we export only speicfied target descendants

            //how many?
            if (this._expose.length > 1) {
                //mutliple exposed
                const value = {};

                for(let path of this._expose) {
                    const element = this._findDescendant(path);
                    if (element) {
                        element._buildValues(options, value);
                    }
                }

                return value;
            } else {
                //single exposed
                const element = this._findDescendant(this._expose);
                if (element) {
                    return element._buildValues(options, null);
                }
            }

            //default nothing!
            return null;
        }
    }

    //private build template methods
    _buildTemplateVars(options) {
        const vars = super._buildTemplateVars(options);

        //component vars
        vars.type = this._type;
        vars.id = this._uniqueId;
        vars.params = Object.assign({}, ...this._params.map(param => ({[param.name]: param.value})));
        vars.required = this._required || this._inputs.some(input => input._required);//component becomes required if any input within is required!

        //chain
        return vars;
    }

    //private process methods
    _processExecutionStateChanges(handler, oldState, newState) {
        //we dont use teh exposed version of value when its a validate handler that was created during the compose!
        if (!this._exposed || handler instanceof ComponentComposeValidateHandlerCustom) {
            //if not exposed, act as container
            return super._processExecutionStateChanges(handler, oldState, newState);
        } else {
            //its exposed so we need to check for value equality
            if (!utils.value.compare(oldState.value, newState.value)) {
                this._setValue(newState.value, false, true);
            }
        }
    }

    //private next handler methods
    _nextComposeHandler(details, handlers, index=0) {
        if (handlers.length === 0) {
            return Promise.resolve();
        } else {
            return utils.promise.result(handlers[index](this, details))//<- it was teh responsibility of the builder of this handler to conform to (component, details) => {} pattern
            .then(halt => halt === true || ++index === handlers.length ? Promise.resolve() : this._nextComposeHandler(details, handlers, index));
        }
    }

    //private execute handler methods
    _executeValidateHandler(handler, state) {
        return handler.call(this, this._form, this, state);
    }

    _executeValidHandler(handler) {
        return handler.call(this, this._form, this);
    }

    _executeInvalidHandler(handler) {
        return handler.call(this, this._form, this);
    }

    _executeSetterHandler(handler, value, merge) {
        return handler.call(this, this._form, this, value, merge);
    }

    //private create methods
    _createError(message) {
        return new FormeComponentError(message, this);
    }

    _createExecutionState(handler) {
        //we dont use teh exposed version of value when its a validate handler that was created during the compose!
        if (!this._exposed || handler instanceof ComponentComposeValidateHandlerCustom) {
            //if not exposed, act as container
            return super._createExecutionState(handler);
        } else {
            return {
                value: this._buildValues({
                    alias: true,
                    group: true,
                    store: true,
                    special: true,
                    expose: true,//when the component is exposed the execution handler should get the exposed version of value!
                }),
            };
        }
    }

    //private add methods
    _addCustomValidateHandler(callback, error) {
        if (!this._composing) {
            //when the component is not composing (a flag set by forme when teh component is being passed to compose handlers)... we should just treat it as a container
            return super._addCustomValidateHandler(callback, error);
        } else {
            //the component is composing, so we need to make sure that its validation handlers receive a "complete" state.value
            this._addValidateHandler(new ComponentComposeValidateHandlerCustom(callback, error));
        }
    }

    //private call methods
    _callExposedElements(method, recurse, ...params) {
        if (!this._exposed) {
            //hand back to container for default behaviour!
            return super._callExposedElements(method, recurse, ...params);
        } else {
            //only those elements that are exposed
            for(let path of this._expose) {
                const element = this._findDescendant(path);
                if (element) {
                    //only call if it exists
                    const func = element[method];
                    if (typeof func === 'function') {
                        func.apply(element, params);
                    }

                    //recurse
                    if (recurse) {
                        element._callExposedElements(method, recurse, ...params);
                    }
                }
            }
        }
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

    id(id) {
        if (this.callingConfigureMethod('id')) {
            this._id = id || null;

            //chain
            return this;
        }
    }

    expose(expose) {
        if (this.callingConfigureMethod('expose')) {
            if (!expose || expose.length === 0) {
                this._expose = null;
            } else if (Array.isArray(expose)) {
                this._expose = expose.filter(expose => !!expose);
                if (this.expose.length === 0) {
                    this._expose = null;
                }
            } else {
                this._expose = [expose];
            }

            //chain
            return this;
        }
    }

    require(require) {
        if (this.callingConfigureMethod('require')) {
            //flag component as required (no validation)
            this._required = arguments.length?!!require:true;

            //chain
            return this;
        }
    }
    required() {
        return this.require(...arguments);
    }

    defaultValue(value) {
        if (this.callingConfigureMethod('defaultValue')) {
            this._defaultValue = value;

            //chain
            return this;
        }
    }

    checked(checked) {
        if (this.callingConfigureMethod('checked')) {
            //change default checked state
            this._checked = arguments.length?!!checked:true;

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

    //state
    getDefaultValue() {
        return this._defaultValue;
    }
}

//expose module
module.exports = FormeComponent;