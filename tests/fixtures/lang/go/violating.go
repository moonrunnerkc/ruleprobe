package fixture

// BadlyNamed_exported has both PascalCase (export) and an underscore which is not idiomatic.
func BadlyNamed_exported() int {
	return 1
}

// snake_unexported is a lowercase function but uses underscores which Go forbids.
func snake_unexported() int {
	return 2
}
