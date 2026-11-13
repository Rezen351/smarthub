package httpapi

import (
	"testing"
	"time"
)

func TestAuthUserIncludesAdministratorCardIdentity(t *testing.T) {
	address := "Desa Cigedug, Kec. Cigedug"
	code := "ADM-002"
	user := authUser("admin-id", "rizal.fahreza@smartgeulisunpad.com", "Rizal Fahreza", "ADMIN", time.Now(), nil, nil, &address, nil, &code)
	if user["cardCode"] != code || user["address"] != address {
		t.Fatalf("administrator card identity missing: %#v", user)
	}
	if _, exists := user["farmerId"]; exists {
		t.Fatalf("administrator must not have a farmer ID: %#v", user)
	}
}
