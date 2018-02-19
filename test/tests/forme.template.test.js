"use strict";

//local imports
const {expect, TestDriverForm, createExpressRequest, blueprints} = require('../testShared');

//tests
describe('Base', function () {
    describe('#_buildValues', function () {
        it('should only expose context that has been flagged to expose', function () {
            return blueprints.view.withInputContext()
            .then(result => {
                //check public
                expect(result.templateVars).have.nested.property('children.input1.context').that.deep.equals({
                    context2: 'publicValue2',
                });

                //check private
                const input = result.form.getElement('input1');
                expect(input.context('context1')).to.equal('privateValue1');
            });
        });
    });
});