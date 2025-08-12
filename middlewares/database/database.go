package database

import (
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type DatabaseConnection struct {
	Gorm *gorm.DB
}

func Middleware(db *DatabaseConnection) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			c.Set("__db", db)
			return next(c)
		}
	}
}
