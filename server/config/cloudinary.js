const { v2: cloudinary } = require("cloudinary");

const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
);

const isProductionLike = Boolean(
  process.env.NODE_ENV === "production" ||
    process.env.RENDER ||
    process.env.RENDER_SERVICE_ID ||
    process.env.RENDER_EXTERNAL_HOSTNAME ||
    process.env.RENDER_EXTERNAL_URL
);

const shouldUseLocalUploads = !isProductionLike && !isCloudinaryConfigured;

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const uploadImage = (file, folder) =>
  new Promise((resolve, reject) => {
    if (shouldUseLocalUploads) {
      return resolve(`/uploads/${file.filename}`);
    }

    if (!isCloudinaryConfigured) {
      const error = new Error(
        "Cloudinary doit etre configure pour televerser des images en production"
      );
      error.code = "CLOUDINARY_NOT_CONFIGURED";
      return reject(error);
    }

    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );

    stream.end(file.buffer);
  });

module.exports = {
  isCloudinaryConfigured,
  shouldUseLocalUploads,
  uploadImage,
};
