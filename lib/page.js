'use strict';

//local imports
const FormeContainer = require('./container');
const FormePageError = require('./errors').FormePageError;

//class
class FormePage extends FormeContainer {
    constructor(name) {
        super(name);

        //self reference page!
        this._page = this;
    };

    //private properties
    get _destination() {
        //page container doesn't need destination as it used when a form uses teh same path for each page
        return null;
    }

    get _url() {
        return this._form._driver.url();
    }

    //properties
    get formeClass() {
        return 'page';
    }

    get parent() {
        return this._form;
    }

    get container() {
        return this._form;
    }

    //private build methods
    _build() {
        //execute build handlers
        return this._nextBuildHandler(this._buildHandlers, 0);
    }

    //private execute handler methods
    _executeBuildHandler(handler) {
        return handler.call(this, this._form, this);
    }

    _executeComposeHandler(handler, component, details) {
        return handler.call(this, this._form, this, component, details);
    }

    _executeValidateHandler(handler, state) {
        return handler.call(this, this._form, this, state);
    }

    _executeSuccessHandler(handler) {
        return handler.call(this, this._form, this);
    }

    _executeFailHandler(handler) {
        return handler.call(this, this._form, this);
    }

    _executeSubmitHandler(handler) {
        return handler.call(this, this._form, this);
    }

    _executeActionHandler(handler, action) {
        return handler.call(this, this._form, this, action.action, action.context);
    }

    _executeDoneHandler(handler) {
        return handler.call(this, this._form, this);
    }

    //private create methods
    _createError(message) {
        return new FormePageError(message);
    }
}

//expose
module.exports = FormePage;