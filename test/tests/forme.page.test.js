"use strict";

//local imports
const {expect, blueprints} = require('../testShared');

//tests
describe('Page', function () {
    describe('#singleForm', function () {
        it('should create a form with multiple pages', function () {
            return blueprints.view.withTwoPagesFourInputsKeepTwo()
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(result.totalPages).to.equal(2);
                expect(result.pageIndex).to.equal(0);
            });
        });

        it('should create a form with multiple pages but only inputs from page 1', function () {
            return blueprints.view.withTwoPagesFourInputsKeepTwo()
            .then(result => {
                expect(result.valid).to.equal(true);

                expect(Object.keys(result.templateVars.children)).to.deep.equal(['input1', 'input2']);

                expect(result.templateVars).to.have.nested.property('children.input1').that.includes({
                    __formeClass: 'input',
                    type: 'text',
                    alias: 'input1',
                    name: 'input1',
                });

                expect(result.templateVars).to.have.nested.property('children.input2').that.includes({
                    __formeClass: 'input',
                    type: 'text',
                    alias: 'input2',
                    name: 'input2',
                });
            });
        });

        it('should submit to the next page', function () {
            return blueprints.submitThenViewNextPage.withTwoPagesFourInputsKeepTwo()
            .then(result => {
                expect(result.valid).to.equal(true);

                expect(Object.keys(result.templateVars.children)).to.deep.equal(['input3', 'input4']);

                expect(result.templateVars).to.have.nested.property('children.input3').that.includes({
                    __formeClass: 'input',
                    type: 'text',
                    alias: 'input3',
                    name: 'input3',
                });

                expect(result.templateVars).to.have.nested.property('children.input4').that.includes({
                    __formeClass: 'input',
                    type: 'text',
                    alias: 'input4',
                    name: 'input4',
                });
            });
        });

        it('should keep values from inputs on previous page marked with keep', function () {
            return blueprints.submitMultiplePages.withThreePagesSixInputsKeepThree(2, [
                {
                    input1: 'value1YES',
                    input2: 'value2NO',
                },
                {
                    input3: 'value3YES',
                    input4: 'value4NO',
                },
            ])
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(result.values).to.deep.equal({
                    input1: 'value1YES',
                    input3: 'value3YES',
                    input4: 'value4NO'
                });
            });
        });
    });
});