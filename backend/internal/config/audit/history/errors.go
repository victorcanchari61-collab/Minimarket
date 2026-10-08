package history

import "minimarket/backend/internal/apperror"

func invalidField(field, message string) *apperror.Error {
	return apperror.ValidationFields(map[string][]string{field: {message}})
}
