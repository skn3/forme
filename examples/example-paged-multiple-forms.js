'use strict';

//imports
const forme = require('forme');
const express = require('express');
const app = express();

app.listen(3000, function () {
    console.log('server listening on port 3000!')
});



//page 1
const form1 = new forme();
form1.add('field1').keep();
form1.add('next').action('next', '/page2');

app.get('/page1', function (storage, res) {
    return form1.view(result => {
    });
});

app.post('/page1', function (storage, res) {
    return form1.validate(storage)
    .then(result => {
        const form = result.form;

        if (!result.validated) {
            res.redirect('back');
        } else {
            //handle actions
            return form.next((storage, form, action, context) => {
                res.redirect(context);
            });
        }
    });
});



//page 2
const form2 = new forme();

form2.action('poop',(storage, form, action, context) => {
    console.log('poop was triggered');
});

form2.add('field2').keep();
form2.add('prev').prev('/page1');
form2.add('next').next('/page3');

app.get('/page2', function (storage, res) {
    return form2.view(result => {
    });
});

app.post('/page2', function (storage, res) {
    return form2.validate(storage)
    .then(result => {
        const form = result.form;

        if (!result.validated) {
            res.redirect('back');
        } else {
            //trigger an action by hand
            form.trigger(storage, 'poop');

            //handle actions
            return form.action(storage, ['prev', 'next'], (storage, form, action, context) => {
                res.redirect(context);
            });
        }
    });
});



//page 3
const form3 = new forme();
form3.add('field3').keep();
form3.add('prev').prev('/page2');

app.get('/page3', function (storage, res) {
    return form3.view(result => {
    });
});

app.post('/page3', function (storage, res) {
    return form3.validate(storage)
    .then(result => {
        const form = result.form;

        if (!result.validated) {
            res.redirect('back');
        } else {
            //handle actions
            return form.prev((storage, form, action, context) => {
                res.redirect(context);
            });
        }
    });
});