package fixture

// ExportedFn uses PascalCase for an exported function.
func ExportedFn() int {
	return 1
}

// unexportedFn uses camelCase for a package-local function.
func unexportedFn() int {
	return 2
}
