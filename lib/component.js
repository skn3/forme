'use strict';

//local imports
const utils = require('./utils');
const FormeContainer = require('./container');
const FormeInput = require('./input');
const FormeComponentError = require('./errors').FormeComponentError;

const {
    FormeConfigurableMethod,
    FormeConfigurableMethodPointer,
    FormeConfigurableOverride,
    FormeConfigurableParam,
    FormeConfigurableString,
    FormeConfigurableStringOrNull,
    FormeConfigurableBool,
    FormeConfigurableObject,
    FormeConfigurableStrings,
    FormeConfigurableCallback,

    FormeConfigurableExportString,
    FormeConfigurableExportStringOrNull,
    FormeConfigurableExportParam,
    FormeConfigurableExportCallback,
    FormeConfigurableExportArrayStrings,
} = require('./configurable');

//main class
class FormeComponent extends FormeContainer {
    constructor(name, type) {
        super(name);

        //self
        this._type = type;//save the initial type
        this._template = null;
        this._id = null;//manually change id of component otherwise this._uniqueName is used
        this._defaultValue = null;
        this._params = [];
    }

    //private properties
    get _composeDetails() {
        return {
            type: this._type,
            id: this._id || this._uniqueName,
            name: this._name,
            params: Object.assign({}, ...this._params.map(param => ({[param.name]: param.value}))),
        }
    }

    get _errorPath() {
        return this.path;
    }

    //properties
    get formeClass() {
        return 'component';
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

            //component.template(*multiple*)
            template: new FormeConfigurableMethod('template', [
                //component.template(template, client)
                new FormeConfigurableOverride([
                    new FormeConfigurableString(['template', 'path', 'name'], true),
                    new FormeConfigurableBool('client', true, false),
                ], false),

                //component.template(template)
                new FormeConfigurableOverride([
                    new FormeConfigurableString(['template', 'path', 'name'], false),
                ], true),
            ], new FormeConfigurableExportString('_template')),

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

    //private build methods
    _build() {
        this._buildCompose()
        .then(() => this._buildChildren())

        //finalise the build
        .then(() => {
            //copy elements into the form
            if (this._elements !== null && this._elements.length) {
                for (let element of this._elements) {
                    //this._form._addElement(element);
                }
            }
        });
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
        return new Promise((resolve, reject) => {
            if (this._elements && this._elements.length) {
                //iterate the elements
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
                    this._callElements('defaultValue', this._defaultValue);
                }
            }

            //done :D
            return resolve();
        });
    }

    //private build template methods
    _buildTemplateVars(options) {
        return Object.assign(super._buildTemplateVars(options), {
            type: this._type,
            template: this._template,
            params: Object.assign({}, ...this._params.map(param => ({[param.name]: param.value}))),
        });
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

    template(template, client=false) {
        if (this.callingConfigureMethod('template')) {
            //set a template name/path/etc for engines to implement!
            this._template = template || null;
            this._templateClient = client || false;
        }
    }

    defaultValue(value) {
        if (this.callingConfigureMethod('defaultValue')) {
            this._defaultValue = value;

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
}

//expose module
module.exports = FormeComponent;