const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Cloudinary Storage for Multer
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'noc_portal_documents',
    resource_type: 'raw', // Use raw for PDF and other non-image files to preserve content-type
    public_id: (req, file) => {
      try {
        const ext = path.extname(file.originalname).toLowerCase();
        const safeName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9._-]/g, '_');
        return `${Date.now()}-${safeName}${ext}`;
      } catch (err) {
        return `${Date.now()}-file`;
      }
    },
  },
});

function checkFileType(file, cb) {
  const allowedMimeType = 'application/pdf';
  const validMime = file.mimetype === allowedMimeType;

  if (validMime) {
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
