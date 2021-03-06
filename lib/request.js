'use strict';

//module imports
const extend = require('extend');

//local imports
const utils = require('./utils');

class FormeRequest {
    constructor(form) {
        this._form = form;

        this._token = null;
        this._tokenCreated = false;
        this._identifier = null;
        this._page = null;
        this._current = null;//current page name
        this._future = null;//future page name
        this._destination = null;

        this._clean = true;//has the form submitted at least once?
        this._started = false;
        this._loading = false;
        this._view = false;
        this._submit = false;
        this._saved = false;
        this._reset = false;
        this._prev = false;
        this._next = false;
        this._halt = false;
        this._error = false;//has there been an error this request?
        this._finished = false;
        this._formFirst = true;
        this._pageFirst = true;
        this._valid = true;
        this._reload = false;
        this._reloadOverride = null;
        this._building = false;
        this._special = false;

        this._processSpecialActions = true;

        this._raw = {};
        this._values = {};
        this._errors = [];
        this._lastErrors = [];
        this._actions = [];

        this._store = {
            identifiers: [],//values per "page"
            visited: {},//pages visited
            completed: {},//pages completed
        };
    };

    //private fetch methods
    _fetchErrors() {
        if (this._view) {
            //include current errors as well as last errors
            //this is because we might have generated an error while building/loading/etc a form when in view mode
            return this._lastErrors.slice().concat(this._errors);
        } else {
            return this._errors.slice();
        }
    }

    _fetchFormErrors() {
        return this._fetchErrors().filter(error => this._form._inputs.find(input => input._name === error.name) === undefined)
    }

    _fetchInputErrors(name) {
        return this._fetchErrors().filter(error => error.name === name);
    }

    _fetchStoreValues(values) {
        //create complete set of values from store
        values = values || {};
        values.names = {};
        values.groups = {};

        //merge all together!
        if (this._store) {
            //todo: can we improve the performance of this?
            extend(true, values, ...this._store.identifiers.filter(identifier => ({
                names: identifier.names,
                groups: identifier.groups,
            })));
        }

        //nothing, soz
        return values;
    }

    _fetchValues(inputs, secure, group, raw, store, special, ignore, lookup=null, values=null) {
        //todo: I hate this function, it is ancient and fugly!

        //get all values from various locations!
        //also see: _buildValues() and _readInputValue()
        values = values || {};

        //prepare group structure for inputs on this page
        if (group) {
            utils.group.create.structure(inputs, values);
        }

        //read from store first
        //we dump the entire groups structure from store over values, as it will then be overwritten in this func
        store = store ? this._fetchStoreValues() : false;
        if (store) {
            //dump store groups into values
            //dont need to worry about flat named values, as these will be resolved below
            utils.group.apply(values, store.groups);

            //add to lookup
            if (lookup) {
                utils.group.addToLookup(store.groups, lookup);
            }
        }

        //iterate over inputs of this form and merge over the top
        let value;
        for (let input of inputs) {
            //only allow unsecured values
            //only allow non special values (unless keep)
            //only allow non ignored values (unless keep)
            if ((!secure || !input._secure) && (special || !input._special || input._keep) && (!ignore || !input._ignore || input._keep)) {
                //by this point, values will always be ready to use from the storage object
                //get default value state from store, if possible. otherwise null
                if (!store) {
                    value = null;
                } else {
                    //see if store contains this value
                    const tryValue = store.names[input._name];
                    if (tryValue === undefined) {
                        value = null;
                    } else {
                        value = tryValue;
                    }
                }

                //raw or value?
                //dont set value if its not defined in the specified target
                //this will always override
                if (raw) {
                    const tryValue = this._raw[input._name];
                    if (tryValue !== undefined) {
                        value = tryValue;
                    }
                } else {
                    const tryValue = this._values[input._name];
                    if (tryValue !== undefined) {
                        value = tryValue;
                    }
                }

                //grouped?
                if (!group) {
                    //non grouped, use name per input
                    values[input._name] = value;

                    //add to lookup
                    if (lookup) {
                        lookup[input._name] = [input._name];
                    }
                } else {
                    //grouped
                    const alias = input._outputName;

                    //add to structure
                    utils.group.addGroup(values, alias, input._group, value);

                    //add to lookup
                    if (lookup) {
                        if (input._group === null) {
                            //input isn't grouped, so easy to make lookup
                            lookup[input._name] = [alias];
                        } else {
                            //use the handy group segments this we already have!
                            lookup[input._name] = input._group.slice();
                            lookup[input._name].push(alias);
                        }
                    }
                }
            }
        }

        //done
        return values;
    }

    //private methods
    _load() {
        if (this._form._driver) {
            //timeout old sessions
            return this._form._driver.timeout()

            //validate or create token
            .then(() => this._getTokenInfo())
            .then(info => {
                this._token = info.token;
                this._tokenCreated = info.created;

                //load the data
                if (this._tokenCreated) {
                    //dont bother loading as this is a newly created token
                    return null;
                } else {
                    //attempt to load data
                    return this._form._driver.load(this._token);
                }
            })

            //process loaded data
            .then(data => {
                //copy data from session into the request
                if (data !== null) {
                    //make sure to create new copies of objects/arrays, because we dont want anything to delete/alter them outside of our control!
                    this._lastErrors = data.errors.slice();
                    this._formFirst = data.first;
                    this._store = Object.assign({}, data.store);
                    this._raw = Object.assign({}, data.raw);
                    this._values = Object.assign({}, data.values);

                    //set the page to the one stored in the session
                    this._setPage(this._form._findPage(data.page));
                }
            })

            //prune excess sessions
            .then(() => this._form._driver.prune(this._form._sessionPrune))//prevent spamming of form sessions

            //clear the saved after loading, as its now plumbed into the request (as we handle all errors, we can save the data at the end)
            .then(() => this._form._driver.clear(this._token))

            //clean promise chain
            .then(() => true)
            .catch(err => Promise.reject(err));//dont need to catch here like this
        } else {
            //we don't have a session handler so do the best we can
            return Promise.resolve(false);
        }
    }

    _save() {
        if (this._form._driver) {
            if (this._reset) {
                //reset
                this._token = null;
                this._identifier = null;
                this._page = null;
                this._current = null;
                this._future = null;
                this._saved = false;
                this._pageFirst = true;
                this._raw = {};
                this._values = {};
                this._errors = [];
                this._lastErrors = [];
                this._actions = [];
                this._store = null;

                return Promise.resolve(false);
            } else {
                //save
                this._saved = true;

                //let the driver save
                return this._form._driver.save(this._token, {
                    raw: this._fetchValues(this._form._inputs, true, false, true, false, true, false, null, null),//secure values will be ignored
                    values: this._fetchValues(this._form._inputs, true, false, false, false, true, false, null, null),//secure values will be ignored
                    errors: this._errors,
                    clean: this._clean,
                    first: this._formFirst,
                    page: this._future,
                    store: this._store,
                    timeout: Date.now()+(this._form._sessionTimeout),//save timeout, its upto the driver to manage this
                })
                .then(() => true);
            }
        } else {
            //no session
            return Promise.resolve(false);
        }
    }

    _getTokenInfo() {
        return new Promise((resolve, reject) => {
            let token = this._form._driver.request(this._form._tokenField, undefined);

            //make sure its valid
            if (token !== undefined) {
                if (token.length !== this._form._sessionTokenSize || !/^[a-z0-9]+$/i.test(token)) {
                    reject(this._form._createError('invalid form token'));
                } else {
                    //found old token (and its valid)
                    resolve({
                        created: false,
                        token: token,
                    });
                }
            } else {
                //no token, or it was invalid so generate new
                return utils.string.token(this._form._sessionTokenSize, (err) => this._form._createError(err))
                .then(token => resolve({
                    created: true,
                    token: token,
                }))
                .catch(err => reject(err));
            }
        });
    }

    _addError(name, error) {
        //eat teh error
        this._errors.push({
            name: name,
            error: error,
        });

        //flag that this request has had an error
        this._error = true;
    }

    _createStore(identifier) {
        let store = this._store.identifiers.find(store => store.identifier === identifier);

        //do we need to create the store cache?
        if (store === undefined) {
            store = {
                identifier: identifier,
                names: {},
                groups: {},
            };

            //add form group structure to the store
            utils.group.create.structure(this._form._inputs, store.groups);

            //add to stored identifiers
            this._store.identifiers.push(store);
        }

        //return cached
        return store;
    }

    _clearCurrentStore() {
        if (this._identifier !== null && this._store !== null) {
            this._store.identifiers = this._store.identifiers.filter(identifier => identifier.identifier !== this._identifier);
        }
    }

    _currentStore() {
        if (this._identifier !== null && this._store !== null) {
            const store = this._store.identifiers.find(store => store.identifier === this._identifier);
            return store?store:null;
        }
    }

    _clearErrors() {
        //never clear "last errors"
        this._error = false;
        this._errors = [];
    }

    _hasError() {
        return this._errors.length > 0;
    }

    _addInputToStore(name, group, alias, value) {
        if (value !== undefined) {
            //alias is produced by input._outputName
            const store = this._createStore(this._identifier);

            //add to store in different places
            utils.group.addGroup(store.groups, alias, group, value);
            store.names[name] = value;
        }
    }

    //page api
    _setPage(page, ignoreNull) {
        if (!ignoreNull || page !== null) {
            this._page = page;
            this._current = page ? page._name : null;
        }
    }

    _pageName(page) {
        if (typeof page === 'string') {
            return page;
        } else if (page && typeof page === 'object') {
            return page._name;
        } else {
            return null;
        }
    }

    _visitPage(page) {
        const pageName = this._pageName(page);

        if (this._submit) {
            this._formFirst = false;
        }

        //flag page (if there is one) as visited
        if (pageName && this._started && this._valid && this._page !== null) {
            this._store.visited[pageName] = true;
        }
    }

    _completePage(page) {
        const pageName = this._pageName(page);

        if (pageName && this._submit && this._started && this._valid && this._page !== null) {
            this._store.visited[this._current] = true;
            this._store.completed[this._current] = true;
        }
    }

    _invalidateAfterPage(page) {
        const pageName = this._pageName(page);

        if (pageName && this._submit && this._started && this._valid && this._page !== null) {
            let found = false;
            for (let page of this._form._pages) {
                if (!found) {
                    if (page._name === pageName) {
                        //found, so now after this point we unvisit!
                        found = true;
                    }
                } else {
                    //invalidate!
                    delete this._store.visited[page._name];
                    delete this._store.completed[page._name];
                }
            }
        }
    }

    _hasCompletedPage(page) {
        const pageName = this._pageName(page);
        return pageName && this._page !== null && this._store.completed[pageName];
    }

    _hasVisitedPage(page) {
        const pageName = this._pageName(page);
        return (this._page === null && !this._formFirst) || (pageName && this._page && this._store.visited[pageName]);
    }

    //public methods
    templateVars() {
        return this._form.templateVars();
    }

    errors() {
        return this._form.errors(...arguments);
    }

    values() {
        return this._form.values();
    }

    value(name) {
        return this._form.getValue(name);
    }

    inputTypes() {
        //return a list of unique input types used in the form
        return Array.from(new Set(this._form._inputs.map(input => input._calculateType())));
    }

    inputs(type=null) {
        if (type === null || type === undefined) {
            return Array.from(this._form._inputs);
        } else {
            return this._form._inputs.filter(input => {
                const inputType = input._calculateType();
                if (Array.isArray(type)) {
                    return type.indexOf(inputType) !== -1
                } else {
                    return inputType === type;
                }
            });
        }
    }
}

//expose
module.exports = FormeRequest;