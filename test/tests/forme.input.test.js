"use strict";

//local imports
const {expect, TestDriverForm, createExpressRequest, blueprints} = require('../testShared');

//tests
describe('Input', function () {
    describe('#value', function () {
        it('should set default input value', function () {
            return blueprints.view.withInputDefaultValue()
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(result.values).to.have.nested.property('input1').which.equals('theDefaultValue');
            });
        });
    });

    describe('#.required()', function () {
        it('should should catch required input', function () {
            let called = false;
            return blueprints.submit.withInputRequired(null, 'CUSTOM_ERROR')
            .then(result => {
                expect(result.valid).to.equal(false);
                expect(result.errors).to.be.an('array').with.lengthOf(1).and.nested.property('[0].error').that.equals('CUSTOM_ERROR');
            });
        });

        it('should validate required input that has a string value', function () {
            return blueprints.submit.withInputRequired({
                input1: 'valueHere',
            })
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(result).to.have.property('errors').that.is.an('array').with.lengthOf(0);
            });
        });

        it('should validate required input that has a numerical value', function () {
            return blueprints.submit.withInputRequired({
                input1: 123456,
            })
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(result).to.have.property('errors').that.is.an('array').with.lengthOf(0);
            });
        });

        it('should validate required input that has a (valid) boolean false value', function () {
            return blueprints.submit.withInputRequired({
                input1: false,
            })
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(result).to.have.property('errors').that.is.an('array').with.lengthOf(0);
            });
        });
    });
});