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
const form = new forme()
.page('page1',(storage, form, page) => {
    this.add('field1').keep();
    this.add('next').next();
})
.page('page2',(storage, form, page) => {
    this.add('field2').keep();
    this.add('prev').prev();
    this.add('next').next();
})
.page('page3',(storage, form, page) => {
    this.add('field3').keep();
    this.add('prev').prev();
});

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