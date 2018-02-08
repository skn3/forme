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

    FormeConfigurableExportInputActions,
    FormeConfigurableExportInputSpecialAction,
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
const handlerLookup = {
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
        this._classNames = [];
        this._placeholder = null;
        this._data = [];
        this._help = '';
        this._options = [];
        this._pipe = false;
        this._actionTriggers = null;
        this._special = false;
        this._template = null;
        this._templateClient = null;
        this._special = false;
        this._template = null;
    }

    //private properties
    get _outputName() {
        return this._alias !== null?this._alias:this._name;
    }

    get _pathSegments() {
        const segments = [];
        if (this._group && this._group.length) {
            segments.push(...this._group);
        }
        segments.push(this._outputName);
        return segments;
    }

    //private properties
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
                if (this._actionTriggers !== null) {
                    for(let action of this._actionTriggers) {
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

    //private build configuration methods
    _buildConfigurableMethods() {
        return Object.assign(super._buildConfigurableMethods(), {
            //--- configuration ---

            //baseInput.type(string)
            type: new FormeConfigurableMethod('type', [
                new FormeConfigurableOverride([
                    new FormeConfigurableString('type', false),
                ], true),
            ], new FormeConfigurableExportString('_type')),

            //baseInput.group(string(s), append)
            group: new FormeConfigurableMethod('group', [
                new FormeConfigurableOverride([
                    new FormeConfigurableStrings(['group', 'groups'], true),
                    new FormeConfigurableBool('append', false, true),
                ], true),
            ], new FormeConfigurableExportArrayStrings('_group')),

            //baseInput.alias(string)
            alias: new FormeConfigurableMethod('alias', [
                new FormeConfigurableOverride([
                    new FormeConfigurableString('alias', false),
                ], true),
            ], new FormeConfigurableExportString('_alias')),

            //baseInput.template(*multiple*)
            template: new FormeConfigurableMethod('template', [
                //baseInput.template(template, client)
                new FormeConfigurableOverride([
                    new FormeConfigurableString(['template', 'path', 'name'], true),
                    new FormeConfigurableBool('client', true, false),
                ], false),

                //baseInput.template(template)
                new FormeConfigurableOverride([
                    new FormeConfigurableString(['template', 'path', 'name'], false),
                ], true),
            ], new FormeConfigurableExportString('_template')),

            //baseInput.ignore(bool)
            ignore: new FormeConfigurableMethod('ignore', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool('ignore', false),
                ], true),
            ], new FormeConfigurableExportBool('_ignore')),

            //baseInput.keep(bool)
            keep: new FormeConfigurableMethod('keep', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool('keep', false),
                ], true),
            ], new FormeConfigurableExportBool('_keep')),

            //baseInput.expose(bool)
            expose: new FormeConfigurableMethod('expose', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool('expose', false, true),
                ], true),
            ], new FormeConfigurableExportBool('_expose')),

            //baseInput.secure(bool)
            secure: new FormeConfigurableMethod('secure', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool(['secure', 'secured'], false),
                ], true),
            ], new FormeConfigurableExportBool('_secure')),

            //baseInput.readonly(bool)
            readonly: new FormeConfigurableMethod('readonly', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool('readonly', false),
                ], true),
            ], new FormeConfigurableExportBool('_readonly')),

            //baseInput.hidden(bool)
            hidden: new FormeConfigurableMethod('hidden', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool('hidden', false),
                ], true),
            ], new FormeConfigurableExportBool('_hidden')),

            //baseInput.icon(string)
            icon: new FormeConfigurableMethod('icon', [
                new FormeConfigurableOverride([
                    new FormeConfigurableString('icon', false),
                ], true),
            ], new FormeConfigurableExportString('_icon')),

            //baseInput.checked(bool)
            checked: new FormeConfigurableMethod('checked', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool('checked', false),
                ], true),
            ], new FormeConfigurableExportBool('_checked')),

            //baseInput.permanent(value)
            permanent: new FormeConfigurableMethod('permanent', [
                new FormeConfigurableOverride([
                    new FormeConfigurableParam(['value', 'permanent'], false),
                ], true),
            ], new FormeConfigurableExportParam('_permanentValue')),

            //baseInput.override(value)
            override: new FormeConfigurableMethod('override', [
                new FormeConfigurableOverride([
                    new FormeConfigurableString(['value', 'override'], false),
                ], true),
            ], new FormeConfigurableExportParam('_overrideValue')),

            //baseInput.id(string)
            id: new FormeConfigurableMethod('id', [
                new FormeConfigurableOverride([
                    new FormeConfigurableString('id', false),
                ], true),
            ], new FormeConfigurableExportString('_id')),

            //baseInput.className(string)
            className: new FormeConfigurableMethod('className', [
                new FormeConfigurableOverride([
                    new FormeConfigurableStrings(['className', 'class'], false),
                ], true),
            ], new FormeConfigurableExportArrayStrings('_classNames')),

            //baseInput.placeholder(string)
            placeholder: new FormeConfigurableMethod('placeholder', [
                new FormeConfigurableOverride([
                    new FormeConfigurableString('placeholder', false),
                ], true),
            ], new FormeConfigurableExportString('_placeholder')),

            //baseInput.value(value)
            value: new FormeConfigurableMethod('value', [
                new FormeConfigurableOverride([
                    new FormeConfigurableParam('value', false),
                ], true),
            ], new FormeConfigurableExportParam('_defaultValue')),

            //baseInput.empty(value)
            empty: new FormeConfigurableMethod('empty', [
                new FormeConfigurableOverride([
                    new FormeConfigurableParam('value', false),
                ], true),
            ], new FormeConfigurableExportProcessHandler(InputProcessHandlerEmpty)),

            //baseInput.data(*multiple*)
            data: new FormeConfigurableMethod('data', [
                //baseInput.data(key, value)
                new FormeConfigurableOverride([
                    new FormeConfigurableString(['name', 'key', 'id'], true),
                    new FormeConfigurableParam('value', false),
                ], false),

                //baseInput.data(object)
                new FormeConfigurableOverride([
                    new FormeConfigurableObject(['data', 'value'], true),
                ], true),
            ], new FormeConfigurableExportArrayObjectsAssign('_data')),

            //baseInput.help(string)
            help: new FormeConfigurableMethod('help', [
                new FormeConfigurableOverride([
                    new FormeConfigurableString('help', false),
                ], true),
            ], new FormeConfigurableExportString('_help')),

            //baseInput.pipe(value)
            pipe: new FormeConfigurableMethod('pipe', [
                new FormeConfigurableOverride([
                    new FormeConfigurableParam('pipe', false),
                ], true),
            ], new FormeConfigurableExportNot('_pipe', false)),

            //baseInput.bool(bool)
            bool: new FormeConfigurableMethod('bool', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool(['null', 'allowNull'], false),
                ], true),
            ], new FormeConfigurableExportProcessHandler(InputProcessHandlerConvertBool)),

            //baseInput.int(bool)
            int: new FormeConfigurableMethod('int', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool(['null', 'allowNull'], false),
                ], true),
            ], new FormeConfigurableExportProcessHandler(InputProcessHandlerConvertInt)),

            //baseInput.float(bool)
            float: new FormeConfigurableMethod('float', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool(['null', 'allowNull'], false),
                ], true),
            ], new FormeConfigurableExportProcessHandler(InputProcessHandlerConvertFloat)),

            //baseInput.string(bool)
            string: new FormeConfigurableMethod('string', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool(['null', 'allowNull'], false),
                ], true),
            ], new FormeConfigurableExportProcessHandler(InputProcessHandlerConvertString)),

            //--- actions ---

            //baseInput.action(string(s), value, value)
            action: new FormeConfigurableMethod('action', [
                new FormeConfigurableOverride([
                    new FormeConfigurableStrings(['action', 'actions'], true),
                    new FormeConfigurableParam('value', false),
                    new FormeConfigurableParam('context', false),
                ], true),
            ], new FormeConfigurableExportInputActions()),

            //baseInput.actions(*pointer*)
            actions: new FormeConfigurableMethodPointer('action'),

            //baseInput.next()
            next: new FormeConfigurableMethod('next', [
                new FormeConfigurableOverride([], true),
            ], new FormeConfigurableExportInputSpecialAction(constants.actions.next)),

            //baseInput.prev()
            prev: new FormeConfigurableMethod('prev', [
                new FormeConfigurableOverride([], true),
            ], new FormeConfigurableExportInputSpecialAction(constants.actions.prev)),

            //baseInput.reset()
            reset: new FormeConfigurableMethod('reset', [
                new FormeConfigurableOverride([], true),
            ], new FormeConfigurableExportInputSpecialAction(constants.actions.reset)),

            //baseInput.rerun()
            rerun: new FormeConfigurableMethod('rerun', [
                new FormeConfigurableOverride([], true),
            ], new FormeConfigurableExportInputSpecialAction(constants.actions.rerun)),

            //baseInput.submitter()
            submitter: new FormeConfigurableMethod('submitter', [
                new FormeConfigurableOverride([], true),
            ], new FormeConfigurableExportInputSpecialAction(constants.actions.submit)),

            //--- validation ---

            //baseInput.require(bool)
            require: new FormeConfigurableMethod('require', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool(['require', 'required'], false, true),
                    new FormeConfigurableString('error', false),
                ], true),
            ], new FormeConfigurableExportValidateHandler(InputValidateHandlerRequire)),
            required: new FormeConfigurableMethodPointer('require'),

            //baseInput.blacklist(*multiple*)
            blacklist: new FormeConfigurableMethod('blacklist', [
                //baseInput.blacklist(value, bool, string)
                new FormeConfigurableOverride([
                    new FormeConfigurableParam('blacklist', true),
                    new FormeConfigurableBool('strict', true),
                    new FormeConfigurableString('error', true),
                ], false),

                //baseInput.blacklist(value, bool)
                new FormeConfigurableOverride([
                    new FormeConfigurableParam('blacklist', true),
                    new FormeConfigurableBool('strict', true),
                ], false),

                //baseInput.blacklist(value)
                new FormeConfigurableOverride([
                    new FormeConfigurableParam('blacklist', true),
                ], true),
            ], new FormeConfigurableExportValidateHandler(InputValidateHandlerBlacklist)),

            //baseInput.size(int)
            size: new FormeConfigurableMethod('size', [
                new FormeConfigurableOverride([
                    new FormeConfigurableInt('size', false),
                ], true),
            ], new FormeConfigurableExportValidateHandler(InputValidateHandlerSize)),

            //baseInput.min(int)
            min: new FormeConfigurableMethod('min', [
                new FormeConfigurableOverride([
                    new FormeConfigurableInt('min', false),
                ], true),
            ], new FormeConfigurableExportValidateHandler(InputValidateHandlerMin)),

            //baseInput.max(int)
            max: new FormeConfigurableMethod('max', [
                new FormeConfigurableOverride([
                    new FormeConfigurableInt('max', false),
                ], true),
            ], new FormeConfigurableExportValidateHandler(InputValidateHandlerMax)),

            //baseInput.is(*multiple*)
            is: new FormeConfigurableMethod('is', [
                //baseInput.is(string, object, string)
                new FormeConfigurableOverride([
                    new FormeConfigurableString('type', true),
                    new FormeConfigurableObject('options', true),
                    new FormeConfigurableString('error', true),
                ], false),

                //baseInput.is(string, object)
                new FormeConfigurableOverride([
                    new FormeConfigurableString('type', true),
                    new FormeConfigurableObject('options', true),
                ], false),

                //baseInput.is(string)
                new FormeConfigurableOverride([
                    new FormeConfigurableString('type', true),
                ], true),
            ], new FormeConfigurableExportValidateHandler(InputValidateHandlerIs)),

            //baseInput.match(*multiple*)
            match: new FormeConfigurableMethod('match', [
                //baseInput.match(string, bool, string)
                new FormeConfigurableOverride([
                    new FormeConfigurableString(['target', 'name', 'path'], true),
                    new FormeConfigurableBool('strict', true),
                    new FormeConfigurableString('error', true),
                ], false),

                //baseInput.match(string, bool)
                new FormeConfigurableOverride([
                    new FormeConfigurableString(['target', 'name', 'path'], true),
                    new FormeConfigurableBool('strict', true),
                ], false),

                //baseInput.match(string)
                new FormeConfigurableOverride([
                    new FormeConfigurableString(['target', 'name', 'path'], true),
                ], true),
            ], new FormeConfigurableExportValidateHandler(InputValidateHandlerMatch)),

            //baseInput.options(*multiple*)
            options: new FormeConfigurableMethod('options', [
                //baseInput.options(array, bool, string)
                new FormeConfigurableOverride([
                    new FormeConfigurableArray('options', true),
                    new FormeConfigurableBool('strict', true),
                    new FormeConfigurableString('error', true),
                ], false),

                //baseInput.options(object, bool, string)
                new FormeConfigurableOverride([
                    new FormeConfigurableObject('options', true),
                    new FormeConfigurableBool('strict', true),
                    new FormeConfigurableString('error', true),
                ], false),

                //baseInput.options(array, bool)
                new FormeConfigurableOverride([
                    new FormeConfigurableArray('options', true),
                    new FormeConfigurableBool('strict', true),
                ], false),

                //baseInput.options(object, bool)
                new FormeConfigurableOverride([
                    new FormeConfigurableObject('options', true),
                    new FormeConfigurableBool('strict', true),
                ], false),

                //baseInput.options(array)
                new FormeConfigurableOverride([
                    new FormeConfigurableArray('options', true),
                ], true),

                //baseInput.options(object)
                new FormeConfigurableOverride([
                    new FormeConfigurableObject('options', true),
                ], true),
            ], new FormeConfigurableExportValidateHandler(InputValidateHandlerOptions)),

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
                    this._form._setInputNameValue(this._name, state.value);
                }
            }
            catch(err) {
                //catch error, but still save state change
                if (state.value !== oldValue) {
                    this._form._setInputNameValue(this._name, state.value);
                }

                //pass error on!
                throw err;
            }
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

    //private create methods
    _createError(message) {
        return new FormeInputError(message);
    }

    _createExecutionState(value) {
        return {
            require: false,
            value: value,
        };
    }

    //private get methods
    _getProcessedValue(value) {
        //allows for reading value from the input even when it hasnt submitted!
        const state = this._createExecutionState(arguments.length > 0?value:this._form._getInputNameValue(this._name));
        this._processStateWithProcessHandlers(state);
        return state.value;
    }

    //private find methods
    _findCustomActions() {
        if (!this._actionTriggers) {
            return [];
        } else {
            return this._actionTriggers.filter(action => !action.special);
        }
    }

    _findSpecialAction(search) {
        if (!this._actionTriggers) {
            return [];
        } else {
            return this._actionTriggers.find(action => action.special && action.action === search);
        }
    }

    //private add methods
    _addActions(actions, value, context, special) {
        //allow multiple actions
        if (this._actionTriggers === null) {
            this._actionTriggers = [];
        }

        //allow add of multiple actions with same context
        if (!Array.isArray(actions)) {
            this._actionTriggers.push({
                action: actions,
                value: value,
                context: context,
                special: special,
            });
        } else {
            for (let action of actions) {
                this._actionTriggers.push({
                    action: action,
                    value: value,
                    context: context,
                    special: special,
                });
            }
        }

        //chain
        return this;
    }

    _addSpecialAction(action) {
        //ad the action itself!
        this._addActions(action, null, null, true);

        //need to update the default value to something!
        this._defaultValue = this._defaultValue !== null?this._defaultValue:this._name;

        //flag as special
        this._special = true;

        //chain
        return this;
    }

    _addCustomValidateHandler(callback, error) {
        this._addValidateHandler(new InputValidateHandlerCustom(callback, error));
    }

    //configuration
    type(type) {
        if (this.callingConfigureMethod('type')) {
            this._type = type;

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

    value(defaultValue) {
        if (this.callingConfigureMethod('value')) {
            this._defaultValue = defaultValue || null;

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

    className(name) {
        if (this.callingConfigureMethod('className')) {
            //add a class
            if (typeof name === 'string') {
                let parts = name.split(' ');
                for (let index = 0; index < parts.length; index++) {
                    let part = parts[index].trim();
                    if (parts[index].length) {
                        this._classNames.push(part);
                    }
                }
            } else if (Array.isArray(name)) {
                for (let arrayIndex = 0; arrayIndex < name.length; arrayIndex++) {
                    let parts = name.split(' ');
                    for (let index = 0; index < parts.length; index++) {
                        let part = parts[index].trim();
                        if (parts[index].length) {
                            this._classNames.push(part);
                        }
                    }
                }
            }

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

    pipe(target) {
        if (this.callingConfigureMethod('pipe')) {
            //pipe input stuff to target
            if (target === null || target === false) {
                //pipe to self
                this._pipe = false;
            } else if (target === true) {
                //pipe to container
                this._pipe = true;
            } else {
                //pipe to specified input
                this._pipe = target;
            }

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

    //actions (configure)
    action(actions, value, context) {
        if (this.callingConfigureMethod('action')) {
            this._addActions(actions, value, context, false);

            //chain
            return this;
        }
    }

    actions() {
        //shortcut
        return this.action(...arguments);
    }

    next() {
        if (this.callingConfigureMethod('next')) {
            return this._addSpecialAction(constants.actions.next);
        }
    }

    prev() {
        if (this.callingConfigureMethod('prev')) {
            return this._addSpecialAction(constants.actions.prev);
        }
    }

    reset() {
        if (this.callingConfigureMethod('reset')) {
            return this._addSpecialAction(constants.actions.reset);
        }
    }

    rerun() {
        if (this.callingConfigureMethod('rerun')) {
            return this._addSpecialAction(constants.actions.rerun);
        }
    }

    submitter() {
        //submit special action
        if (this.callingConfigureMethod('submitter')) {
            return this._addSpecialAction(constants.actions.submit);
        }
    }

    //validation (configuration)
    require(require, error) {
        if (this.callingConfigureMethod('require')) {
            if (require !== undefined && !!require) {
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

    blacklist(options, strict, error) {
        if (this.callingConfigureMethod('blacklist')) {
            //build list of values
            let list;

            if (options instanceof Array) {
                //array of ?
                list = options;
            } else if (options instanceof Object) {
                //object with value/label pairs
                list = [];
                for (let value of Object.keys(options)) {
                    list.push(options[value]);
                }
            } else {
                list = [options];
            }

            //add handler
            this._addValidateHandler(new InputValidateHandlerBlacklist(list, strict, error));

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

    match(target, strict, error) {
        if (this.callingConfigureMethod('match')) {
            //validate the value against various value types
            this._addValidateHandler(new InputValidateHandlerMatch(target, strict, error));

            //chain
            return this;
        }
    }

    options(options, strict, error) {
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
            }

            //add handler
            this._addValidateHandler(new InputValidateHandlerOptions(options, strict, error));

            //chain
            return this;
        }
    }

    //api
    remove(what) {
        const type = handlerLookup[what];
        if (type === undefined) {
            throw new Error(`unknown ${this.formeClass}.remove() type '${what}'`)
        } else {
            this._removeValidateHandler(type);
        }
    }

    //templating
    templateVars() {
        return super.templateVars()
        .then(vars => {
            const errors = this._form._request._fetchInputErrors(this._name).map(error => error.error);
            const type = this._calculatedType;
            const alias = this._outputName;
            const required = !this._form._unrequire && this._required;

            //build input class names
            const classNames = [];
            const stateClassNames = [];

            //input or button
            if (type === 'button' || type === 'submit') {
                if (this._form._buttonClassNames.length) {
                    for (let className of this._form._buttonClassNames) {
                        classNames.push(className);
                    }
                }
            } else {
                if (this._form._inputClassNames.length) {
                    for (let className of this._form._inputClassNames) {
                        classNames.push(className);
                    }
                }
            }

            //error (state)
            if (errors.length && this._form._errorClassNames.length) {
                for (let className of this._form._errorClassNames) {
                    classNames.push(className);
                    stateClassNames.push(className)
                }
            }

            //required (state)
            if (required && this._form._requiredClassNames.length) {
                for (let className of this._form._requiredClassNames) {
                    classNames.push(className);
                    stateClassNames.push(className)
                }
            }

            //input custom defined via input.className()
            if (this._classNames.length) {
                for (let className of this._classNames) {
                    classNames.push(className);
                }
            }

            //build the vars (remembering to merge the component vars)
            return Object.assign(vars, {
                id: this._id !== null ? this._id : `__forme_auto_id__${this._name}`,
                alias: alias,
                className: classNames.join(' '),
                stateClassName: stateClassNames.join(' '),
                icon: this._icon,
                data: Object.assign({}, ...this._data.map(data => ({['data-' + data.name]: data.value}))),
                help: this._help,
                type: type,
                component: null,//will get overridden by this._component.templateVars()
                placeholder: this._placeholder,
                required: required,
                readonly: this._readonly,
                value: this._form._request._values[this._name],
                checked: (this._form._request._pageFirst && this._checked) || (!this._form._request._pageFirst && ((type === 'checkbox' && this._form._request._values[this._name] !== null) || (type !== 'checkbox' && this._form._request._values[this._name] !== null))),
                errors: errors && errors.length ? errors : null,
                options: this._options,

                //input template vars (dont populate these yet because we might cause an infinite loop on user code. )
                rendered: null,//null indicates that there was no template!
            });
        })

        //we have a complete vars object for this input
        .then(vars => {
            //does the input have a template
            if (!this._template) {
                //no template so chain em!
                return vars;
            } else {
                if (this._templateClient) {
                    //client renders template so just pass on teh details for client to deal with
                    vars.template = this._template;
                    return vars;
                } else {
                    //server needs to render the template
                    return utils.promise.result(this._form._driver.renderInputTemplate(this._form, this, this._template, vars))
                    .then(rendered => {
                        //done, so lets dump details into rendered
                        vars.rendered = rendered || '';

                        //chain
                        return vars;
                    });
                }
            }
        });
    }

    //state
    getValue() {
        return this._form._getInputNameValue(this._name);
    }

    setValue(value) {
        if (this.callingActiveMethod('setValue')) {
            //set runtime value (e.g. modify submitted value)
            this._form._setInputNameValue(this._name, value);
        }

        //chain
        return this;
    }

    path() {
        return this.parent._pathSegments.concat(this._pathSegments).join('.');
    }

    error(error) {
        //shortcut to add a message (container handles input piping)
        if (this.callingActiveMethod('error')) {
            return this._form.error(this._name, error);
        }
    }
}

//expose
module.exports = FormeInput;