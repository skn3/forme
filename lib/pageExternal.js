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
        return this._destination;
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