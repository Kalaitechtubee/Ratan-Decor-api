const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser
} = require('./controller');

router.get('/', getAllUsers);         // GET /api/users
router.get('/:id', getUserById);      // GET /api/users/:id
router.put('/:id', updateUser);       // PUT /api/users/:id
router.delete('/:id', deleteUser);    // DELETE /api/users/:id

module.exports = router;
