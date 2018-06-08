'use strict';

//local imports
const utils = require('./utils');
const FormeContainer = require('./container');
const ComponentValidateHandlerCompose = require('./handlers/component/validate/componentValidateHandlerCompose');
const ComponentValidateHandlerCustom = require('./handlers/component/validate/componentValidateHandlerCustom');
const ComponentValidateHandlerRequire = require('./handlers/component/validate/componentValidateHandlerRequire');
const FormeComponentError = require('./errors').FormeComponentError;

const {
    methodPriority,

    FormeConfigurableMethod,
    FormeConfigurableMethodPointer,
    FormeConfigurableOverride,
    FormeConfigurableParam,
    FormeConfigurableString,
    FormeConfigurableStringOrNull,
    FormeConfigurableStringsOrNull,
    FormeConfigurableBool,
    FormeConfigurableBoolOrNull,
    FormeConfigurableObject,

    FormeConfigurableExportBool,
    FormeConfigurableExportBoolOrNull,
    FormeConfigurableExportString,
    FormeConfigurableExportStringOrNull,
    FormeConfigurableExportStringsOrNull,
    FormeConfigurableExportParam,
    FormeConfigurableExportValidateHandler,
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
        this._icon = null;
        this._help = null;
        this._placeholder = null;
        this._autoComplete = null;
        this._keep = null;//(quantum) this applies the keep flag onto all inputs added to the component
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
            exposed: new FormeConfigurableMethodPointer('expose'),

            //component.id(string)
            id: new FormeConfigurableMethod('id', [
                new FormeConfigurableOverride([
                    new FormeConfigurableStringOrNull('id', false),
                ], true),
            ], new FormeConfigurableExportStringOrNull('_id')),

            //component.icon(string)
            icon: new FormeConfigurableMethod('icon', [
                new FormeConfigurableOverride([
                    new FormeConfigurableString('icon', false),
                ], true),
            ], new FormeConfigurableExportString('_icon')),
            
            //component.placeholder(string)
            placeholder: new FormeConfigurableMethod('placeholder', [
                new FormeConfigurableOverride([
                    new FormeConfigurableString('placeholder', false),
                ], true),
            ], new FormeConfigurableExportString('_placeholder')),
            placeHolder: new FormeConfigurableMethodPointer('placeholder'),

            //component.help(string)
            help: new FormeConfigurableMethod('help', [
                new FormeConfigurableOverride([
                    new FormeConfigurableString('help', false),
                ], true),
            ], new FormeConfigurableExportString('_help')),

            //component.autoComplete(string)
            autoComplete: new FormeConfigurableMethod('autoComplete', [
                new FormeConfigurableOverride([
                    new FormeConfigurableStringOrNull('autoComplete', false),
                ], true),
            ], new FormeConfigurableExportStringOrNull('_autoComplete')),
            autocomplete: new FormeConfigurableMethodPointer('autoComplete'),
            
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

            //component.keep(bool)
            keep: new FormeConfigurableMethod('keep', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBoolOrNull('keep', false),
                ], true),
            ], new FormeConfigurableExportBoolOrNull('_keep')),

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

            //component.require(bool, error)
            require: new FormeConfigurableMethod('require', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool(['require', 'required'], false, true),
                    new FormeConfigurableString('error', false),
                ], true),
            ], new FormeConfigurableExportValidateHandler(ComponentValidateHandlerRequire), methodPriority.validation),
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

    get _errorName() {
        //by default we dont specify an error name, because base does not have a "name" that we can lookup on
        return this._name;
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
    _buildStart(external) {
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

    _buildSelf(external) {
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

    _buildChildren(external) {
        //make sure all children have been correctly piped into the component!
        //also make sure that we have a unique name per child!
        if (!this._elements || !this._elements.length) {
            return Promise.resolve();
        } else {
            //operate on all elements at once!
            return Promise.all(this._elements.map(element => {
                //do this first so any changes propagate to descendants!
                //setup unique name for this child of component. Use the alias mechanism to make sure the value outputs correctly!
                const alias = element._outputName;
                element.name(element._uniqueName);
                element.alias(alias);

                //setup error piping for the element to pipe to the ->parent (this). If we have nested components, then the piping chain should handle the bubble effect!
                element.pipe(`->parent`);

                //now let the element handle its build!
                return element._build(external);
            }));
        }
    }

    //private modify methods
    _buildModifyChildren(external) {
        //operate on all elements at once!
        if (!this._elements || !this._elements.length) {
            return Promise.resolve();
        } else {
            //operate on all child elements as a "master" puppeteer!
            //we need to run the default value of the component through the read handlers because the component doesnt have a "value" so this would not have been done in the "read" step
            return Promise.resolve(this._defaultValue)
            .then(readValue => {
                //apply default value to elements of component!
                if (readValue !== null) {
                    //build the defaultValue based on expose
                    let defaultValue;
                    if (this._expose === null) {
                        //no expose settings so take the entire default!
                        defaultValue = readValue;
                    } else {
                        if (this._expose.length === 1) {
                            //we only have 1 exposed element, so we consume the component defaultValue entirely for this input
                            defaultValue = {};

                            //find exposing element
                            const path = this._expose[0];
                            const element = this._findDescendant(path);
                            if (element) {
                                const pointer = utils.object.add.path(defaultValue, element._ownGroupSegments);
                                pointer[element._outputName] = readValue;
                            }
                        } else {
                            //we have multiple exposed elements so we need to build a custom defaultValue
                            defaultValue = {};

                            for(let path of this._expose) {
                                //find exposing element
                                const element = this._findDescendant(path);

                                if (element) {
                                    //search in the components defaultValue for a match
                                    const value = utils.object.find.path(readValue, element._ownPathSegments);
                                    if (value !== undefined) {
                                        const pointer = utils.object.add.path(defaultValue, element._ownGroupSegments);
                                        pointer[element._outputName] = value;
                                    }
                                }
                            }
                        }
                    }

                    //apply the defaultValue we built to *all* child elements
                    this._callElementStructure('defaultValue', defaultValue);//potentially will recurse!
                }
            })

            //propagate manual configurations from component to children
            //todo: this should be converted to a less manual approach, but for now it works!
            .then(() => {
                if (this._placeholder !== null) {
                    this._callExposedElements('placeholder', false, this._placeholder);//dont recurse!
                }

                if (this._autoComplete !== null) {
                    this._callExposedElements('autoComplete', false, this._autoComplete);//dont recurse!
                }

                if (this._checked !== null) {
                    this._callExposedElements('checked', false, this._checked);//dont recurse!
                }

                if (this._keep !== null) {
                    this._callExposedElements('keep', false, this._keep);//dont recurse!
                }
            })

            //now recurse into children
            .then(() => Promise.all(this._elements.map(element => element._buildModify(external))));
        }
    }

    //private finalise methods
    _buildFinaliseSelf(external) {
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
    _buildValuesSelf(options, depth=0) {
        if (!options.expose || !this._expose) {
            //not exposed, so just use normal behaviour
            return super._buildValuesSelf(options, depth);
        } else {
            //exposed, so we export only specified target descendants

            //how many?
            if (this._expose.length > 1) {
                //mutliple exposed
                const value = {};

                for (let path of this._expose) {
                    const element = this._findDescendant(path);
                    if (element) {
                        element._buildValues(options, value, depth + 1);
                    }
                }

                return value;
            } else {
                //single exposed
                const element = this._findDescendant(this._expose);
                if (element) {
                    return element._buildValues(options, null, depth + 1);
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
        vars.icon = this._icon;
        vars.help = this._help;

        //chain
        return vars;
    }

    //private process methods
    _processElementStateChanges(handler, oldState, newState) {
        //we dont use the exposed version of value when its a ***CUSTOM*** validate handler that was created during the compose!
        //This is because we assume that ***CUSTOM*** validate handlers created in .compose() are for dealing with internal values and not the final exposed values.
        if (!this._exposed || handler instanceof ComponentValidateHandlerCompose) {
            //if not exposed, act as container
            return super._processElementStateChanges(handler, oldState, newState);
        } else {
            //we need to check for value equality
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
            return Promise.resolve(handlers[index](this, details))//<- it was the responsibility of the builder of this handler to conform to (component, details) => {} pattern
            .then(halt => halt === true || ++index === handlers.length ? Promise.resolve() : this._nextComposeHandler(details, handlers, index));
        }
    }

    //private execute handler methods
    _executeValidateHandler(handler, state) {
        return handler.call(this, this._form, this, state);
    }

    _executeReadHandler(handler, value, state) {
        return Promise.resolve(handler.call(this, this.form, this, value, state));
    }

    _executeOutputHandler(handler, state) {
        return handler.call(this, this._form, this, state);
    }

    _executeValidHandler(handler) {
        return handler.call(this, this._form, this);
    }

    _executeInvalidHandler(handler) {
        return handler.call(this, this._form, this);
    }

    _executeBeforeHandler(handler) {
        return handler.call(this, this._form, this);
    }
    
    _executeSubmitHandler(handler, state) {
        return handler.call(this, this._form, this, state);
    }

    _executeAfterHandler(handler) {
        return handler.call(this, this._form, this);
    }
    
    _executeSuccessHandler(handler) {
        return handler.call(this, this._form, this);
    }

    _executeFailHandler(handler) {
        return handler.call(this, this._form, this);
    }

    _executeSetterHandler(handler, value) {
        return handler.call(this, this._form, this, value);
    }

    _executeGetterHandler(handler, value) {
        return handler.call(this, this._form, this, value);
    }

    _executeEmptyHandler(handler, state) {
        return handler.call(this, this._form, this, state);
    }

    //private create methods
    _createError(message) {
        return new FormeComponentError(message, this);
    }

    _createElementState(handler) {
        //we dont use the exposed version of value when its a ***custom*** validate handler that was created during the compose!
        //we check this when the validate handler is specifically inherited from ComponentValidateHandlerCompose
        const compose = handler instanceof ComponentValidateHandlerCompose;
        if (!this._exposed || compose) {
            //if not exposed, act as container
            return Object.assign(super._createElementState(handler), {
                compose: compose,//add compose to the state so we know how this value is formed!
            });
        } else {
            return {
                require: false,//at this point the state doesn't know that it is required (yet)!
                compose: false,//add internal to the state so we know how this value is formed!
                value: this._buildValues({
                    alias: true,
                    group: true,
                    store: true,
                    isolate: true,//we dont want to include this component group in the value!
                    special: true,
                    expose: true,//when the component is exposed the execution handler should get the exposed version of value!
                }),
            };
        }
    }

    //private set methods
    _setValuePrimitive(value, merge, setter) {
        if (!this._exposed) {
            if (this.elements && this.elements.length === 1) {
                //single child element
                const element = this.elements[0];

                if (element) {
                    element._setValue(value, merge, setter);
                }

                return true;
            } else {
                //multiple child elements so revert to this.container behaviour
                return super._setValuePrimitive(value, merge, setter);
            }
        } else {
            if (this._expose && this._expose.length === 1) {
                //single exposed value so revert to primitive setting!
                const element = this._findDescendant(this._expose[0]);

                if (element) {
                    element._setValue(value, merge, setter);
                }

                return true;
            } else {
                //multiple exposed so revert to this.container behaviour
                return super._setValuePrimitive(value, merge, setter);
            }
        }
    }

    _setValueObject(value, merge, setter) {
        if (!this._exposed) {
            if (this.elements && this.elements.length === 1) {
                //single child element
                const element = this.elements[0];

                if (element) {
                    element._setValue(value, merge, setter);
                }

                return true;
            } else {
                //multiple child elements so revert to this.container behaviour
                return super._setValueObject(value, merge, setter);
            }
        } else {
            if (this._expose && this._expose.length === 1) {
                //single exposed value so revert to primitive setting!
                const element = this._findDescendant(this._expose[0]);

                if (element) {
                    element._setValue(value, merge, setter);
                }

                return true;
            } else {
                //multiple exposed so revert to this.container behaviour
                return super._setValueObject(value, merge, setter);
            }
        }
    }

    //private add methods
    _addCustomValidateHandler(callback, error) {
        if (!this._composing) {
            //when the component is not composing (a flag set by forme when the component is being passed to compose handlers)... we are valditing on the user (exposed) level
            this._addValidateHandler(new ComponentValidateHandlerCustom(callback, error));
        } else {
            //the component is composing, so we need to make sure that its validation handlers receive a "complete" state.value. This is because we are validating internally!
            this._addValidateHandler(new ComponentValidateHandlerCompose(callback, error));
        }

        //chain
        return callback;
    }

    //private convert methods
    _convertElementValues(input, out) {
        if (!this._exposed) {
            //no exposed, so treat this as a standard container!
            return super._convertElementValues(input, out);

        } else if (this._expose.length === 1) {
            //single expose so we treat this as an input
            if (!out) {
                //no output container, so we just return the value!
                return input;
            } else {
                //single exposed
                //exposed this value on the singularly exposed elements name!
                const element = this._findDescendant(this._expose[0]);
                out[element._name] = input;
                return out;
            }
        } else {
            //only convert the exposed values!
            out = out || {};

            for(let path of this._expose) {
                const element = this._findDescendant(path);
                if (element) {
                    //traverse groups in values
                    const pointer = element._traverseObject(input);
                    if (pointer !== undefined) {
                        element._convertElementValues(pointer, out);
                    }
                }
            }

            //chain out
            return out;
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

    require(require, error) {
        if (this.callingConfigureMethod('require')) {
            if (require !== undefined && !require) {
                //remove requirement
                this._required = false;
                this._removeValidateHandler(ComponentValidateHandlerRequire);

            } else {
                //add requirement
                this._required = true;
                this._addValidateHandler(new ComponentValidateHandlerRequire(error));
            }

            //chain
            return this;
        }
    }
    required() {
        return this.require(...arguments);
    }

    icon(icon) {
        if (this.callingConfigureMethod('icon')) {
            this._icon = icon;

            //chain
            return this;
        }
    }
    
    placeholder(placeholder) {
        if (this.callingConfigureMethod('placeholder')) {
            //modify the placeholder text
            this._placeholder = placeholder;

            //chain
            return this;
        }
    }
    placeHolder() {
        return this.placeholder(...arguments);
    }

    help(help) {
        if (this.callingConfigureMethod('help')) {
            this._help = help;

            //chain
            return this;
        }
    }

    autoComplete(autocomplete) {
        if (this.callingConfigureMethod('autoComplete')) {
            //modify the autocomplete attribute
            this._autoComplete = autocomplete;

            //chain
            return this;
        }
    }
    autocomplete() {
        //shortcut to cover typo! (hey that's the way we roll at forme :D)
        return this.autoComplete(...arguments);
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

    keep(keep) {
        if (this.callingConfigureMethod('keep')) {
            //change default keep state
            if (keep === null) {
                this._keep = null;
            } else {
                this._keep = arguments.length ? !!keep : true;
            }

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

    getRequired() {
        return this._required;
    }
}

//expose module
module.exports = FormeComponent;