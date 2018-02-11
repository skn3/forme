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

    describe('#validation', function () {
        it('should should catch required input', function () {
            let called = false;
            return blueprints.submit.withInputRequired()
            .then(result => {
                expect(result.valid).to.equal(false);
                expect(result.errors).to.be.an('array').with.lengthOf(1).and.have.nested.property('[0].error').that.equals('CUSTOM_REQUIRED_ERROR');
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

        it('should fail validation with blacklisted value', function () {
            return blueprints.submit.withInputBlacklist({input1: 'I_AM_NOT_ALLOWED!!!'})
            .then(result => {
                expect(result.valid).to.equal(false);
                expect(result.errors).to.be.an('array').with.lengthOf(1).and.have.nested.property('[0].error').that.equals('CUSTOM_BLACKLIST_ERROR');
            });
        });

        it('should fail validation with invalid option', function () {
            return blueprints.submit.withInputOptions({input1: 'I_AM_NOT_ALLOWED!!!'})
            .then(result => {
                expect(result.valid).to.equal(false);
                expect(result.errors).to.be.an('array').with.lengthOf(1).and.have.nested.property('[0].error').that.equals('CUSTOM_OPTIONS_ERROR');
            });
        });
    });

    describe('#errors', function () {
        it('should get element errors', function () {
            let called = false;
            return blueprints.submit.withInputRequired()
            .then(result => {
                const errors = result.form.getElementErrors('input1');
                expect(result.valid).to.equal(false);
                expect(errors).to.be.an('array').with.lengthOf(1).and.have.nested.property('[0].error').that.equals('CUSTOM_REQUIRED_ERROR');
            });
        });
    });
});