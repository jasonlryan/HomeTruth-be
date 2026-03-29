// const fs = require('fs');
// const path = require('path');
// const { URL } = require('url');
// const { SERVER, LIMITS } = require('./constants');
// const zooplaService = require('./zooplaService');

// class ImageService {
//   constructor() {
//     this.tempDir = SERVER.TEMP_DIR;
//     this.serverBaseUrl = SERVER.BASE_URL;
//     this._ensureTempDirExists();
//   }

//   async downloadPropertyImages(token, propertyId, images) {
//     const localImages = [];
//     const maxImages = Math.min(images.length, LIMITS.MAX_IMAGES_PER_PROPERTY);
    
//     for (let i = 0; i < maxImages; i++) {
//       const img = images[i];
//       const url = img?.sizes?.screen?.src;
      
//       if (!url) continue;
      
//       const imageId = this._extractImageId(url);
//       if (!imageId) continue;
      
//       try {
//         const localUrl = await this._downloadImageToTemp(token, propertyId, imageId);
//         localImages.push(localUrl);
//       } catch (error) {
//         console.error(`Failed to download image ${imageId}:`, error.message);
//       }
//     }
    
//     return localImages;
//   }

//   async _downloadImageToTemp(token, propertyId, imageId) {
//     const imageStream = await zooplaService.downloadImage(token, propertyId, imageId);
//     const savePath = path.join(this.tempDir, `${imageId}.jpg`);
//     const writer = fs.createWriteStream(savePath);
    
//     imageStream.pipe(writer);
    
//     await new Promise((resolve, reject) => {
//       writer.on('finish', resolve);
//       writer.on('error', reject);
//     });
    
//     return `${this.serverBaseUrl}/temp-images/${imageId}.jpg`;
//   }

//   _extractImageId(url) {
//     try {
//       const imageId = new URL(url).pathname.split('/').pop();
//       return /^[0-9]+$/.test(imageId) ? imageId : null;
//     } catch (error) {
//       return null;
//     }
//   }

//   _ensureTempDirExists() {
//     if (!fs.existsSync(this.tempDir)) {
//       fs.mkdirSync(this.tempDir, { recursive: true });
//     }
//   }

//   // Utility method to clean up old images
//   cleanupOldImages(maxAge = 24 * 60 * 60 * 1000) { // 24 hours default
//     try {
//       const files = fs.readdirSync(this.tempDir);
//       const now = Date.now();
      
//       files.forEach(file => {
//         const filePath = path.join(this.tempDir, file);
//         const stats = fs.statSync(filePath);
        
//         if (now - stats.mtime.getTime() > maxAge) {
//           fs.unlinkSync(filePath);
//           console.log(`Cleaned up old image: ${file}`);
//         }
//       });
//     } catch (error) {
//       console.error('Error cleaning up images:', error);
//     }
//   }
// }

// module.exports = new ImageService();