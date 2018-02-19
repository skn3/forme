'use strict';

//local imports
const FormeDriverError = require('./errors').FormeDriverError;
const Forme = require('./forme').Forme;
const FormePage = require('./page');
const FormeInput = require('./input');
const FormeComponent = require('./component');

//classes
class FormeDriver {
    constructor(name, storage, request) {
        this._name = name;
        this._storage = storage;

        this.saveRequestReference(request);
    }

    //static functions
    static get formClass() {
        return Forme;
    }

    static get pageClass() {
        return FormePage;
    }

    static get componentClass() {
        return FormeComponent;
    }

    static get inputClass() {
        return FormeInput;
    }

    //public methods

    //noinspection JSMethodCanBeStatic
    compose(form, page, component, details) {
        //by default the driver will say that the compose operation was dealt with by returning true!
        //page might be null
        //container is where we should add inputs to, it could be a page or a form!
        return Promise.resolve(true);
    }

    saveRequestReference(request) {
        //we assign the passed in FormeRequest to the correct place in the storage
        this._storage.forme = this._storage.forme || {};
        this._storage.forme[this._name] = request;
    }

    renderTemplate(form, element, template, vars) {
        //by default no rendering happens!
        return Promise.resolve(null);
    }

    timeout() {
        //timeout old sessions
        return new Promise((resolve, reject) => {
            if (this._storage.session !== undefined && this._storage.session.forme !== undefined) {
                const sessions = this._storage.session.forme;
                const sessionTokens = Object.keys(sessions);

                //clear any dead sessions
                if (sessionTokens.length) {
                    const now = Date.now();
                    for (let token of sessionTokens) {
                        const session = sessions[token];
                        if (session.timeout === undefined || session.timeout <= now) {
                            delete sessions[token];
                        }
                    }
                }
            }

            //continue please
            return resolve();
        });
    }

    prune(max) {
        //prevent session storage spam!
        return new Promise((resolve, reject) => {
            if (this._storage.session !== undefined && this._storage.session.forme !== undefined) {
                const sessions = this._storage.session.forme;

                //prepare details once as array
                const sessionTokens = Object.keys(sessions);
                if (sessionTokens.length > max) {
                    const sessionDetails = sessionTokens.map(token => ({
                        token: token,
                        order: sessions[token].timeout || 0,
                    }));

                    //order by newest first and delete oldest items longer then max items
                    sessionDetails.sort((a, b) => a.order - b.order);
                    for(let index = max;index < sessionDetails.length;index++) {
                        delete sessions[sessionDetails[index].token];
                    }
                }
            }

            //continue please
            return resolve();
        });
    }

    load(token) {
        //load this forms entire session by token
        return new Promise((resolve, reject) => {
            if (this._storage.session !== undefined && this._storage.session.forme !== undefined) {
                //we have a valid session object (but maybe not for our token)
                const sessions = this._storage.session.forme;

                //return it back to the core
                //handle if session has timed out and now doesn't exist
                const session = sessions[token];
                if (session) {
                    return resolve(session);
                } else {
                    return reject(new FormeDriverError('invalid form session'));
                }
            }

            //empty data by default
            return resolve(null);
        });
    }

    save(token, data) {
        //save this forms entire session
        return new Promise((resolve, reject) => {
            //prepare the session
            this._storage.session = this._storage.session || {};
            this._storage.session.forme = this._storage.session.forme || {};

            //save the passed in data specific to this form request
            this._storage.session.forme[token] = data;

            return resolve();
        });
    }

    clear(token) {
        //delete/clear the current forms session
        return new Promise((resolve, reject) => {
            if (this._storage.session !== undefined && this._storage.session.forme !== undefined && this._storage.session.forme[token] !== undefined) {
                delete this._storage.session.forme[token];
            }

            return resolve();
        });
    }

    get(name, defaultValue) {
        //retrieve value from GET
        if (this._storage.query !== undefined && this._storage.query[name] !== undefined) {
            return this._storage.query[name];
        } else {
            return defaultValue;
        }
    }

    post(name, defaultValue) {
        //retrieve value from POST
        if (this._storage.body !== undefined && this._storage.body[name] !== undefined) {
            return this._storage.body[name];
        } else {
            return defaultValue;
        }
    }

    request(name, defaultValue) {
        //retrieve value from GET or POST
        if (this._storage.body !== undefined && this._storage.body[name] !== undefined) {
            return this._storage.body[name];
        } else if (this._storage.query !== undefined && this._storage.query[name] !== undefined) {
            return this._storage.query[name];
        } else {
            return defaultValue;
        }
    }

    url() {
        //retrieve the current url
        //try to compensate for various sources of url for different environments
        //todo: this is nasty, but until individual "drivers" are written then this is the only option
        //noinspection Annotator
        if (typeof this._storage.originalUrl === 'string') {
            //noinspection Annotator
            return this._storage.originalUrl;

        } else if (typeof this._storage.url === 'string') {
            return this._storage.url;

        } else {
            return '';
        }
    }
}

//expose module
module.exports = FormeDriver;