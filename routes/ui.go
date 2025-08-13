package routes

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"gorm.io/datatypes"

	"gnam/middlewares"
	"gnam/models"
)

func ServeIndex(c echo.Context) error {
	return c.File("static/index.html")
}

type requestListItem struct {
	RequestID   string    `json:"request_id"`
	Method      string    `json:"method"`
	Host        string    `json:"host"`
	Path        string    `json:"path"`
	Query       string    `json:"query"`
	IP          string    `json:"ip"`
	ContentType string    `json:"content_type"`
	BodySize    int64     `json:"body_size"`
	TLSEnabled  bool      `json:"tls_enabled"`
	ReceivedAt  time.Time `json:"received_at"`
}

func ApiListRequests(c echo.Context) error {
	db := c.Get("__db").(*middlewares.DatabaseConnection).Gorm

	// Parse limit/offset with sane defaults
	limit := 100
	offset := 0
	if v := c.QueryParam("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 500 {
			limit = n
		}
	}
	if v := c.QueryParam("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			offset = n
		}
	}

	var rows []models.Request
	if err := db.Where("request_id <> ''").Order("received_at desc").Limit(limit).Offset(offset).Find(&rows).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to load requests"})
	}

	out := make([]requestListItem, 0, len(rows))
	for _, r := range rows {
		out = append(out, requestListItem{
			RequestID:   r.RequestID,
			Method:      r.Method,
			Host:        r.Host,
			Path:        r.Path,
			Query:       r.Query,
			IP:          r.IP,
			ContentType: r.ContentType,
			BodySize:    r.BodySize,
			TLSEnabled:  r.TLSEnabled,
			ReceivedAt:  r.ReceivedAt,
		})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"items":  out,
		"count":  len(out),
		"limit":  limit,
		"offset": offset,
	})
}

type requestDetail struct {
	// core
	RequestID   string    `json:"request_id"`
	ReceivedAt  time.Time `json:"received_at"`
	Method      string    `json:"method"`
	Scheme      string    `json:"scheme"`
	HTTPVersion string    `json:"http_version"`
	ProtoMajor  int       `json:"proto_major"`
	ProtoMinor  int       `json:"proto_minor"`
	URL         string    `json:"url"`
	RequestURI  string    `json:"request_uri"`
	Host        string    `json:"host"`
	Path        string    `json:"path"`
	Query       string    `json:"query"`
	Fragment    string    `json:"fragment"`
	RemoteAddr  string    `json:"remote_addr"`
	IP          string    `json:"ip"`
	Port        string    `json:"port"`

	// headers/body
	ContentType   string `json:"content_type"`
	ContentLength int64  `json:"content_length"`
	BodySize      int64  `json:"body_size"`
	UserAgent     string `json:"user_agent"`
	Referer       string `json:"referer"`

	// TLS
	TLSEnabled    bool   `json:"tls_enabled"`
	TLSVersion    string `json:"tls_version"`
	TLSCipher     string `json:"tls_cipher"`
	TLSServerName string `json:"tls_server_name"`

	// decoded fields
	Header        interface{} `json:"header"`
	Cookies       interface{} `json:"cookies"`
	Trailer       interface{} `json:"trailer"`
	TransferEnc   interface{} `json:"transfer_encoding"`
	Form          interface{} `json:"form"`
	PostForm      interface{} `json:"post_form"`
	MultipartForm interface{} `json:"multipart_form"`
	BodyPreview   string      `json:"body_preview"`
}

func ApiGetRequest(c echo.Context) error {
	db := c.Get("__db").(*middlewares.DatabaseConnection).Gorm
	id := c.Param("id")

	var r models.Request
	if err := db.Where("request_id = ?", id).First(&r).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "request not found"})
	}

	det := requestDetail{
		RequestID:     r.RequestID,
		ReceivedAt:    r.ReceivedAt,
		Method:        r.Method,
		Scheme:        r.Scheme,
		HTTPVersion:   r.HTTPVersion,
		ProtoMajor:    r.ProtoMajor,
		ProtoMinor:    r.ProtoMinor,
		URL:           r.URL,
		RequestURI:    r.RequestURI,
		Host:          r.Host,
		Path:          r.Path,
		Query:         r.Query,
		Fragment:      r.Fragment,
		RemoteAddr:    r.RemoteAddr,
		IP:            r.IP,
		Port:          r.Port,
		ContentType:   r.ContentType,
		ContentLength: r.ContentLength,
		BodySize:      r.BodySize,
		UserAgent:     r.UserAgent,
		Referer:       r.Referer,
		TLSEnabled:    r.TLSEnabled,
		TLSVersion:    r.TLSVersion,
		TLSCipher:     r.TLSCipher,
		TLSServerName: r.TLSServerName,
		Header:        decodeJSONField(r.Header),
		Cookies:       decodeJSONField(r.Cookies),
		Trailer:       decodeJSONField(r.Trailer),
		TransferEnc:   decodeJSONField(r.TransferEncoding),
		Form:          decodeJSONField(r.Form),
		PostForm:      decodeJSONField(r.PostForm),
		MultipartForm: decodeJSONField(r.MultipartForm),
	}
	// Create a safe preview of the body as text (up to 2KB)
	body := string(r.Body)
	if len(body) > 2048 {
		body = body[:2048] + "\n… (truncated)"
	}
	det.BodyPreview = body

	return c.JSON(http.StatusOK, det)
}

func decodeJSONField(v datatypes.JSON) interface{} {
	if len(v) == 0 {
		return nil
	}
	var out interface{}
	if err := json.Unmarshal([]byte(v), &out); err != nil {
		return string(v) // fallback
	}
	return out
}
