'use strict';

class FormeSession {
    clear(req, form, callback) {
        if (typeof req.session != 'undefined' && typeof req.session.forme != 'undefined' && typeof req.session.forme[form._name] != 'undefined') {
            delete req.session.forme[form._name];
        }
        callback(null);
    }

    save(req, form, data, callback) {
        req.session = req.session || {};
        req.session.forme = req.session.forme || {};
        req.session.forme[form._name] = data;
        callback(null);
    }

    load(req, form, callback) {
        if (typeof req.session != 'undefined' && typeof req.session.forme != 'undefined' && typeof req.session.forme[form._name] != 'undefined') {
            callback(req.session.forme[form._name], null);//2nd param is error
        } else {
            callback(null, null);
        }
    }
}

//singleton
const session = new FormeSession();

//expose module
module.exports = session;