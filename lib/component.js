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

    //properties
    get formeClass() {
        return 'component';
    }

    //private build methods
    _build() {
        return this._buildCompose()
        .then(() => this._buildChildren());
    }

    _buildCompose() {
        //build list of handlers
        const handlers = [];

        //page compose handlers
        if (this._requestPage !== null && this._requestPage._composeHandlers !== null && this._requestPage._composeHandlers.length) {
            for(let handler of this._requestPage._composeHandlers) {
                handlers.push(handler)
            }
        }

        //form compose handlers
        if (this._form._composeHandlers !== null && this._form._composeHandlers.length) {
            for(let handler of this._form._composeHandlers) {
                handlers.push(handler)
            }
        }

        //driver compose handler
        handlers.push((handler, component, details) => this._driver.compose(this._form, this._requestPage, this, details));

        //execute teh compose handlers in order
        return this._nextComposeHandler(this._composeDetails, handlers, 0)
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
        vars.required = this._inputs.find(input => input._required);//component becomes required if any input within is required!

        //chain
        return vars;
    }

    //private next handler methods
    _nextComposeHandler(details, handlers, index=0) {
        if (handlers.length === 0) {
            return Promise.resolve();
        } else {
            //execute the compose handler on the components container (page/form). Thus the contain is responsible for filling in the correct information for that callback!
            return utils.promise.result(this.container._executeComposeHandler(handlers[index], this, details))
            .then(halt => halt === true || ++index === handlers.length ? Promise.resolve() : this._nextComposeHandler(this, details, handlers, index));
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

    //private call methods
    _callExposedElements(method, recurse, ...params) {
        if (!this._expose) {
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