const Contact = require('./Models');
const { sanitizeInputObject } = require('../middleware/security');

class ContactController {
  static async submitContactForm(req, res) {
    try {
      const { name, email, phoneNumber, location, message } = sanitizeInputObject(req.body);

      if (!name || !email || !phoneNumber || !location || !message) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
      }

      const contact = await Contact.create({ name, email, phoneNumber, location, message });
      res.status(201).json({ success: true, message: 'Contact form submitted successfully', data: contact });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error submitting contact form', error: error.message });
    }
  }

  static async getAllContacts(req, res) {
    try {
      const contacts = await Contact.findAll();
      res.status(200).json({ success: true, data: contacts });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error fetching contacts', error: error.message });
    }
  }

  static async getContactById(req, res) {
    try {
      const { id } = req.params;
      const contact = await Contact.findByPk(id);
      if (!contact) {
        return res.status(404).json({ success: false, message: 'Contact not found' });
      }
      res.status(200).json({ success: true, data: contact });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error fetching contact', error: error.message });
    }
  }
}

module.exports = ContactController;