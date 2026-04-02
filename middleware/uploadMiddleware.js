const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads folder if it doesn't exist
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadDir);
  },
  filename(req, file, cb) {
    // Sanitize original filename to avoid path traversal
    const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  }
});

function checkFileType(file, cb) {
  const allowedExtensions = /\.pdf$/i;
  const allowedMimeType = 'application/pdf';

  const validExt = allowedExtensions.test(file.originalname);
  const validMime = file.mimetype === allowedMimeType;

  if (validExt && validMime) {
    return cb(null, true);
  }
  cb(new Error('Only PDF files are allowed.'));
}

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter(req, file, cb) {
    checkFileType(file, cb);
  }
});

module.exports = upload;
