'use strict';

//local imports
const constants = require('./constants');
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
    FormeConfigurableStrings,

    FormeConfigurableExportInputActions,
    FormeConfigurableExportInputSpecialAction,
    FormeConfigurableExportProcessHandler,
    FormeConfigurableExportValidateHandler,
    FormeConfigurableExportValidateHandlersConcat,
    FormeConfigurableExportValidateHandlers,
    FormeConfigurableExportParam,
    FormeConfigurableExportNot,
    FormeConfigurableExportString,
    FormeConfigurableExportArray,
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
class FormeBaseInput extends FormeBase {
    constructor(type, form, page, name) {
        super(type || 'baseInput', form, page, name);

        this._component = null;//set when a compose handler returns an input
        this._type = null;
        this._group = null;
        this._alias = null;
        this._ignore = false;
        this._required = false;
        this._keep = false;
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
    }

    //private properties
    get _outputName() {
        return this._alias !== null?this._alias:this._name;
    }

    //properties
    get configuration() {
        return Object.assign(super.configuration, {

        });
    }

    get parent() {
        //what does this belong to?
        return this._component || this._page || this._form;
    }

    //private configuration methods
    _buildConfigurableMethods() {
        return Object.assign(super._buildConfigurableMethods(), {
            //--- configuration ---

            //baseInput.type(string)
            type: new FormeConfigurableMethod('type', [
                new FormeConfigurableOverride([
                    new FormeConfigurableString('type', false),
                ], true),
            ], new FormeConfigurableExportString('_type')),

            //baseInput.group(string, append)
            group: new FormeConfigurableMethod('group', [
                new FormeConfigurableOverride([
                    new FormeConfigurableString('group', false),
                    new FormeConfigurableBool('append', false, true),
                ], true),
            ], new FormeConfigurableExportArray('_group')),

            //baseInput.alias(string)
            alias: new FormeConfigurableMethod('alias', [
                new FormeConfigurableOverride([
                    new FormeConfigurableString('alias', false),
                ], true),
            ], new FormeConfigurableExportString('_alias')),

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

            //input.action(string(s), value, value)
            action: new FormeConfigurableMethod('action', [
                new FormeConfigurableOverride([
                    new FormeConfigurableStrings(['action', 'actions'], true),
                    new FormeConfigurableParam('value', false),
                    new FormeConfigurableParam('context', false),
                ], true),
            ], new FormeConfigurableExportInputActions()),

            //input.actions(*pointer*)
            actions: new FormeConfigurableMethodPointer('action'),

            //input.next()
            next: new FormeConfigurableMethod('next', [
                new FormeConfigurableOverride([], true),
            ], new FormeConfigurableExportInputSpecialAction(constants.actions.next)),

            //input.prev()
            prev: new FormeConfigurableMethod('prev', [
                new FormeConfigurableOverride([], true),
            ], new FormeConfigurableExportInputSpecialAction(constants.actions.prev)),

            //input.reset()
            reset: new FormeConfigurableMethod('reset', [
                new FormeConfigurableOverride([], true),
            ], new FormeConfigurableExportInputSpecialAction(constants.actions.reset)),

            //input.rerun()
            rerun: new FormeConfigurableMethod('rerun', [
                new FormeConfigurableOverride([], true),
            ], new FormeConfigurableExportInputSpecialAction(constants.actions.rerun)),

            //input.submitter()
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
            ], new FormeConfigurableExportValidateHandlers(InputValidateHandlerRequire)),
            required: new FormeConfigurableMethodPointer('require'),

            //baseInput.blacklist(*multiple*)
            blacklist: new FormeConfigurableMethod('blacklist', [
                //input.blacklist(value, bool, string)
                new FormeConfigurableOverride([
                    new FormeConfigurableParam('blacklist', true),
                    new FormeConfigurableBool('strict', true),
                    new FormeConfigurableString('error', true),
                ], false),

                //input.blacklist(value, bool)
                new FormeConfigurableOverride([
                    new FormeConfigurableParam('blacklist', true),
                    new FormeConfigurableBool('strict', true),
                ], false),

                //input.blacklist(value)
                new FormeConfigurableOverride([
                    new FormeConfigurableParam('blacklist', true),
                ], true),
            ], new FormeConfigurableExportValidateHandlersConcat(InputValidateHandlerBlacklist)),

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

            //baseInput.match(*multiple*)
            match: new FormeConfigurableMethod('match', [
                //input.match(string, bool, string)
                new FormeConfigurableOverride([
                    new FormeConfigurableString(['target', 'name', 'path'], true),
                    new FormeConfigurableBool('strict', true),
                    new FormeConfigurableString('error', true),
                ], false),

                //input.match(string, bool)
                new FormeConfigurableOverride([
                    new FormeConfigurableString(['target', 'name', 'path'], true),
                    new FormeConfigurableBool('strict', true),
                ], false),

                //input.match(string)
                new FormeConfigurableOverride([
                    new FormeConfigurableString(['target', 'name', 'path'], true),
                ], true),
            ], new FormeConfigurableExportValidateHandlers(InputValidateHandlerMatch)),

            //baseInput.options(*multiple*)
            options: new FormeConfigurableMethod('options', [
                //input.options(object, bool, string)
                new FormeConfigurableOverride([
                    new FormeConfigurableObject('options', true),
                    new FormeConfigurableBool('strict', true),
                    new FormeConfigurableString('error', true),
                ], false),

                //input.options(object, bool)
                new FormeConfigurableOverride([
                    new FormeConfigurableObject('options', true),
                    new FormeConfigurableBool('strict', true),
                ], false),

                //input.options(object)
                new FormeConfigurableOverride([
                    new FormeConfigurableObject('options', true),
                ], true),
            ], new FormeConfigurableExportValidateHandlers(InputValidateHandlerOptions)),

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
                throw new Error(`cant use ${this._baseType}.keep() after input.secure()`);
            }

            this._keep = arguments.length?!!keep:true;

            //chain
            return this;
        }
    }

    secure(secure) {
        if (this.callingConfigureMethod('secure')) {
            //prevent secure mode whilst keeping
            if (this._keep) {
                throw new Error(`cant use ${this._baseType}.secure() after ${this._baseType}.keep()`);
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

            //flag that there is a conversion happening
            this._convert = true;

            //chain
            return this;
        }
    }

    int(allowNull) {
        if (this.callingConfigureMethod('int')) {
            //convert value to int, force indicates this the value will be forced to exist

            //add handler
            this._addProcessHandler(new InputProcessHandlerConvertInt(allowNull));

            //flag that there is a conversion happening
            this._convert = true;

            //chain
            return this;
        }
    }

    float(allowNull) {
        if (this.callingConfigureMethod('float')) {
            //convert value to float, force indicates this the value will be forced to exist

            //add handler
            this._addProcessHandler(new InputProcessHandlerConvertFloat(allowNull));

            //flag that there is a conversion happening
            this._convert = true;

            //chain
            return this;
        }
    }

    string(allowNull) {
        if (this.callingConfigureMethod('string')) {
            //convert value to string, force indicates this the value will be forced to exist

            //add handler
            this._addProcessHandler(new InputProcessHandlerConvertString(allowNull));

            //flag that there is a conversion happening
            this._convert = true;

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
            throw new Error(`unknown ${this._baseType}.remove() type '${what}'`)
        } else {
            this._removeValidateHandler(type);
        }
    }

    //templating
    template() {
        this.callingUnsupportedMethod('template');
    }

    //state
    path() {
        //returns the currently defined "path" (group + alias) for an input
        if (this._group && this._group.length) {
            return this._group.join('.')+'.'+this._outputName;
        } else {
            return this._outputName;
        }

    }

    error(error) {
        this.callingUnsupportedMethod('error');
    }
}

//expose
module.exports = FormeBaseInput;