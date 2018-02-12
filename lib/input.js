'use strict';

//module imports
const format = require('string-template');

//local imports
const constants = require('./constants');
const utils = require('./utils');

const FormeInputError = require('./errors').FormeInputError;
const FormeBase = require('./base');

const InputProcessHandlerEmpty = require('./handlers/input/process/inputProcessHandlerEmpty');
const InputProcessHandlerConvertBool = require('./handlers/input/process/inputProcessHandlerConvertBool');
const InputProcessHandlerConvertInt = require('./handlers/input/process/inputProcessHandlerConvertInt');
const InputProcessHandlerConvertFloat = require('./handlers/input/process/inputProcessHandlerConvertFloat');
const InputProcessHandlerConvertString = require('./handlers/input/process/inputProcessHandlerConvertString');

const InputValidateHandlerRequire = require('./handlers/input/validate/inputValidateHandlerRequire');
const InputValidateHandlerOptions = require('./handlers/input/validate/inputValidateHandlerOptions');
const InputValidateHandlerSize = require('./handlers/input/validate/inputValidateHandlerSize');
const InputValidateHandlerMin = require('./handlers/input/validate/inputValidateHandlerMin');
const InputValidateHandlerMax = require('./handlers/input/validate/inputValidateHandlerMax');
const InputValidateHandlerCustom = require('./handlers/input/validate/inputValidateHandlerCustom');
const InputValidateHandlerIs = require('./handlers/input/validate/inputValidateHandlerIs');
const InputValidateHandlerMatch = require('./handlers/input/validate/inputValidateHandlerMatch');
const InputValidateHandlerBlacklist = require('./handlers/input/validate/inputValidateHandlerBlacklist');

const {
    FormeConfigurableCallbacks,
    FormeConfigurableMethod,
    FormeConfigurableMethodPointer,
    FormeConfigurableOverride,
    FormeConfigurableParam,
    FormeConfigurableBool,
    FormeConfigurableInt,
    FormeConfigurableString,
    FormeConfigurableObject,
    FormeConfigurableArray,
    FormeConfigurableStrings,

    FormeConfigurableExportSpecialTrigger,
    FormeConfigurableExportProcessHandler,
    FormeConfigurableExportValidateHandler,
    FormeConfigurableExportValidateHandlers,
    FormeConfigurableExportParam,
    FormeConfigurableExportNot,
    FormeConfigurableExportString,
    FormeConfigurableExportArrayStrings,
    FormeConfigurableExportArrayObjectsAssign,
    FormeConfigurableExportBool,
} = require('./configurable');

//locals
const handlerClassLookup = {
    require: InputValidateHandlerRequire,
    options: InputValidateHandlerOptions,
    size: InputValidateHandlerSize,
    min: InputValidateHandlerMin,
    max: InputValidateHandlerMax,
    validate: InputValidateHandlerCustom,
    is: InputValidateHandlerIs,
    match: InputValidateHandlerMatch,
    blacklist: InputValidateHandlerBlacklist,
};

//classes
class FormeInput extends FormeBase {
    constructor(name) {
        super(name);

        this._type = null;
        this._alias = null;
        this._ignore = false;
        this._required = false;
        this._keep = false;
        this._expose = false;
        this._secure = false;
        this._readonly = false;
        this._hidden = false;
        this._icon = null;
        this._defaultValue = null;
        this._permanentValue = null;
        this._overrideValue = null;
        this._checked = null;
        this._id = null;
        this._placeholder = null;
        this._data = [];
        this._help = '';
        this._options = [];
        this._special = false;
        this._template = null;
        this._templateClient = null;
        this._special = false;
        this._template = null;
    }

    //private build configuration methods
    _buildConfigurableMethods() {
        return Object.assign(super._buildConfigurableMethods(), {
            //--- configuration ---

            //input.type(string)
            type: new FormeConfigurableMethod('type', [
                new FormeConfigurableOverride([
                    new FormeConfigurableString('type', false),
                ], true),
            ], new FormeConfigurableExportString('_type')),

            //input.alias(string)
            alias: new FormeConfigurableMethod('alias', [
                new FormeConfigurableOverride([
                    new FormeConfigurableString('alias', false),
                ], true),
            ], new FormeConfigurableExportString('_alias')),

            //input.template(*multiple*)
            template: new FormeConfigurableMethod('template', [
                //input.template(template, client)
                new FormeConfigurableOverride([
                    new FormeConfigurableString(['template', 'path', 'name'], true),
                    new FormeConfigurableBool('client', true, false),
                ], false),

                //input.template(template)
                new FormeConfigurableOverride([
                    new FormeConfigurableString(['template', 'path', 'name'], false),
                ], true),
            ], new FormeConfigurableExportString('_template')),

            //input.ignore(bool)
            ignore: new FormeConfigurableMethod('ignore', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool('ignore', false),
                ], true),
            ], new FormeConfigurableExportBool('_ignore')),

            //input.keep(bool)
            keep: new FormeConfigurableMethod('keep', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool('keep', false),
                ], true),
            ], new FormeConfigurableExportBool('_keep')),

            //input.expose(bool)
            expose: new FormeConfigurableMethod('expose', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool('expose', false, true),
                ], true),
            ], new FormeConfigurableExportBool('_expose')),

            //input.secure(bool)
            secure: new FormeConfigurableMethod('secure', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool(['secure', 'secured'], false),
                ], true),
            ], new FormeConfigurableExportBool('_secure')),

            //input.readonly(bool)
            readonly: new FormeConfigurableMethod('readonly', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool('readonly', false),
                ], true),
            ], new FormeConfigurableExportBool('_readonly')),

            //input.hidden(bool)
            hidden: new FormeConfigurableMethod('hidden', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool('hidden', false),
                ], true),
            ], new FormeConfigurableExportBool('_hidden')),

            //input.icon(string)
            icon: new FormeConfigurableMethod('icon', [
                new FormeConfigurableOverride([
                    new FormeConfigurableString('icon', false),
                ], true),
            ], new FormeConfigurableExportString('_icon')),

            //input.checked(bool)
            checked: new FormeConfigurableMethod('checked', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool('checked', false),
                ], true),
            ], new FormeConfigurableExportBool('_checked')),

            //input.permanent(value)
            permanent: new FormeConfigurableMethod('permanent', [
                new FormeConfigurableOverride([
                    new FormeConfigurableParam(['value', 'permanent'], false),
                ], true),
            ], new FormeConfigurableExportParam('_permanentValue')),

            //input.override(value)
            override: new FormeConfigurableMethod('override', [
                new FormeConfigurableOverride([
                    new FormeConfigurableString(['value', 'override'], false),
                ], true),
            ], new FormeConfigurableExportParam('_overrideValue')),

            //input.id(string)
            id: new FormeConfigurableMethod('id', [
                new FormeConfigurableOverride([
                    new FormeConfigurableString('id', false),
                ], true),
            ], new FormeConfigurableExportString('_id')),

            //input.placeholder(string)
            placeholder: new FormeConfigurableMethod('placeholder', [
                new FormeConfigurableOverride([
                    new FormeConfigurableString('placeholder', false),
                ], true),
            ], new FormeConfigurableExportString('_placeholder')),

            //input.defaultValue(value)
            defaultValue: new FormeConfigurableMethod('defaultValue', [
                new FormeConfigurableOverride([
                    new FormeConfigurableParam(['value', 'default', 'defaultValue'], false),
                ], true),
            ], new FormeConfigurableExportParam('_defaultValue')),

            //input.empty(value)
            empty: new FormeConfigurableMethod('empty', [
                new FormeConfigurableOverride([
                    new FormeConfigurableParam('value', false),
                ], true),
            ], new FormeConfigurableExportProcessHandler(InputProcessHandlerEmpty)),

            //input.data(*multiple*)
            data: new FormeConfigurableMethod('data', [
                //input.data(key, value)
                new FormeConfigurableOverride([
                    new FormeConfigurableString(['name', 'key', 'id'], true),
                    new FormeConfigurableParam('value', false),
                ], false),

                //input.data(object)
                new FormeConfigurableOverride([
                    new FormeConfigurableObject(['data', 'value'], true),
                ], true),
            ], new FormeConfigurableExportArrayObjectsAssign('_data')),

            //input.help(string)
            help: new FormeConfigurableMethod('help', [
                new FormeConfigurableOverride([
                    new FormeConfigurableString('help', false),
                ], true),
            ], new FormeConfigurableExportString('_help')),

            //input.bool(bool)
            bool: new FormeConfigurableMethod('bool', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool(['null', 'allowNull'], false),
                ], true),
            ], new FormeConfigurableExportProcessHandler(InputProcessHandlerConvertBool)),

            //input.int(bool)
            int: new FormeConfigurableMethod('int', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool(['null', 'allowNull'], false),
                ], true),
            ], new FormeConfigurableExportProcessHandler(InputProcessHandlerConvertInt)),

            //input.float(bool)
            float: new FormeConfigurableMethod('float', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool(['null', 'allowNull'], false),
                ], true),
            ], new FormeConfigurableExportProcessHandler(InputProcessHandlerConvertFloat)),

            //input.string(bool)
            string: new FormeConfigurableMethod('string', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool(['null', 'allowNull'], false),
                ], true),
            ], new FormeConfigurableExportProcessHandler(InputProcessHandlerConvertString)),

            //--- special actions ---

            //input.next()
            next: new FormeConfigurableMethod('next', [
                new FormeConfigurableOverride([], true),
            ], new FormeConfigurableExportSpecialTrigger(constants.actions.next)),

            //input.prev()
            prev: new FormeConfigurableMethod('prev', [
                new FormeConfigurableOverride([], true),
            ], new FormeConfigurableExportSpecialTrigger(constants.actions.prev)),

            //input.reset()
            reset: new FormeConfigurableMethod('reset', [
                new FormeConfigurableOverride([], true),
            ], new FormeConfigurableExportSpecialTrigger(constants.actions.reset)),

            //input.rerun()
            rerun: new FormeConfigurableMethod('rerun', [
                new FormeConfigurableOverride([], true),
            ], new FormeConfigurableExportSpecialTrigger(constants.actions.rerun)),

            //input.submitter()
            submitter: new FormeConfigurableMethod('submitter', [
                new FormeConfigurableOverride([], true),
            ], new FormeConfigurableExportSpecialTrigger(constants.actions.submit)),

            //--- validation ---

            //input.require(bool)
            require: new FormeConfigurableMethod('require', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool(['require', 'required'], false, true),
                    new FormeConfigurableString('error', false),
                ], true),
            ], new FormeConfigurableExportValidateHandler(InputValidateHandlerRequire)),
            required: new FormeConfigurableMethodPointer('require'),

            //input.blacklist(*multiple*)
            blacklist: new FormeConfigurableMethod('blacklist', [
                //input.blacklist(param, string)
                new FormeConfigurableOverride([
                    new FormeConfigurableParam(['blacklist', 'options', 'options', 'value', 'values'], true),
                    new FormeConfigurableString('error', true),
                ], false),

                //input.blacklist(value)
                new FormeConfigurableOverride([
                    new FormeConfigurableParam(['blacklist', 'options', 'options', 'value', 'values'], true),
                ], true),
            ], new FormeConfigurableExportValidateHandler(InputValidateHandlerBlacklist)),

            //input.size(int)
            size: new FormeConfigurableMethod('size', [
                new FormeConfigurableOverride([
                    new FormeConfigurableInt('size', false),
                ], true),
            ], new FormeConfigurableExportValidateHandler(InputValidateHandlerSize)),

            //input.min(int)
            min: new FormeConfigurableMethod('min', [
                new FormeConfigurableOverride([
                    new FormeConfigurableInt('min', false),
                ], true),
            ], new FormeConfigurableExportValidateHandler(InputValidateHandlerMin)),

            //input.max(int)
            max: new FormeConfigurableMethod('max', [
                new FormeConfigurableOverride([
                    new FormeConfigurableInt('max', false),
                ], true),
            ], new FormeConfigurableExportValidateHandler(InputValidateHandlerMax)),

            //input.is(*multiple*)
            is: new FormeConfigurableMethod('is', [
                //input.is(string, object, string)
                new FormeConfigurableOverride([
                    new FormeConfigurableString('type', true),
                    new FormeConfigurableObject('options', true),
                    new FormeConfigurableString('error', true),
                ], false),

                //input.is(string, object)
                new FormeConfigurableOverride([
                    new FormeConfigurableString('type', true),
                    new FormeConfigurableObject('options', true),
                ], false),

                //input.is(string)
                new FormeConfigurableOverride([
                    new FormeConfigurableString('type', true),
                ], true),
            ], new FormeConfigurableExportValidateHandler(InputValidateHandlerIs)),

            //input.match(*multiple*)
            match: new FormeConfigurableMethod('match', [
                //input.match(string, string)
                new FormeConfigurableOverride([
                    new FormeConfigurableString(['path', 'target', 'name', 'element', 'input'], true),
                    new FormeConfigurableString('error', true),
                ], false),

                //input.match(string)
                new FormeConfigurableOverride([
                    new FormeConfigurableString(['path', 'target', 'name', 'element', 'input'], true),
                ], true),
            ], new FormeConfigurableExportValidateHandler(InputValidateHandlerMatch)),

            //input.options(*multiple*)
            options: new FormeConfigurableMethod('options', [
                //input.options(array, bool, string)
                new FormeConfigurableOverride([
                    new FormeConfigurableArray(['options', 'option', 'items', 'item', 'value', 'values'], true),
                    new FormeConfigurableString('error', true),
                ], false),

                //input.options(object, string)
                new FormeConfigurableOverride([
                    new FormeConfigurableObject(['options', 'option', 'items', 'item', 'value', 'values'], true),
                    new FormeConfigurableString('error', true),
                ], false),

                //input.options(string, string)
                new FormeConfigurableOverride([
                    new FormeConfigurableString(['options', 'option', 'items', 'item', 'value', 'values'], true),
                    new FormeConfigurableString('error', true),
                ], false),

                //input.options(array)
                new FormeConfigurableOverride([
                    new FormeConfigurableArray(['options', 'option', 'items', 'item', 'value', 'values'], true),
                ], true),

                //input.options(object)
                new FormeConfigurableOverride([
                    new FormeConfigurableObject(['options', 'option', 'items', 'item', 'value', 'values'], true),
                ], true),

                //input.options(string)
                new FormeConfigurableOverride([
                    new FormeConfigurableString(['options', 'option', 'items', 'item', 'value', 'values'], true),
                ], true),
            ], new FormeConfigurableExportValidateHandler(InputValidateHandlerOptions)),
            option: new FormeConfigurableMethodPointer('options'),

            //--- callbacks ---

            //base.validate(callback(s))
            validate: new FormeConfigurableMethod('validate', [
                new FormeConfigurableOverride([
                    new FormeConfigurableCallbacks(['callback', 'callbacks'], true),
                    new FormeConfigurableString('error', false),
                ], true),
            ], new FormeConfigurableExportValidateHandlers(InputValidateHandlerCustom)),
        });
    }

    //static functions
    static _lookupHandlerClass(type) {
        const handlerClass = super._lookupHandlerClass(type);
        if (handlerClass) {
            return handlerClass;
        }
        return handlerClassLookup[type];
    }

    //private properties
    get _outputName() {
        return this._alias !== null?this._alias:this._name;
    }

    get _calculatedType() {
        if (this._type !== null) {
            //overridden by user
            return this._type;
        } else {
            //pick defaults
            if (this._hidden) {
                return 'hidden';
            } else {
                //check for types based on actions
                if (this._triggers !== null) {
                    for(let action of this._triggers) {
                        //special actions
                        if (action.special) {
                            switch(action.action) {
                                case constants.actions.prev:
                                case constants.actions.next:
                                case constants.actions.reset:
                                    return 'button';
                                case constants.actions.rerun:
                                case constants.actions.submit:
                                    return 'submit';
                            }
                        }
                    }
                }

                //standard types
                if (this._checked !== null) {
                    //checkbox
                    return 'checkbox';
                } else {
                    //is it secured (override always)
                    if (this._secure) {
                        return 'password';
                    } else {
                        //lookup type based on handlers
                        let type = 'text';//default to 'text'

                        //iterate all handlers and apply their html5 input types (handlers later in the chain take precedence)
                        for (let handler of this._executeHandlers) {
                            //check to see if handler sets type
                            let handlerType = handler.htmlInputType;
                            if (handlerType !== null) {
                                type = handlerType;
                            }
                        }

                        //not found, return default
                        return type;
                    }
                }
            }
        }
    }

    get _requestRawValue() {
        if (this._form._currentRequest) {
            return this._form._currentRequest._getRawValue(this._name);
        } else {
            return undefined;
        }
    }

    get _requestValue() {
        if (this._form._currentRequest) {
            return this._form._currentRequest._getValue(this._name);
        } else {
            return undefined;
        }
    }

    get _errorPath() {
        return this.path;
    }

    get _errorName() {
        return this._name;
    }

    //properties
    get formeClass() {
        return 'input';
    }

    get configuration() {
        return Object.assign(super.configuration, {

        });
    }

    get parent() {
        //what does this belong to?
        return this._component || this._page || this._form;
    }

    //private build values methods
    _buildValuesSelf(options) {
        //all we need to do is return the inputs current value... the structure is dictated by teh calling parent!
        //fetch the initial value
        let value = null;
        if (options.store) {
            //see if store contains this value
            value = this._request._getStoreValue(this._pathSegments, value);
        }

        //read from request state from "raw" or "values" (dont set value if its not defined in the specified target)
        if (options.raw) {
            value = this._request._getRawValue(this._name, value);
        } else {
            value = this._request._getValue(this._name, value);
        }

        //chain
        return value;
    }

    _buildValuesInclude(options) {
        return (!options.secure || !this._secure) && (this._keep || ((options.special || !this._special) && (!options.ignore || !this._ignore)));
    }

    //private build template methods
    _buildTemplateVars(options) {
        const vars = super._buildTemplateVars(options);
        const type = this._calculatedType;
        const required = !this._form._unrequire && this._required;

        //build class names
        const classNames = [];
        const stateClassNames = [];

        //special types
        if (type === 'button' || type === 'submit') {
            //button
            if (this._form._buttonClassNames.length) {
                for (let className of this._form._buttonClassNames) {
                    classNames.push(className);
                }
            }
        } else {
            //input
            if (this._form._inputClassNames.length) {
                for (let className of this._form._inputClassNames) {
                    classNames.push(className);
                }
            }
        }

        //required
        if (required && this._form._requiredClassNames.length) {
            for (let className of this._form._requiredClassNames) {
                classNames.push(className);
                stateClassNames.push(className)
            }
        }

        //input vars
        vars.id = this._uniqueName;
        vars.type = type;
        vars.alias = this._outputName;
        vars.className = utils.string.merge.classNames(vars.className, classNames);//merge with parent
        vars.stateClassName = utils.string.merge.classNames(vars.stateClassName, stateClassNames);//merge with parent
        vars.icon = this._icon;
        vars.data = Object.assign({}, ...this._data.map(data => ({['data-' + data.name]: data.value})));
        vars.help = this._help;
        vars.placeholder = this._placeholder;
        vars.required = required;
        vars.readonly = this._readonly;
        vars.value = this._requestValue;
        vars.checked = (this._requestFirst && this._checked) || (!this._requestFirst && ((type === 'checkbox' && this._requestValue !== null) || (type !== 'checkbox' && this._requestValue !== null)));
        vars.options = this._options;
        vars.rendered = null;//null indicates that there was no template! (dont populate these yet because we might cause an infinite loop on user code. )

        //chain
        return vars;
    }

    _buildTemplateFinalise(options, parent) {
        return super._buildTemplateFinalise(options, parent)
        .then(parent => {
            //does the input have a template
            if (!this._template) {
                //no template so chain em!
                return parent;
            } else {
                if (this._templateClient) {
                    //client renders template so just pass on teh details for client to deal with
                    parent.template = this._template;
                    return parent;
                } else {
                    //server needs to render the template
                    return utils.promise.result(this._driver.renderInputTemplate(this._form, this, this._template, parent))
                    .then(rendered => {
                        //done, so lets dump details into rendered
                        parent.rendered = rendered || '';

                        //chain
                        return parent;
                    });
                }
            }
        });
    }

    //private process methods
    _processStateWithProcessHandlers(state) {
        //used when getting values for this input that need processing!
        if (this._processHandlers.length) {
            const oldValue = state.value;

            try {
                //synchronous execute of process handlers
                for (let handler of this._processHandlers) {
                    handler.execute(this, state);
                }

                //save state change
                if (state.value !== oldValue) {
                    this._form._setNamedValue(this._name, state.value);
                }
            }
            catch(err) {
                //catch error, but still save state change
                if (state.value !== oldValue) {
                    this._form._setNamedValue(this._name, state.value);
                }

                //pass error on!
                throw err;
            }
        }
    }

    _processExecutionStateChanges(oldState, newState) {
        //process to see if any values have changed
        if (newState.value !== oldState.value) {
            this.setValue(newState.value);
        }
    }

    //private execute handler methods
    _executeValidateHandler(handler, state) {
        return handler.call(this, this, state);
    }

    _executeInvalidHandler(handler) {
        return handler.call(this, this._form, this);
    }

    _executeValidHandler(handler) {
        return handler.call(this, this._form, this);
    }

    _executeSuccessHandler(handler) {
        //should be overridden
        return handler.call(this, this._form, this);
    }

    _executeFailHandler(handler) {
        //should be overridden
        return handler.call(this, this._form, this);
    }

    _executeSubmitHandler(handler) {
        //should be overridden
        return handler.call(this, this._form, this);
    }

    _executeDoneHandler(handler) {
        return handler.call(this, this._form, this);
    }

    _executeSetterHandler(handler, value, merge) {
        return handler.call(this, this._form, this, value, merge);
    }

    //private create methods
    _createError(message) {
        return new FormeInputError(message);
    }

    _createExecutionState(value) {
        return {
            require: false,
            value: this._form._getNamedValue(this._name),
        };
    }

    //private get methods
    _getProcessedValue(value) {
        //allows for reading value from the input even when it hasnt submitted!
        const state = this._createExecutionState(arguments.length > 0?value:this._form._getNamedValue(this._name));
        this._processStateWithProcessHandlers(state);
        return state.value;
    }

    //private set value methods
    _setValuePrimitive(value, merge, setter) {
        this._form._setNamedValue(this._name, value);

        //handled
        return true;
    }

    //private add methods
    _addSpecialTrigger(action) {
        //ad the action itself!
        this._addTrigger(null, action, null, true);

        //need to update the default value to something!
        this._defaultValue = this._defaultValue !== null?this._defaultValue:this._name;

        //flag as special
        this._special = true;
    }

    _addCustomValidateHandler(callback, error) {
        this._addValidateHandler(new InputValidateHandlerCustom(callback, error));
    }

    //private clear methods
    _clearValue() {
        this._form._setNamedValue(this._name, null);
    }

    //private convert methods
    _convertElementValues(input, out) {
        //add self to output
        out[this._name] = input;

        //chain out
        return out;
    }

    //configuration
    type(type) {
        if (this.callingConfigureMethod('type')) {
            this._type = type;

            //chain
            return this;
        }
    }

    alias(alias) {
        if (this.callingConfigureMethod('alias')) {
            //change the name used in template var / values
            this._alias = alias;

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

    ignore(ignore) {
        if (this.callingConfigureMethod('ignore')) {
            this._ignore = arguments.length?!!ignore:true;

            //chain
            return this;
        }
    }

    keep(keep) {
        if (this.callingConfigureMethod('keep')) {
            if (this._secure) {
                throw new Error(`cant use ${this.formeClass}.keep() after input.secure()`);
            }

            this._keep = arguments.length?!!keep:true;

            //chain
            return this;
        }
    }

    expose(expose) {
        if (this.callingConfigureMethod('expose')) {
            this._expose = arguments.length?!!expose:true;

            //chain
            return this;
        }
    }

    secure(secure) {
        if (this.callingConfigureMethod('secure')) {
            //prevent secure mode whilst keeping
            if (this._keep) {
                throw new Error(`cant use ${this.formeClass}.secure() after ${this.formeClass}.keep()`);
            }

            //prevent this value from being stored by the app between container calls
            this._secure = arguments.length?!!secure:true;

            //chain
            return this;
        }
    }

    readonly(readonly) {
        if (this.callingConfigureMethod('readonly')) {
            //change default readonly state
            this._readonly = arguments.length?!!readonly:true;

            //chain
            return this;
        }
    }

    hidden(hidden) {
        if (this.callingConfigureMethod('hidden')) {
            //change default hidden state
            this._hidden = arguments.length?!!hidden:true;

            //chain
            return this;
        }
    }

    icon(icon) {
        if (this.callingConfigureMethod('icon')) {
            this._icon = icon || null;

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

    permanent(permanent) {
        if (this.callingConfigureMethod('permanent')) {
            //forces the value to always be this when returned to the template or validation
            this._permanentValue = arguments.length?permanent:null;

            //chain
            return this;
        }
    }

    override(override) {
        if (this.callingConfigureMethod('override')) {
            //forces the value to always be this when returned to validation
            this._overrideValue = arguments.length?override:null;

            //chain
            return this;
        }
    }

    defaultValue(value) {
        if (this.callingConfigureMethod('defaultValue')) {
            this._defaultValue = value || null;

            //chain
            return this;
        }
    }

    empty(value) {
        if (this.callingConfigureMethod('empty')) {
            //add handler
            this._addProcessHandler(new InputProcessHandlerEmpty(value));

            //chain
            return this;
        }
    }

    id(id) {
        if (this.callingConfigureMethod('id')) {
            //allow to override id
            this._id = id;

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

    data() {
        if (this.callingConfigureMethod('data')) {
            if (arguments.length === 2 || (arguments.length === 1 && typeof arguments[0] === 'string')) {
                //single data
                this._data.push({
                    name: arguments[0],
                    value: arguments.length > 0?arguments[1]:'',
                });
            } else if (arguments.length === 1 && typeof arguments[0] === 'object') {
                //single object
                const data = arguments[0];
                for(let name of Object.keys(data)) {
                    const value = data[name];
                    this._data.push({
                        name: name,
                        value: value ? value : '',
                    });
                }
            }

            //chain
            return this;
        }
    }

    help(help) {
        if (this.callingConfigureMethod('help')) {
            this._help = help;

            //chain
            return this;
        }
    }

    bool(allowNull) {
        if (this.callingConfigureMethod('bool')) {
            //add handler
            this._addProcessHandler(new InputProcessHandlerConvertBool(allowNull));

            //chain
            return this;
        }
    }

    int(allowNull) {
        if (this.callingConfigureMethod('int')) {
            //convert value to int, force indicates this the value will be forced to exist

            //add handler
            this._addProcessHandler(new InputProcessHandlerConvertInt(allowNull));

            //chain
            return this;
        }
    }

    float(allowNull) {
        if (this.callingConfigureMethod('float')) {
            //convert value to float, force indicates this the value will be forced to exist

            //add handler
            this._addProcessHandler(new InputProcessHandlerConvertFloat(allowNull));

            //chain
            return this;
        }
    }

    string(allowNull) {
        if (this.callingConfigureMethod('string')) {
            //convert value to string, force indicates this the value will be forced to exist

            //add handler
            this._addProcessHandler(new InputProcessHandlerConvertString(allowNull));

            //chain
            return this;
        }
    }

    //special actions (configure)
    next() {
        if (this.callingConfigureMethod('next')) {
            this._addSpecialTrigger(constants.actions.next);

            //chain
            return this;
        }
    }

    prev() {
        if (this.callingConfigureMethod('prev')) {
            this._addSpecialTrigger(constants.actions.prev);

            //chain
            return this;
        }
    }

    reset() {
        if (this.callingConfigureMethod('reset')) {
            this._addSpecialTrigger(constants.actions.reset);

            //chain
            return this;
        }
    }

    rerun() {
        if (this.callingConfigureMethod('rerun')) {
            this._addSpecialTrigger(constants.actions.rerun);

            //chain
            return this;
        }
    }

    submitter() {
        //submit special action
        if (this.callingConfigureMethod('submitter')) {
            this._addSpecialTrigger(constants.actions.submit);

            //chain
            return this;
        }
    }

    //validation (configuration)
    require(require, error) {
        if (this.callingConfigureMethod('require')) {
            if (require !== undefined && !require) {
                //remove requirement
                this._required = false;
                this._removeValidateHandler(InputValidateHandlerRequire);

            } else {
                //add requirement
                this._required = true;
                this._addValidateHandler(new InputValidateHandlerRequire(error));
            }

            //chain
            return this;
        }
    }

    required() {
        //shortcut
        return this.require(...arguments);
    }

    blacklist(options, error) {
        if (this.callingConfigureMethod('blacklist')) {
            //build list of values
            let blacklist;

            if (options instanceof Array) {
                //array of ?
                blacklist = options;
            } else if (options instanceof Object) {
                //object with value/label pairs
                blacklist = [];
                for (let value of Object.keys(options)) {
                    blacklist.push(options[value]);
                }
            } else {
                blacklist = [options];
            }

            //add handler
            this._addValidateHandler(new InputValidateHandlerBlacklist(blacklist, error));

            //chain
            return this;
        }
    }

    size(size, error) {
        if (this.callingConfigureMethod('size')) {
            //requires exact size

            //add handler
            this._addValidateHandler(new InputValidateHandlerSize(size, size, error));

            //chain
            return this;
        }
    }

    min(size, error) {
        if (arguments.length === 0) {
            //find lowest
            const handlers = this._findValidateHandlers(InputValidateHandlerMax);

            let lowest = null;
            if (handlers.length) {
                for(let handler of handlers) {
                    lowest = lowest === null?handler.min:Math.min(lowest, handler.min);
                }
            }
            return lowest;
        } else {
            if (this.callingConfigureMethod('min')) {
                //requires min size

                //add handler
                this._addValidateHandler(new InputValidateHandlerMin(size, error));

                //chain
                return this;
            }
        }
    }

    max(size, error) {
        if (arguments.length === 0) {
            //find highest
            const handlers = this._findValidateHandlers(InputValidateHandlerMax);

            let highest = null;
            if (handlers.length) {
                for(let handler of handlers) {
                    highest = highest === null?handler.max:Math.max(highest, handler.max);
                }
            }
            return highest;
        } else {
            if (this.callingConfigureMethod('max')) {
                //requires max

                //add handler
                this._addValidateHandler(new InputValidateHandlerMax(size, error));

                //chain
                return this;
            }
        }
    }

    is(type, options, error) {
        if (this.callingConfigureMethod('is')) {
            //validate the value against various value types
            this._addValidateHandler(new InputValidateHandlerIs(type, options, error));

            //chain
            return this;
        }
    }

    match(path, error) {
        if (this.callingConfigureMethod('match')) {
            //validate the value against various value types
            this._addValidateHandler(new InputValidateHandlerMatch(path, error));

            //chain
            return this;
        }
    }

    options(options, error) {
        if (this.callingConfigureMethod('options')) {
            //a specific set of options is required

            //set options
            this._options = [];

            if (options instanceof Array) {
                //array of ?
                if (options.length) {
                    if (options[0] instanceof Array) {
                        //array of arrays
                        for (let index = 0; index < options.length; index++) {
                            const option = options[index];
                            if (option instanceof Array && option.length >= 1) {
                                const label = option[0] || null;
                                const value = option[1] || label || null;

                                if (label || value) {
                                    this._options.push({
                                        label: label,
                                        value: value,
                                    });
                                }
                            }
                        }

                    } else if (options[0] instanceof Object) {
                        //array of value/label objects
                        for (let index = 0; index < options.length; index++) {
                            if (options[index].value !== undefined) {
                                this._options.push({
                                    label: options[index].label !== undefined ? options[index].label : options[index].value,
                                    value: options[index].value,
                                });
                            }
                        }
                    } else {
                        //array of values
                        for (let index = 0; index < options.length; index++) {
                            const value = options[index];

                            this._options.push({
                                label: value,
                                value: value,
                            });
                        }
                    }
                }
            } else if (options instanceof Object) {
                //object with value/label pairs
                for (let value of Object.keys(options)) {
                    this._options.push({
                        label: options[value],
                        value: value,
                    });
                }
            } else {
                options = [options];
            }

            //add handler
            this._addValidateHandler(new InputValidateHandlerOptions(options, error));

            //chain
            return this;
        }
    }

    option() {
        return super.options(...arguments);
    }

    //public get methods
    getValue() {
        //this is easy because an input always has a name!
        return this._form._getNamedValue(this._name);
    }
}

//expose
module.exports = FormeInput;