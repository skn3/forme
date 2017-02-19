'use strict';

//imports
const forme = require('forme');
const express = require('express');

//setup express
const app = express();

//start server
app.listen(3000, function () {
    console.log('server listening on port 3000!')
});

//build form
const form = forme();

//dynamic pages
form
.page('page1',(storage, form, page) => {
    form.add('field1').keep();
    form.add('next').next();
})
.page('page2',(storage, form, page) => {
    form.add('field2').keep();
    form.add('prev').prev();
    form.add('next').next();
});

//static pages
const page3 = form.page('page3');
page3.add('field3').keep();
page3.add('prev').prev();

//routes
app.get('/', function (storage, res) {
    return form.view(result => {

    });
});

app.post('/', function (storage, res) {
    return form.validate(storage)
    .then(result => {
        const form = result.form;

        //check for need to reload the page
        if (!result.finished) {
            return res.redirect('back');
        } else {
            //validated and finished
        }
    });
});