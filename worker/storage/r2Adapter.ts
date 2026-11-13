import { ApiHttpError, MediaAttachmentRef } from '../types.ts';
import { MediaStorage } from './contracts.ts';

export class R2MediaAdapter implements MediaStorage {
  private readonly bucket?: R2Bucket;

  constructor(bucket?: R2Bucket) {
    this.bucket = bucket;
  }

  private requireBucket(): R2Bucket {
    if (!this.bucket) {
      throw new ApiHttpError(
        503,
        'R2_NOT_BOUND',
        'Binding R2 (env.MEDIA_BUCKET) não configurado neste Worker.'
      );
    }
    return this.bucket;
  }

  async putMedia(params: {
    key: string;
    data: ArrayBuffer;
    contentType: string;
    fileName: string;
    uploadedBy: string;
  }): Promise<MediaAttachmentRef> {
    const bucket = this.requireBucket();
    const uploadedAt = new Date().toISOString();

    await bucket.put(params.key, params.data, {
      httpMetadata: {
        contentType: params.contentType,
      },
      customMetadata: {
        fileName: params.fileName,
        uploadedBy: params.uploadedBy,
        uploadedAt,
      },
    });

    return {
      key: params.key,
      url: `/api/files/${params.key}`,
      fileName: params.fileName,
      contentType: params.contentType,
      size: params.data.byteLength,
      uploadedAt,
      uploadedBy: params.uploadedBy,
    };
  }

  async getMedia(key: string): Promise<{
    body: ReadableStream<Uint8Array> | ArrayBuffer;
    contentType: string;
    size: number;
    etag: string;
  } | null> {
    const bucket = this.requireBucket();
    const object = await bucket.get(key);
    if (!object) return null;

    return {
      body: object.body as unknown as ReadableStream<Uint8Array>,
      contentType: object.httpMetadata?.contentType || 'application/octet-stream',
      size: object.size,
      etag: object.httpEtag,
    };
  }

  async deleteMedia(key: string): Promise<void> {
    const bucket = this.requireBucket();
    await bucket.delete(key);
  }
}
