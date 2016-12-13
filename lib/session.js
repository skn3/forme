'use strict';

class FormeSession {
    clear(req, form) {
        if (typeof req.session != 'undefined' && typeof req.session.forme != 'undefined' && typeof req.session.forme[form._name] != 'undefined') {
            delete req.session.forme[form._name];
        }
        return Promise.resolve();
    }

    save(req, form, data) {
        req.session = req.session || {};
        req.session.forme = req.session.forme || {};
        req.session.forme[form._name] = data;
        return Promise.resolve();
    }

    load(req, form) {
        if (typeof req.session != 'undefined' && typeof req.session.forme != 'undefined' && typeof req.session.forme[form._name] != 'undefined') {
            return Promise.resolve(req.session.forme[form._name]);
        } else {
            return Promise.resolve(null);
        }
    }
}

//singleton
const session = new FormeSession();

//expose module
module.exports = session;