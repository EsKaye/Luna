const AWS = require('aws-sdk');
const { Storage } = require('@google-cloud/storage');
const { BlobServiceClient } = require('@azure/storage-blob');
const Minio = require('minio');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

class StorageService {
  constructor(redis, logger) {
    this.redis = redis;
    this.logger = logger;
    this.providers = {};
    this.initializeProviders();
  }

  async initializeProviders() {
    try {
      // AWS S3
      if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        this.providers.s3 = new AWS.S3({
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          region: process.env.AWS_REGION || 'us-east-1'
        });
        this.logger.info('AWS S3 provider initialized');
      }

      // Google Cloud Storage
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        this.providers.gcs = new Storage({
          keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
        });
        this.logger.info('Google Cloud Storage provider initialized');
      }

      // Azure Blob Storage
      if (process.env.AZURE_STORAGE_CONNECTION_STRING) {
        this.providers.azure = BlobServiceClient.fromConnectionString(
          process.env.AZURE_STORAGE_CONNECTION_STRING
        );
        this.logger.info('Azure Blob Storage provider initialized');
      }

      // MinIO (Local/Private Cloud)
      if (process.env.MINIO_ENDPOINT) {
        this.providers.minio = new Minio.Client({
          endPoint: process.env.MINIO_ENDPOINT,
          port: parseInt(process.env.MINIO_PORT) || 9000,
          useSSL: process.env.MINIO_USE_SSL === 'true',
          accessKey: process.env.MINIO_ACCESS_KEY,
          secretKey: process.env.MINIO_SECRET_KEY
        });
        this.logger.info('MinIO provider initialized');
      }

      // Local file system as fallback
      this.providers.local = {
        upload: this.localUpload.bind(this),
        download: this.localDownload.bind(this),
        delete: this.localDelete.bind(this)
      };
      this.logger.info('Local storage provider initialized');

    } catch (error) {
      this.logger.error('Storage providers initialization failed:', error);
    }
  }

  async uploadFile(file, metadata = {}, bucket = 'default', provider = 'auto') {
    try {
      const fileId = this.generateFileId();
      const fileExtension = path.extname(file.name || 'file');
      const fileName = `${fileId}${fileExtension}`;
      
      // Process file based on type
      const processedFile = await this.processFile(file, metadata);
      
      // Choose provider
      const selectedProvider = await this.selectProvider(provider, bucket);
      
      // Upload to selected provider
      const uploadResult = await this.uploadToProvider(
        selectedProvider,
        bucket,
        fileName,
        processedFile,
        metadata
      );

      // Store metadata in Redis
      const fileMetadata = {
        id: fileId,
        name: file.name || fileName,
        size: processedFile.length,
        type: file.type || 'application/octet-stream',
        bucket,
        provider: selectedProvider.name,
        url: uploadResult.url,
        metadata,
        uploadedAt: new Date().toISOString(),
        checksum: this.calculateChecksum(processedFile)
      };

      await this.redis.hset(`file:${fileId}`, fileMetadata);
      await this.redis.expire(`file:${fileId}`, 86400 * 30); // 30 days

      this.logger.info(`File uploaded successfully: ${fileId}`);
      
      return {
        fileId,
        url: uploadResult.url,
        metadata: fileMetadata
      };

    } catch (error) {
      this.logger.error('File upload failed:', error);
      throw error;
    }
  }

  async downloadFile(fileId, bucket = 'default') {
    try {
      // Get file metadata from Redis
      const metadata = await this.redis.hgetall(`file:${fileId}`);
      if (!metadata.id) {
        throw new Error('File not found');
      }

      const provider = await this.selectProvider(metadata.provider, bucket);
      const fileData = await this.downloadFromProvider(provider, bucket, metadata.name);

      this.logger.info(`File downloaded successfully: ${fileId}`);
      
      return {
        data: fileData,
        metadata
      };

    } catch (error) {
      this.logger.error('File download failed:', error);
      throw error;
    }
  }

  async deleteFile(fileId, bucket = 'default') {
    try {
      // Get file metadata from Redis
      const metadata = await this.redis.hgetall(`file:${fileId}`);
      if (!metadata.id) {
        throw new Error('File not found');
      }

      const provider = await this.selectProvider(metadata.provider, bucket);
      await this.deleteFromProvider(provider, bucket, metadata.name);

      // Remove from Redis
      await this.redis.del(`file:${fileId}`);

      this.logger.info(`File deleted successfully: ${fileId}`);
      
      return { success: true };

    } catch (error) {
      this.logger.error('File deletion failed:', error);
      throw error;
    }
  }

  async processFile(file, metadata) {
    try {
      let processedData = file.data || file;

      // Image processing
      if (file.type && file.type.startsWith('image/')) {
        processedData = await this.processImage(processedData, metadata);
      }

      // Video processing
      if (file.type && file.type.startsWith('video/')) {
        processedData = await this.processVideo(processedData, metadata);
      }

      // Audio processing
      if (file.type && file.type.startsWith('audio/')) {
        processedData = await this.processAudio(processedData, metadata);
      }

      return processedData;

    } catch (error) {
      this.logger.error('File processing failed:', error);
      return file.data || file;
    }
  }

  async processImage(data, metadata) {
    try {
      const { width, height, quality, format } = metadata;
      
      let processed = sharp(data);

      if (width || height) {
        processed = processed.resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }

      if (quality) {
        processed = processed.jpeg({ quality: parseInt(quality) });
      }

      if (format) {
        switch (format.toLowerCase()) {
          case 'webp':
            processed = processed.webp();
            break;
          case 'png':
            processed = processed.png();
            break;
          case 'jpeg':
          case 'jpg':
            processed = processed.jpeg();
            break;
        }
      }

      return await processed.toBuffer();

    } catch (error) {
      this.logger.error('Image processing failed:', error);
      return data;
    }
  }

  async processVideo(data, metadata) {
    try {
      const { width, height, bitrate, format } = metadata;
      
      return new Promise((resolve, reject) => {
        let command = ffmpeg(data);

        if (width || height) {
          command = command.size(`${width || '?'}x${height || '?'}`);
        }

        if (bitrate) {
          command = command.videoBitrate(bitrate);
        }

        if (format) {
          command = command.format(format);
        }

        command
          .toFormat('mp4')
          .on('end', () => resolve(data))
          .on('error', (err) => reject(err))
          .save('temp_video.mp4');
      });

    } catch (error) {
      this.logger.error('Video processing failed:', error);
      return data;
    }
  }

  async processAudio(data, metadata) {
    try {
      const { bitrate, format } = metadata;
      
      return new Promise((resolve, reject) => {
        let command = ffmpeg(data);

        if (bitrate) {
          command = command.audioBitrate(bitrate);
        }

        if (format) {
          command = command.format(format);
        }

        command
          .toFormat('mp3')
          .on('end', () => resolve(data))
          .on('error', (err) => reject(err))
          .save('temp_audio.mp3');
      });

    } catch (error) {
      this.logger.error('Audio processing failed:', error);
      return data;
    }
  }

  async selectProvider(provider, bucket) {
    try {
      // Auto-select based on availability and cost
      if (provider === 'auto') {
        const providers = Object.keys(this.providers);
        
        // Priority order: local, minio, s3, gcs, azure
        const priority = ['local', 'minio', 's3', 'gcs', 'azure'];
        
        for (const p of priority) {
          if (providers.includes(p)) {
            return { name: p, client: this.providers[p] };
          }
        }
      }

      if (this.providers[provider]) {
        return { name: provider, client: this.providers[provider] };
      }

      throw new Error(`Provider ${provider} not available`);

    } catch (error) {
      this.logger.error('Provider selection failed:', error);
      throw error;
    }
  }

  async uploadToProvider(provider, bucket, fileName, data, metadata) {
    try {
      switch (provider.name) {
        case 's3':
          return await this.uploadToS3(provider.client, bucket, fileName, data, metadata);
        case 'gcs':
          return await this.uploadToGCS(provider.client, bucket, fileName, data, metadata);
        case 'azure':
          return await this.uploadToAzure(provider.client, bucket, fileName, data, metadata);
        case 'minio':
          return await this.uploadToMinIO(provider.client, bucket, fileName, data, metadata);
        case 'local':
          return await this.uploadToLocal(provider.client, bucket, fileName, data, metadata);
        default:
          throw new Error(`Unsupported provider: ${provider.name}`);
      }
    } catch (error) {
      this.logger.error(`Upload to ${provider.name} failed:`, error);
      throw error;
    }
  }

  async uploadToS3(s3, bucket, fileName, data, metadata) {
    const params = {
      Bucket: bucket,
      Key: fileName,
      Body: data,
      ContentType: metadata.type || 'application/octet-stream',
      Metadata: metadata
    };

    const result = await s3.upload(params).promise();
    return { url: result.Location };
  }

  async uploadToGCS(storage, bucket, fileName, data, metadata) {
    const bucketObj = storage.bucket(bucket);
    const file = bucketObj.file(fileName);

    await file.save(data, {
      metadata: {
        contentType: metadata.type || 'application/octet-stream',
        metadata
      }
    });

    return { url: `gs://${bucket}/${fileName}` };
  }

  async uploadToAzure(blobService, bucket, fileName, data, metadata) {
    const containerClient = blobService.getContainerClient(bucket);
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);

    await blockBlobClient.upload(data, data.length, {
      blobHTTPHeaders: {
        blobContentType: metadata.type || 'application/octet-stream'
      },
      metadata
    });

    return { url: blockBlobClient.url };
  }

  async uploadToMinIO(minio, bucket, fileName, data, metadata) {
    await minio.putObject(bucket, fileName, data, {
      'Content-Type': metadata.type || 'application/octet-stream',
      ...metadata
    });

    return { url: `${process.env.MINIO_ENDPOINT}/${bucket}/${fileName}` };
  }

  async uploadToLocal(local, bucket, fileName, data, metadata) {
    const uploadDir = path.join(process.cwd(), 'uploads', bucket);
    await fs.mkdir(uploadDir, { recursive: true });
    
    const filePath = path.join(uploadDir, fileName);
    await fs.writeFile(filePath, data);

    return { url: `/uploads/${bucket}/${fileName}` };
  }

  async downloadFromProvider(provider, bucket, fileName) {
    try {
      switch (provider.name) {
        case 's3':
          return await this.downloadFromS3(provider.client, bucket, fileName);
        case 'gcs':
          return await this.downloadFromGCS(provider.client, bucket, fileName);
        case 'azure':
          return await this.downloadFromAzure(provider.client, bucket, fileName);
        case 'minio':
          return await this.downloadFromMinIO(provider.client, bucket, fileName);
        case 'local':
          return await this.downloadFromLocal(provider.client, bucket, fileName);
        default:
          throw new Error(`Unsupported provider: ${provider.name}`);
      }
    } catch (error) {
      this.logger.error(`Download from ${provider.name} failed:`, error);
      throw error;
    }
  }

  async downloadFromS3(s3, bucket, fileName) {
    const params = { Bucket: bucket, Key: fileName };
    const result = await s3.getObject(params).promise();
    return result.Body;
  }

  async downloadFromGCS(storage, bucket, fileName) {
    const bucketObj = storage.bucket(bucket);
    const file = bucketObj.file(fileName);
    const [data] = await file.download();
    return data;
  }

  async downloadFromAzure(blobService, bucket, fileName) {
    const containerClient = blobService.getContainerClient(bucket);
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);
    const downloadResponse = await blockBlobClient.download();
    return downloadResponse.readableStreamBody;
  }

  async downloadFromMinIO(minio, bucket, fileName) {
    return await minio.getObject(bucket, fileName);
  }

  async downloadFromLocal(local, bucket, fileName) {
    const filePath = path.join(process.cwd(), 'uploads', bucket, fileName);
    return await fs.readFile(filePath);
  }

  async deleteFromProvider(provider, bucket, fileName) {
    try {
      switch (provider.name) {
        case 's3':
          return await this.deleteFromS3(provider.client, bucket, fileName);
        case 'gcs':
          return await this.deleteFromGCS(provider.client, bucket, fileName);
        case 'azure':
          return await this.deleteFromAzure(provider.client, bucket, fileName);
        case 'minio':
          return await this.deleteFromMinIO(provider.client, bucket, fileName);
        case 'local':
          return await this.deleteFromLocal(provider.client, bucket, fileName);
        default:
          throw new Error(`Unsupported provider: ${provider.name}`);
      }
    } catch (error) {
      this.logger.error(`Delete from ${provider.name} failed:`, error);
      throw error;
    }
  }

  async deleteFromS3(s3, bucket, fileName) {
    const params = { Bucket: bucket, Key: fileName };
    await s3.deleteObject(params).promise();
  }

  async deleteFromGCS(storage, bucket, fileName) {
    const bucketObj = storage.bucket(bucket);
    const file = bucketObj.file(fileName);
    await file.delete();
  }

  async deleteFromAzure(blobService, bucket, fileName) {
    const containerClient = blobService.getContainerClient(bucket);
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);
    await blockBlobClient.delete();
  }

  async deleteFromMinIO(minio, bucket, fileName) {
    await minio.removeObject(bucket, fileName);
  }

  async deleteFromLocal(local, bucket, fileName) {
    const filePath = path.join(process.cwd(), 'uploads', bucket, fileName);
    await fs.unlink(filePath);
  }

  async cleanupOldFiles(days = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      // Get all file keys from Redis
      const keys = await this.redis.keys('file:*');
      
      for (const key of keys) {
        const metadata = await this.redis.hgetall(key);
        const uploadedAt = new Date(metadata.uploadedAt);
        
        if (uploadedAt < cutoffDate) {
          await this.deleteFile(metadata.id, metadata.bucket);
          this.logger.info(`Cleaned up old file: ${metadata.id}`);
        }
      }

    } catch (error) {
      this.logger.error('Cleanup failed:', error);
    }
  }

  generateFileId() {
    return crypto.randomBytes(16).toString('hex');
  }

  calculateChecksum(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  async healthCheck() {
    try {
      const providers = Object.keys(this.providers);
      const health = {};

      for (const provider of providers) {
        try {
          switch (provider) {
            case 's3':
              await this.providers.s3.listBuckets().promise();
              health.s3 = 'healthy';
              break;
            case 'gcs':
              await this.providers.gcs.getBuckets();
              health.gcs = 'healthy';
              break;
            case 'azure':
              await this.providers.azure.listContainers();
              health.azure = 'healthy';
              break;
            case 'minio':
              await this.providers.minio.listBuckets();
              health.minio = 'healthy';
              break;
            case 'local':
              await fs.access(path.join(process.cwd(), 'uploads'));
              health.local = 'healthy';
              break;
          }
        } catch (error) {
          health[provider] = 'unhealthy';
        }
      }

      return health;
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return { error: error.message };
    }
  }
}

module.exports = StorageService; 