'use strict';

//local imports
const FormeBase = require('./base');

//class
class FormePageExternal extends FormeBase {
    //private page properties (should be across all *types* of page)
    get _destination() {
        return this._name;
    }

    //private properties
    get _url() {
        //this is an external page so return the destination
        if (!this._request) {
            return this._destination;
        } else {
            return this._form._makeUrl(this._destination, this._request._token, false);
        }
    }

    get _external() {
        return true;
    }

    //private import methods
    _import() {
    }

    //private build values methods
    _buildValuesSelf(options) {
        //nothing
    }

    _buildValuesStructure(options, parent, value) {
        //chain back parent
        return parent;
    }
}

//expose
module.exports = FormePageExternal;