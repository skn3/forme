"use strict";

//module imports
const chai = require('chai');
const expect = chai.expect;

//local imports
const {TestDriverForm, createExpressStyleRequest} = require('../testShared');

//tests
describe('Form', function () {
    //tests
    it('should execute a basic form', function () {
        const form = new TestDriverForm({
            name: 'testForm',
            inputs: [
                {
                    type: 'text',
                    name: 'myInput1',
                },
            ],
        });

        //view the form
        return form.execute(createExpressStyleRequest({
            myInput1: 'hello world!',
        }))
        .then(result => {
            const values = result.values;

            expect(result.valid).to.equal(true);
            expect(values).to.have.nested.property('myInput1').which.equals('hello world!');
        });
    });

    it('should successfully execute custom input validation handler', function () {
        let called = false;

        const form = new TestDriverForm({
            name: 'testForm',
            inputs: [
                {
                    type: 'text',
                    name: 'myInput1',
                    validate: (form, input, state) => called = true,
                },
            ],
        });

        //view the form
        return form.execute(createExpressStyleRequest())
        .then(result => {
            expect(result.valid).to.equal(true);
            expect(called).to.equal(true);
        });
    });

    it('should successfully execute custom form validation handler', function () {
        let called = false;

        const form = new TestDriverForm({
            name: 'testForm',
            inputs: [
                {
                    type: 'text',
                    name: 'myInput1',
                },
            ],
            validate: (form, state) => called = true,
        });

        //view the form
        return form.execute(createExpressStyleRequest())
        .then(result => {
            expect(result.valid).to.equal(true);
            expect(called).to.equal(true);
        });
    });

    it('should successfully execute custom page validation handler', function () {
        let called = false;

        const form = new TestDriverForm({
            name: 'testForm',
            pages: [
                {
                    name: 'page1',
                    inputs: [
                        {
                            type: 'text',
                            name: 'myInput1',
                        },
                    ],
                    validate: (form, page, state) => called = true,
                },
            ],
        });

        //view the form
        return form.execute(createExpressStyleRequest())
        .then(result => {
            expect(result.valid).to.equal(true);
            expect(called).to.equal(true);
        });
    });

    it('should successfully call form, page, input validation handlers in the correct order', function () {
        let called = [];

        const form = new TestDriverForm({
            name: 'testForm',
            pages: [
                {
                    name: 'page1',
                    inputs: [
                        {
                            type: 'text',
                            name: 'myInput1',
                            validate: (form, input, state) => called.push('input'),
                        },
                    ],
                    validate: (form, page, state) => called.push('page'),
                },
            ],
            validate: (form, state) => called.push('form'),
        });

        //view the form
        return form.execute(createExpressStyleRequest())
        .then(result => {
            expect(result.valid).to.equal(true);
            expect(called).to.be.an('array').and.deep.equal(['input', 'page', 'form']);
        });
    });
});