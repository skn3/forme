'use strict';

//classes
class FormeResult {
    constructor(form, templateVars = null) {
        //this needs to create a snapshot of data as the form could be reset after the result is created
        this._form = form;
        this._token = form._request._token;
        this._future = form._request._future;
        this._valid = form._request._valid;
        this._saved = form._request._saved;
        this._reload = form._request._reload;
        this._destination = form._makeDestination();//pre calc the destination
        this._values = form._buildValues({
            alias: true,
            group: true,
            store: true,
        });
        this._errors = form._fetchErrors();
        this._actions = form._request._actions.slice();
        this._templateVars = templateVars;//filled in by FormeResult.createWithPromise ... only bother generating template when viewing
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
        return this._templateVars;
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
    getElement(path) {
        return this._form.getElement(path);
    }

    getInputs(type=null) {
        return this._form._request.inputs(type);
    }

    getContext() {
        if (arguments.length === 1) {
            //get form context
            return this._form.context(arguments[0]);

        } else if (arguments.length >= 2) {
            //get input context
            const element = this._form._findDescendant(arguments[0]);
            if (element) {
                return element.context(arguments[1]);
            }
        }

        //nope
        return undefined;
    }
}

//expose
module.exports = FormeResult;