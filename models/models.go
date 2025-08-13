package models

import (
	"time"

	"gorm.io/datatypes"
)

type Request struct {
	// Request line and URL
	Method      string `gorm:"size:16;index"` // GET, POST, etc.
	Scheme      string `gorm:"size:8"`        // http, https
	HTTPVersion string `gorm:"size:16"`       // e.g. HTTP/1.1
	ProtoMajor  int
	ProtoMinor  int
	URL         string // Full URL (scheme, host, path, query, fragment)
	RequestURI  string // Raw RequestURI as received
	Host        string `gorm:"index"`
	Path        string `gorm:"index"`
	Query       string // Raw query string
	Fragment    string // URL fragment (if present)

	// Remote addressing
	RemoteAddr string // Original "IP:port" as seen by server
	IP         string `gorm:"index"` // Extracted IP
	Port       string // Extracted port

	// Headers, cookies, trailers
	Header           datatypes.JSON // JSON: map[string][]string
	Cookies          datatypes.JSON // JSON: []Cookie-like objects {name,value,...}
	Trailer          datatypes.JSON // JSON: map[string][]string
	TransferEncoding datatypes.JSON // JSON: []string

	// Body
	Body          []byte `gorm:"type:blob"` // Raw body (may be binary)
	BodySize      int64  `gorm:"index"`
	ContentType   string `gorm:"index"`
	ContentLength int64

	// Parsed form data (optional convenience)
	Form          datatypes.JSON // JSON: map[string][]string
	PostForm      datatypes.JSON // JSON: map[string][]string
	MultipartForm datatypes.JSON // JSON representation of fields (files not stored here)

	// Common header shortcuts
	UserAgent string `gorm:"index"`
	Referer   string

	// TLS info
	TLSEnabled    bool   `gorm:"index"`
	TLSVersion    string // e.g. TLS1.3
	TLSCipher     string // cipher suite name/id
	TLSServerName string // SNI

	// When the request was received and Echo's request ID
	ReceivedAt time.Time `gorm:"index"`
	RequestID  string    `gorm:"size:64;index"`
}
