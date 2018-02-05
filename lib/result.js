'use strict';

//classes
class FormeResult {
    constructor(form, vars = null) {
        //this needs to create a snapshot of data as the form could be reset after the result is created
        this._form = form;
        this._token = form._request._token;
        this._future = form._request._future;
        this._valid = form._request._valid;
        this._saved = form._request._saved;
        this._reload = form._request._reload;
        this._destination = form._makeDestination();//pre calc the destination
        this._values = form._request._fetchValues(form._inputs, false, true, false, true, false, false, null, null);//result always contains ALL values
        this._errors = form._fetchErrors();
        this._actions = form._request._actions.slice();
        this._template = vars;//filled in by createWithPromise ... only bother generating template when viewing
    };

    //static
    static createWithPromise(form) {
        //do we need to generate template vars?
        if (!form._request._view) {
            //nope!
            return Promise.resolve(new this(form));
        } else {
            //yup
            return form.templateVars()
            .then(vars => new this(form, vars))
        }
    }

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

    get templateVars() {
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