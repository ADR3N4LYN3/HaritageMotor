package handler

import (
	"fmt"
	"io"
	"mime/multipart"

	"github.com/gabriel-vasile/mimetype"
)

// AllowedImageTypes lists MIME types accepted for photo uploads.
var AllowedImageTypes = []string{
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/heic",
	"image/heif",
}

// AllowedDocTypes lists MIME types accepted for document uploads.
var AllowedDocTypes = []string{
	"image/jpeg",
	"image/png",
	"image/webp",
	"application/pdf",
}

// ValidateFileType detects the real MIME type of a file via magic bytes and
// checks it against the allowed list. On success it returns the detected MIME
// string. The caller must ensure the file read position is reset (Seek 0)
// after this call if the file will be read again (e.g. for upload).
func ValidateFileType(file multipart.File, allowed []string) (string, error) {
	// mimetype.DetectReader reads up to 3072 bytes from the reader.
	mtype, err := mimetype.DetectReader(file)
	if err != nil {
		return "", fmt.Errorf("failed to detect file type")
	}

	detected := mtype.String()

	// Reset the reader position so the file can be read again for upload.
	if seeker, ok := file.(io.Seeker); ok {
		if _, err := seeker.Seek(0, io.SeekStart); err != nil {
			return "", fmt.Errorf("failed to reset file reader")
		}
	}

	for _, a := range allowed {
		if detected == a {
			return detected, nil
		}
	}

	return "", fmt.Errorf("unsupported file type: %s", detected)
}
