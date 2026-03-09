package document

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"

	"github.com/chriis/heritage-motor/internal/db"
	"github.com/chriis/heritage-motor/internal/domain"
)

type CreateDocumentRequest struct {
	DocType   string     `json:"doc_type" validate:"required"`
	Filename  string     `json:"filename" validate:"required"`
	S3Key     string     `json:"s3_key" validate:"required"`
	MimeType  string     `json:"mime_type" validate:"required"`
	SizeBytes int64      `json:"size_bytes" validate:"required"`
	ExpiresAt *time.Time `json:"expires_at"`
	Notes     *string    `json:"notes"`
}

type Service struct {
	pool     *pgxpool.Pool
	s3Bucket string
}

func NewService(pool *pgxpool.Pool, s3Bucket string) *Service {
	return &Service{pool: pool, s3Bucket: s3Bucket}
}

func (s *Service) List(ctx context.Context, tenantID, vehicleID uuid.UUID, page, perPage int) ([]domain.Document, int, error) {
	// Normalize pagination
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage

	// Single query with COUNT(*) OVER() to avoid a separate count query.
	rows, err := db.Conn(ctx, s.pool).Query(ctx,
		`SELECT id, tenant_id, vehicle_id, uploaded_by, doc_type, filename, s3_key, mime_type, size_bytes, expires_at, notes, created_at, deleted_at,
		 COUNT(*) OVER() AS total_count
		 FROM documents
		 WHERE tenant_id = $1 AND vehicle_id = $2 AND deleted_at IS NULL
		 ORDER BY created_at DESC
		 LIMIT $3 OFFSET $4`,
		tenantID, vehicleID, perPage, offset,
	)
	if err != nil {
		log.Error().Err(err).Msg("failed to query documents")
		return nil, 0, fmt.Errorf("query documents: %w", err)
	}
	defer rows.Close()

	var total int
	docs := make([]domain.Document, 0, perPage)
	for rows.Next() {
		var doc domain.Document
		if err := rows.Scan(
			&doc.ID, &doc.TenantID, &doc.VehicleID, &doc.UploadedBy,
			&doc.DocType, &doc.Filename, &doc.S3Key, &doc.MimeType,
			&doc.SizeBytes, &doc.ExpiresAt, &doc.Notes,
			&doc.CreatedAt, &doc.DeletedAt,
			&total,
		); err != nil {
			log.Error().Err(err).Msg("failed to scan document row")
			return nil, 0, fmt.Errorf("scan document: %w", err)
		}
		docs = append(docs, doc)
	}
	if err := rows.Err(); err != nil {
		log.Error().Err(err).Msg("error iterating document rows")
		return nil, 0, fmt.Errorf("iterate documents: %w", err)
	}

	return docs, total, nil
}

func (s *Service) GetByID(ctx context.Context, tenantID, vehicleID, docID uuid.UUID) (*domain.Document, error) {
	var doc domain.Document

	err := db.Conn(ctx, s.pool).QueryRow(ctx,
		`SELECT id, tenant_id, vehicle_id, uploaded_by, doc_type, filename, s3_key, mime_type, size_bytes, expires_at, notes, created_at, deleted_at
		 FROM documents
		 WHERE id = $1 AND tenant_id = $2 AND vehicle_id = $3 AND deleted_at IS NULL`,
		docID, tenantID, vehicleID,
	).Scan(
		&doc.ID, &doc.TenantID, &doc.VehicleID, &doc.UploadedBy,
		&doc.DocType, &doc.Filename, &doc.S3Key, &doc.MimeType,
		&doc.SizeBytes, &doc.ExpiresAt, &doc.Notes,
		&doc.CreatedAt, &doc.DeletedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, &domain.ErrNotFound{Resource: "document", ID: docID}
		}
		log.Error().Err(err).Str("document_id", docID.String()).Msg("failed to get document")
		return nil, fmt.Errorf("get document: %w", err)
	}

	return &doc, nil
}

func (s *Service) Create(ctx context.Context, tenantID, vehicleID, userID uuid.UUID, req CreateDocumentRequest) (*domain.Document, error) {
	now := time.Now().UTC()

	doc := domain.Document{
		ID:         uuid.New(),
		TenantID:   tenantID,
		VehicleID:  vehicleID,
		UploadedBy: userID,
		DocType:    req.DocType,
		Filename:   req.Filename,
		S3Key:      req.S3Key,
		MimeType:   req.MimeType,
		SizeBytes:  req.SizeBytes,
		ExpiresAt:  req.ExpiresAt,
		Notes:      req.Notes,
		CreatedAt:  now,
	}

	tx, err := db.Conn(ctx, s.pool).Begin(ctx)
	if err != nil {
		log.Error().Err(err).Msg("failed to begin transaction")
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck // rollback is no-op after commit

	// Insert document record
	_, err = tx.Exec(ctx,
		`INSERT INTO documents (id, tenant_id, vehicle_id, uploaded_by, doc_type, filename, s3_key, mime_type, size_bytes, expires_at, notes, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
		doc.ID, doc.TenantID, doc.VehicleID, doc.UploadedBy,
		doc.DocType, doc.Filename, doc.S3Key, doc.MimeType,
		doc.SizeBytes, doc.ExpiresAt, doc.Notes, doc.CreatedAt,
	)
	if err != nil {
		log.Error().Err(err).Msg("failed to insert document")
		return nil, fmt.Errorf("insert document: %w", err)
	}

	// Insert document_added event
	eventMetadata, err := json.Marshal(map[string]interface{}{
		"document_id": doc.ID.String(),
		"doc_type":    doc.DocType,
		"filename":    doc.Filename,
	})
	if err != nil {
		return nil, fmt.Errorf("marshal event metadata: %w", err)
	}

	_, err = tx.Exec(ctx,
		`INSERT INTO events (id, tenant_id, vehicle_id, user_id, event_type, metadata, photo_keys, notes, occurred_at, source)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		uuid.New(), tenantID, vehicleID, userID,
		domain.EventTypeDocumentAdded, eventMetadata, []string{},
		nil, now, "system",
	)
	if err != nil {
		log.Error().Err(err).Msg("failed to insert document_added event")
		return nil, fmt.Errorf("insert event: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		log.Error().Err(err).Msg("failed to commit transaction")
		return nil, fmt.Errorf("commit tx: %w", err)
	}

	log.Info().
		Str("document_id", doc.ID.String()).
		Str("vehicle_id", vehicleID.String()).
		Str("filename", doc.Filename).
		Msg("document created")

	return &doc, nil
}

func (s *Service) Delete(ctx context.Context, tenantID, vehicleID, docID uuid.UUID) error {
	result, err := db.Conn(ctx, s.pool).Exec(ctx,
		`UPDATE documents SET deleted_at = NOW()
		 WHERE id = $1 AND tenant_id = $2 AND vehicle_id = $3 AND deleted_at IS NULL`,
		docID, tenantID, vehicleID,
	)
	if err != nil {
		log.Error().Err(err).Str("document_id", docID.String()).Msg("failed to soft-delete document")
		return fmt.Errorf("delete document: %w", err)
	}

	if result.RowsAffected() == 0 {
		return &domain.ErrNotFound{Resource: "document", ID: docID}
	}

	log.Info().
		Str("document_id", docID.String()).
		Str("vehicle_id", vehicleID.String()).
		Msg("document soft-deleted")

	return nil
}
