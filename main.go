package main

import (
	"errors"
	"net/http"
	"time"

	"gnam/middlewares"
	"gnam/models"
	"gnam/routes"

	"github.com/glebarez/sqlite"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"gorm.io/gorm"
)

func main() {
	e := echo.New()

	db, err := gorm.Open(sqlite.Open("gnam.db"), &gorm.Config{})
	if err != nil {
		panic("failed to connect database")
	}

	db.AutoMigrate(&models.Request{})

	e.Pre(middleware.RequestID())
	e.Use(middleware.Recover())
	e.Use(middleware.Decompress())
	e.Use(middleware.GzipWithConfig(middleware.GzipConfig{
		Level: 5,
	}))
	e.Use(middleware.TimeoutWithConfig(middleware.TimeoutConfig{
		Skipper:      middleware.DefaultSkipper,
		ErrorMessage: "Timed Out",
		Timeout:      10 * time.Second,
	}))
	e.Use(middleware.Logger())

	e.Use(middlewares.DatabaseInjector(&middlewares.DatabaseConnection{Gorm: db}))

	// Register Web UI and API before the catch-all ingest route
	e.GET("/ui", routes.ServeIndex)
	e.GET("/ui/*", routes.ServeIndex)
	e.Static("/static", "static")

	// APIs
	e.GET("/api/requests", routes.ApiListRequests)
	e.GET("/api/requests/:id", routes.ApiGetRequest)

	e.Any("/*", routes.IngestRequest)

	if err := e.Start(":8080"); err != nil && !errors.Is(err, http.ErrServerClosed) {
		e.Logger.Fatalf("an error occurred while starting the server: %v", err)
	}

}
