package routes

import (
	"encoding/json"
	"io"
	"net"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"

	"gnam/models"
)

func IngestRequest(c echo.Context) error {
	db := c.Get("__db").(*gorm.DB)
	req := c.Request()

	var bodyBytes []byte
	if req.Body != nil {
		bodyBytes, _ = io.ReadAll(req.Body)
		req.Body = io.NopCloser(strings.NewReader(string(bodyBytes))) // Restore the body for any downstream handlers

	}

	ip, port, _ := net.SplitHostPort(req.RemoteAddr)

	headerJSON, _ := json.Marshal(req.Header)

	reqID := c.Response().Header().Get(echo.HeaderXRequestID)
	if reqID == "" {
		reqID = req.Header.Get(echo.HeaderXRequestID)
	}

	requestModel := models.Request{
		Method:        req.Method,
		Scheme:        c.Scheme(),
		HTTPVersion:   req.Proto,
		ProtoMajor:    req.ProtoMajor,
		ProtoMinor:    req.ProtoMinor,
		URL:           req.URL.String(),
		RequestURI:    req.RequestURI,
		Host:          req.Host,
		Path:          req.URL.Path,
		Query:         req.URL.RawQuery,
		Fragment:      req.URL.Fragment,
		RemoteAddr:    req.RemoteAddr,
		IP:            ip,
		Port:          port,
		Header:        headerJSON,
		Body:          bodyBytes,
		BodySize:      int64(len(bodyBytes)),
		ContentType:   req.Header.Get("Content-Type"),
		ContentLength: req.ContentLength,
		UserAgent:     req.UserAgent(),
		Referer:       req.Referer(),
		TLSEnabled:    c.IsTLS(),

		ReceivedAt: time.Now(),
		RequestID:  reqID,
	}

	if len(req.Cookies()) > 0 {
		cookieJSON, _ := json.Marshal(req.Cookies())
		requestModel.Cookies = cookieJSON
	}

	if len(req.TransferEncoding) > 0 {
		teJSON, _ := json.Marshal(req.TransferEncoding)
		requestModel.TransferEncoding = teJSON
	}

	if len(req.Trailer) > 0 {
		trailerJSON, _ := json.Marshal(req.Trailer)
		requestModel.Trailer = trailerJSON
	}

	if strings.Contains(req.Header.Get("Content-Type"), "application/x-www-form-urlencoded") ||
		strings.Contains(req.Header.Get("Content-Type"), "multipart/form-data") {
		req.ParseMultipartForm(32 << 20) // 32MB max memory

		if req.Form != nil {
			formJSON, _ := json.Marshal(req.Form)
			requestModel.Form = formJSON
		}

		if req.PostForm != nil {
			postFormJSON, _ := json.Marshal(req.PostForm)
			requestModel.PostForm = postFormJSON
		}

		if req.MultipartForm != nil {
			if req.MultipartForm.Value != nil {
				mfJSON, _ := json.Marshal(req.MultipartForm.Value)
				requestModel.MultipartForm = mfJSON
			}
		}
	}
	if c.IsTLS() && req.TLS != nil {
		requestModel.TLSEnabled = true

		switch req.TLS.Version { // Map TLS version constants to strings

		case 0x0301:
			requestModel.TLSVersion = "TLS1.0"
		case 0x0302:
			requestModel.TLSVersion = "TLS1.1"
		case 0x0303:
			requestModel.TLSVersion = "TLS1.2"
		case 0x0304:
			requestModel.TLSVersion = "TLS1.3"
		default:
			requestModel.TLSVersion = "Unknown"
		}

		requestModel.TLSCipher = getCipherSuiteName(req.TLS.CipherSuite)
		requestModel.TLSServerName = req.TLS.ServerName
	}

	if result := db.Create(&requestModel); result.Error != nil {
		return c.JSON(500, map[string]string{"error": "Failed to ingest request"})
	}

	return c.JSON(200, map[string]interface{}{
		"status":     "ok",
		"request_id": requestModel.ID,
	})
}

// Helper function to convert cipher suite code to name
func getCipherSuiteName(cipher uint16) string {
	cipherNames := map[uint16]string{
		0x1301: "TLS_AES_128_GCM_SHA256",
		0x1302: "TLS_AES_256_GCM_SHA384",
		0x1303: "TLS_CHACHA20_POLY1305_SHA256",
		// TODO: add more
	}

	if name, ok := cipherNames[cipher]; ok {
		return name
	}
	return "Unknown"
}
