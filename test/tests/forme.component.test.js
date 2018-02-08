"use strict";

//module imports
const chai = require('chai');
const expect = chai.expect;

//local imports
const {TestDriverForm, createExpressStyleRequest} = require('../testShared');

//tests
describe('Component', function () {
    //tests
    it('should create a form with a single encasing(default) component', function () {
        const form = new TestDriverForm({
            name:'testForm',
            components: [
                {
                    type: 'component1',
                    name: 'myComponent1',
                },
            ],
        });

        //view the form
        return form.view(createExpressStyleRequest())
        .then(result => {
            const templateVars = result.templateVars;

            expect(templateVars).to.be.an('object').that.has.property('children').which.is.an('object');
            expect(templateVars.children).to.have.nested.property('myComponent1.formeClass').that.equals('component');
        });
    });

    it('should create a form with a single non-encasing component', function () {
        const form = new TestDriverForm({
            name:'testForm',
            components: [
                {
                    type: 'component2',
                    name: 'myComponent2',
                },
            ],
        });

        //view the form
        return form.view(createExpressStyleRequest())
        .then(result => {
            const templateVars = result.templateVars;
            const values = result.values;

            expect(templateVars).to.be.an('object').that.has.property('children').which.is.an('object');
            expect(templateVars.children).to.have.nested.property('myComponent2.formeClass').that.equals('component');
            expect(templateVars.children).to.have.nested.property('myComponent2.children.value2.formeClass').that.equals('input');
        });
    });

    it('should create a form with a single non-encasing component', function () {
        const form = new TestDriverForm({
            name:'testForm',
            components: [
                {
                    type: 'component2',
                    name: 'myComponent2',
                },
            ],
        });

        //view the form
        return form.view(createExpressStyleRequest())
        .then(result => {
            const templateVars = result.templateVars;
            const values = result.values;

            expect(templateVars).to.be.an('object').that.has.property('children').which.is.an('object');
            expect(templateVars.children).to.have.nested.property('myComponent2.formeClass').that.equals('component');
            expect(templateVars.children).to.have.nested.property('myComponent2.children.value2.formeClass').that.equals('input');
        });
    });
});