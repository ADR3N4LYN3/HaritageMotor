package storage

import (
	"context"
	"fmt"
	"io"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/rs/zerolog/log"
)

type S3Client struct {
	client    *s3.Client
	presigner *s3.PresignClient
	bucket    string
}

func NewS3Client(endpoint, bucket, accessKey, secretKey, region string) (*S3Client, error) {
	if endpoint == "" {
		log.Warn().Msg("S3 endpoint not configured, file storage will not work")
		return &S3Client{bucket: bucket}, nil
	}

	cfg := aws.Config{
		Region: region,
		Credentials: credentials.NewStaticCredentialsProvider(
			accessKey, secretKey, "",
		),
	}

	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(endpoint)
		o.UsePathStyle = true
	})

	return &S3Client{
		client:    client,
		presigner: s3.NewPresignClient(client),
		bucket:    bucket,
	}, nil
}

func (s *S3Client) Upload(ctx context.Context, key string, body io.Reader, contentType string) error {
	if s.client == nil {
		return fmt.Errorf("s3 client not configured")
	}

	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:               aws.String(s.bucket),
		Key:                  aws.String(key),
		Body:                 body,
		ContentType:          aws.String(contentType),
		ServerSideEncryption: "AES256",
	})
	if err != nil {
		log.Error().Err(err).Str("key", key).Msg("S3 upload failed")
		return fmt.Errorf("s3 upload failed for key %s", key)
	}

	return nil
}

func (s *S3Client) GetSignedURL(ctx context.Context, key string, duration time.Duration) (string, error) {
	if s.client == nil {
		return "", fmt.Errorf("s3 client not configured")
	}

	result, err := s.presigner.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(duration))
	if err != nil {
		log.Error().Err(err).Str("key", key).Msg("S3 presign failed")
		return "", fmt.Errorf("s3 presign failed for key %s", key)
	}

	return result.URL, nil
}

func (s *S3Client) Delete(ctx context.Context, key string) error {
	if s.client == nil {
		return fmt.Errorf("s3 client not configured")
	}

	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		log.Error().Err(err).Str("key", key).Msg("S3 delete failed")
		return fmt.Errorf("s3 delete failed for key %s", key)
	}

	return nil
}

func (s *S3Client) IsConfigured() bool {
	return s.client != nil
}
