# Middleware Cleanup TODO

## Tasks
- [x] Update category/routes.js to import uploadCategoryImage and handleCategoryUploadError from upload.js instead of categoryUpload.js
- [x] Update userType/routes.js to import uploadUserTypeIcon and handleUploadError from upload.js (currently commented out)
- [x] Update middleware/index.js to remove exports from unwanted files and ensure all needed functions are exported from upload.js
- [x] Delete unwanted middleware files: categoryUpload.js, userTypeUpload.js, imageValidation.js

## Status
- [x] Plan approved by user
- [x] In progress
- [x] Completed
