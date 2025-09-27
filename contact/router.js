const express = require('express');
const router = express.Router();
const ContactController = require('./contactController');

router.post('/submit', ContactController.submitContactForm);
router.get('/all', ContactController.getAllContacts);
router.get('/:id', ContactController.getContactById);

module.exports = router;