package contact

import (
	"github.com/chriis/heritage-motor/internal/handler"
	contactsvc "github.com/chriis/heritage-motor/internal/service/contact"
	"github.com/gofiber/fiber/v2"
)

type Handler struct {
	service *contactsvc.Service
}

func NewHandler(service *contactsvc.Service) *Handler {
	return &Handler{service: service}
}

type submitRequest struct {
	Name     string `json:"name"     validate:"required,min=2,max=100"`
	Email    string `json:"email"    validate:"required,email,max=255"`
	Company  string `json:"company"  validate:"omitempty,max=200"`
	Vehicles string `json:"vehicles" validate:"omitempty,max=50"`
	Message  string `json:"message"  validate:"omitempty,max=5000"`
	Lang     string `json:"lang"     validate:"omitempty,oneof=en fr de"`
}

func (h *Handler) Submit(c *fiber.Ctx) error {
	var req submitRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if err := handler.Validate.Struct(req); err != nil {
		return c.Status(422).JSON(handler.ValidationError(err))
	}

	lang := req.Lang
	if lang == "" {
		lang = "en"
	}

	err := h.service.Submit(c.UserContext(), contactsvc.Request{
		Name:     req.Name,
		Email:    req.Email,
		Company:  req.Company,
		Vehicles: req.Vehicles,
		Message:  req.Message,
		IP:       c.IP(),
		Lang:     lang,
	})
	if err != nil {
		return handler.HandleServiceError(c, err)
	}

	return c.Status(201).JSON(fiber.Map{"message": "request received"})
}
