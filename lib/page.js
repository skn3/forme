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

    //private page properties (should be across all *types* of page)
    get _destination() {
        //page container doesn't need destination as it used when a form uses teh same path for each page
        return null;
    }

    //private properties
    get _groupLength() {
        //page has no groups or containers
        return 0;
    }

    get _pathSegments() {
        //page has no groups or containers
        return [];
    }

    get _containerPathSegments() {
        //page has no groups or containers
        return [];
    }

    get _ownGroupSegments() {
        //page has no groups or containers
        return [];
    }

    get _ownPathSegments() {
        //page has no groups or containers
        return [];
    }

    get _ownPathLength() {
        //page has no groups or containers
        return 0;
    }

    get _current() {
        return this === this._requestPage;
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

    //private import methods
    _import() {
        //import the static page inputs from the current page. We dont have to import components as they are handled in the structure as normal!
        for(let input of this._inputs) {
            this._form._pipeAddInput(input);
        }
    }

    //private build values methods
    _buildValuesInclude(options) {
        //page always included!
        return true;
    }

    _buildValuesGroups(options, parent) {
        //page has no groups!
        return parent;
    }

    _buildValuesStructure(options, parent, value) {
        //add to structure
        if (parent) {
            //page does not output its self as part of the structure
            return Object.assign(parent, value);
        } else {
            //we have no parent, so return the value!
            return value;
        }
    }

    //private build template methods
    _buildTemplateStructure(options, parent) {
        return new Promise((resolve, reject) => {
            //create vars for self
            const vars = this._buildTemplateVars(options);

            //insert into parent
            parent = parent || {};
            parent.page = vars;

            //chain the parent back
            return resolve(parent);
        });
    }

    //private pipe methods
    _pipeAddInput(input) {
        //page should only add to itself!
        this._inputs.push(input);

        //form has already imported the current page so we are safe to pipe this input to the form
        if (this._request && this._request._pageImported) {
            this._form._pipeAddInput(input);
        }
    }

    _pipeError(error, formeClass, path, name) {
        //everything gets piped to the form
        return this._form._pipeError(error, formeClass, path, name);
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

    //private find methods
    _findDescendantContinue(segments, index) {
        //page always passes the search through itself!
        return index;
    }

    _findDescendantFound() {
        //can this descendant be returned from a search?
        return false;
    }

    //private create methods
    _createError(message) {
        return new FormePageError(message);
    }
}

//expose
module.exports = FormePage;