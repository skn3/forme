'use strict';

//classes
class FormeResult {
    constructor(form) {
        //this needs to create a snapshot of data as the form could be reset after the result is created
        this._form = form;
        this._token = form._request._token;
        this._future = form._request._future;
        this._valid = form._request._valid;
        this._saved = form._request._saved;
        this._reload = form._request._reload;
        this._destination = form._makeDestination();//pre calc the destination
        this._values = form._fetchValues(false, true, false, true, false, false, null, null);//result always contains ALL values
        this._errors = form._fetchErrors();
        this._actions = form._request._actions.slice();
        this._template = this._form._request._view ? this._form.template() : null;//only bother generating template when viewing
    };

    //properties
    get form() {
        return this._form;
    }

    get storage() {
        return this._form._driver._storage;
    }

    get valid() {
        return this._valid;
    }

    get reload() {
        return this._reload;
    }

    get template() {
        return this._template;
    }

    get destination() {
        return this._destination;
    }

    get values() {
        return this._values;
    }

    get failed() {
        return !this._valid;
    }

    get errors() {
        return this._errors;
    }

    get actions() {
        return this._actions;
    }

    get inputTypes() {
        return this._form._request.inputTypes();
    }

    //api
    getInputs(type=null) {
        return this._form._request.inputs(type);
    }
}

//expose
module.exports = FormeResult;