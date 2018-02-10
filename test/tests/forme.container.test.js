"use strict";

//local imports
const {expect, TestDriverForm, createExpressRequest, createForm} = require('../testShared');

//tests
describe('Container', function () {
    describe('#elements', function () {
        it('should get element by name on unbuilt form', function () {
            const pointer = createForm.withTwoRootInputs().getElement('input1');

            expect(pointer).to.have.property('formeClass').that.equals('input');
            expect(pointer).to.have.property('_type').that.equals('text');
            expect(pointer).to.have.property('_name').that.equals('input1');
        });

        it('should NOT get self (element) when no path given', function () {
            const pointer = createForm.withTwoRootInputs().getElement();

            expect(pointer).to.not.exist;
        });

        it('should fail to find element', function () {
            const pointer = createForm.withTwoRootInputs().getElement('PAGE_NOT_FOUND');

            expect(pointer).to.not.exist;
        });

        it('should get element by name on built form', function () {
            return createForm.withTwoRootInputs().view(createExpressRequest())
            .then(result => {
                const pointer = result.form.getElement('input1');

                expect(pointer).to.have.property('formeClass').that.equals('input');
                expect(pointer).to.have.property('_type').that.equals('text');
                expect(pointer).to.have.property('_name').that.equals('input1');
            });
        });

        it('should get element that was added in build handler', function () {
            return createForm.withTwoInputAddedDuringBuild().view(createExpressRequest())
            .then(result => {
                const pointer = result.form.getElement('input1');

                expect(pointer).to.have.property('formeClass').that.equals('input');
                expect(pointer).to.have.property('_type').that.equals('text');
                expect(pointer).to.have.property('_name').that.equals('input1');
            });
        });

        it('should get element nested in group', function () {
            const pointer = createForm.withTwoGroupedInputs().getElement('group1.group2.input1');

            expect(pointer).to.have.property('formeClass').that.equals('input');
            expect(pointer).to.have.property('_type').that.equals('text');
            expect(pointer).to.have.property('_name').that.equals('input1');
        });

        it('should fail to get element from nested group', function () {
            const pointer = createForm.withTwoGroupedInputs().getElement('group1.group2.PAGE_NOT_FOUND');

            expect(pointer).to.not.exist;
        });

        it('should fail to get element when path tries to recurse into non-container', function () {
            const pointer = createForm.withTwoGroupedInputs().getElement('group1.group2.input1.TOO_FAR');

            expect(pointer).to.not.exist;
        });
    })
});