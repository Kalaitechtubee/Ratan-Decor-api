// // routes/videoCallEnquiry.js - Video Call Enquiries
// const express = require('express');
// const router = express.Router();
// const videoCallEnquiryController = require('../videoCallEnquiry/controller');
// const { authenticateToken, moduleAccess, requireOwnDataOrStaff } = require('../middleware/auth');

// // All routes require authentication
// router.use(authenticateToken);

// // Create video call enquiry (any authenticated user)
// router.post('/create', videoCallEnquiryController.create);

// // Get own enquiries (users see only their own)
// router.get('/my-enquiries', videoCallEnquiryController.getMyEnquiries);

// // Staff-only routes for managing all enquiries
// router.get('/all', 
//   moduleAccess.requireSalesAccess, 
//   videoCallEnquiryController.getAll
// );

// router.get('/:id', 
//   requireOwnDataOrStaff, 
//   videoCallEnquiryController.getById
// );

// router.put('/:id', 
//   moduleAccess.requireSalesAccess, 
//   videoCallEnquiryController.update
// );

// router.delete('/:id', 
//   moduleAccess.requireSalesAccess, 
//   videoCallEnquiryController.delete
// );

// module.exports = router;
// 4. Enhanced Routes
// routes/videoCallEnquiry.js
const express = require('express');
const router = express.Router();
const videoCallEnquiryController = require('./controller');
const { authenticateToken, moduleAccess, requireOwnDataOrStaff } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Public routes (any authenticated user)
router.post('/create', videoCallEnquiryController.create);
router.get('/my-enquiries', videoCallEnquiryController.getMyEnquiries);

// Staff-only routes for managing all enquiries
router.get('/all', 
  moduleAccess.requireSalesAccess, 
  videoCallEnquiryController.getAll
);

router.get('/:id', 
  requireOwnDataOrStaff, 
  videoCallEnquiryController.getById
);

router.put('/:id', 
  moduleAccess.requireSalesAccess, 
  videoCallEnquiryController.update
);

router.delete('/:id', 
  moduleAccess.requireSalesAccess, 
  videoCallEnquiryController.delete
);

// 🆕 INTERNAL NOTES ROUTES (Staff only)
router.post('/:id/internal-notes', 
  moduleAccess.requireSalesAccess, 
  videoCallEnquiryController.addInternalNote
);

router.get('/:id/internal-notes', 
  moduleAccess.requireSalesAccess, 
  videoCallEnquiryController.getInternalNotes
);

router.put('/internal-notes/:noteId', 
  moduleAccess.requireSalesAccess, 
  videoCallEnquiryController.updateInternalNote
);

router.delete('/internal-notes/:noteId', 
  moduleAccess.requireSalesAccess, 
  videoCallEnquiryController.deleteInternalNote
);

// 🆕 FOLLOW-UP DASHBOARD
router.get('/dashboard/follow-ups', 
  moduleAccess.requireSalesAccess, 
  videoCallEnquiryController.getFollowUpDashboard
);

module.exports = router;