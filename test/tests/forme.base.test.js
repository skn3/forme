"use strict";

//local imports
const {expect, TestDriverForm, createExpressRequest, blueprints} = require('../testShared');

//tests
describe('Base', function () {
    describe('#_buildValues', function () {
        it('should build a flat list of values from grouped structure', function () {
            return blueprints.view.withTwoGroupedInputs()
            .then(result => {
                expect(result.form._buildValues({
                    group: false,
                })).to.deep.equals({
                    element_123456: null,
                    this_is_input1_with_funky_long_name: null,
                });
            });
        });

        it('should ignore secure values', function () {
            return blueprints.view.withTwoGroupedInputsOneSecured()
            .then(result => {
                expect(result.form._buildValues({
                    group: false,
                    secure: true,
                })).to.deep.equals({
                    element_123456: null,
                });
            });
        });
    });
});