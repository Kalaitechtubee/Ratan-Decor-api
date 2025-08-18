const express = require('express');
const router = express.Router();
const { getAllUsers, getUserById, createUser, updateUser, deleteUser } = require('./controller');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.use(authenticateToken);

router.post('/', authorizeRoles(['Admin']), createUser);
router.get('/', authorizeRoles(['Admin']), getAllUsers);
router.get('/:id', authorizeRoles(['Admin']), getUserById);
router.put('/:id', authorizeRoles(['Admin']), updateUser);
router.delete('/:id', authorizeRoles(['Admin']), deleteUser);

module.exports = router;